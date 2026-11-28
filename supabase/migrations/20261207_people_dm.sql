-- People list and friend-to-friend chat (2026-12-07). Run after 20261205_teacher.sql. Idempotent.

-- a person without a username is shown as player_xxxxx; friend requests must find that name too
create or replace function public.friend_find(p_username text) returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select g.user_id from public.game_profiles g where g.nick <> '' and lower(g.nick) = lower(trim(p_username)) limit 1),
    (select p.id from public.profiles p where lower(trim(p_username)) like 'player\_%' and public.game_nick(p.id) = lower(trim(p_username)) limit 1));
$$;
revoke all on function public.friend_find(text) from public, anon, authenticated;

-- everyone on the site by username only: no real names, emails or online status
create or replace function public.people_list(p_q text default '', p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); q text := lower(trim(coalesce(p_q, '')));
begin
  if me is null then raise exception 'Not signed in'; end if;
  return (
    with everyone as (
      select p.id, public.game_nick(p.id) as nick, coalesce(g.nick, '') <> '' as named
      from public.profiles p left join public.game_profiles g on g.user_id = p.id
      where p.id <> me and not coalesce(p.suspended, false)
    ), found as (
      select * from everyone where q = '' or strpos(lower(nick), q) > 0
    ), page as (
      select * from found order by named desc, lower(nick) limit 30 offset greatest(0, coalesce(p_offset, 0))
    )
    select jsonb_build_object(
      'total', (select count(*) from found),
      'people', coalesce((select jsonb_agg(jsonb_build_object('nick', x.nick, 'named', x.named, 'state',
          case when f.status = 'accepted' then 'friend' when f.requested_by = me then 'sent' when f.status = 'pending' then 'incoming' else 'none' end)
          order by x.named desc, lower(x.nick))
        from page x left join public.friendships f on f.a = least(me, x.id) and f.b = greatest(me, x.id)), '[]'::jsonb)));
end $$;

-- friend chats reuse the community tables; dm_key marks them
alter table public.chats add column if not exists dm_key text;
create unique index if not exists chats_dm_key_idx on public.chats (dm_key) where dm_key is not null;
alter table public.chat_members add column if not exists silenced boolean not null default false;

-- nobody else can ever be put into a friend chat (not even an admin)
create or replace function public.chat_dm_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare k text;
begin
  select dm_key into k from public.chats where id = new.chat_id;
  if k is not null and strpos(k, new.user_id::text) = 0 then raise exception 'This is a private conversation'; end if;
  return new;
end $$;
drop trigger if exists chat_dm_guard on public.chat_members;
create trigger chat_dm_guard before insert or update of chat_id, user_id on public.chat_members
  for each row execute function public.chat_dm_guard();

-- writing in a friend chat stops when the friendship ends
create or replace function public.chat_can_post(p_chat uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.chat_members m join public.chats c on c.id = m.chat_id
                 where m.chat_id = p_chat and m.user_id = auth.uid() and not m.muted and (not c.closed or public.chat_is_admin())
                   and (c.dm_key is null or exists (select 1 from public.friendships f
                        where f.status = 'accepted' and f.a::text || ':' || f.b::text = c.dm_key)));
$$;

create or replace function public.chat_is_dm(p_chat uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.chats c where c.id = p_chat and c.dm_key is not null);
$$;
revoke all on function public.chat_is_dm(uuid) from public, anon;
grant execute on function public.chat_is_dm(uuid) to authenticated;

drop policy if exists "chat files read" on storage.objects;
create policy "chat files read" on storage.objects for select to authenticated
  using (bucket_id = 'chat' and (public.chat_is_member(public.chat_of_file(name))
         or (public.chat_is_admin() and not public.chat_is_dm(public.chat_of_file(name)))));

-- the community list never shows friend chats
create or replace function public.chat_list() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); adm boolean := public.chat_is_admin();
begin
  if me is null then raise exception 'Not signed in'; end if;
  return jsonb_build_object('admin', adm, 'nick', public.game_nick(me),
    'chats', coalesce((select jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'description', c.description, 'visibility', c.visibility, 'closed', c.closed,
        'joined', m.user_id is not null, 'muted', coalesce(m.muted, false),
        'members', (select count(*) from public.chat_members x where x.chat_id = c.id),
        'unread', case when m.user_id is null then 0 else (select count(*) from (select 1 from public.chat_messages g where g.chat_id = c.id and g.created_at > m.last_read_at and g.user_id <> me and not g.deleted limit 100) u) end,
        'last', (select case when g.deleted then 'Message deleted' when g.kind = 'text' then left(g.body, 60) when g.kind = 'image' then 'Photo' when g.kind = 'voice' then 'Voice message' else 'File' end from public.chat_messages g where g.chat_id = c.id order by g.id desc limit 1)
      ) order by c.last_message_at desc nulls last, c.created_at desc)
      from public.chats c left join public.chat_members m on m.chat_id = c.id and m.user_id = me
      where c.dm_key is null and (c.visibility = 'public' or m.user_id is not null or adm)), '[]'::jsonb));
end $$;

create or replace function public.dm_open(p_username text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); other uuid := public.friend_find(p_username); k text; cid uuid;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if other is null or not exists (select 1 from public.friendships where a = least(me, other) and b = greatest(me, other) and status = 'accepted') then
    return jsonb_build_object('error', 'notfriend');
  end if;
  k := least(me, other)::text || ':' || greatest(me, other)::text;
  insert into public.chats (name, visibility, created_by, dm_key) values ('Direct message', 'private', me, k)
    on conflict (dm_key) where dm_key is not null do nothing;
  select id into cid from public.chats where dm_key = k;
  insert into public.chat_members (chat_id, user_id) values (cid, me), (cid, other) on conflict do nothing;
  return jsonb_build_object('chatId', cid, 'silenced', (select silenced from public.chat_members where chat_id = cid and user_id = me));
end $$;

-- my friend chats: unread count and mute, for the badges
create or replace function public.dm_list() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('chatId', c.id, 'nick', public.game_nick(o.user_id), 'silenced', m.silenced,
      'unread', (select count(*) from (select 1 from public.chat_messages g where g.chat_id = c.id and g.created_at > m.last_read_at and g.user_id <> m.user_id and not g.deleted limit 100) u),
      'lastId', coalesce((select max(g.id) from public.chat_messages g where g.chat_id = c.id and g.user_id <> m.user_id), 0))), '[]'::jsonb)
  from public.chat_members m
  join public.chats c on c.id = m.chat_id and c.dm_key is not null
  join public.chat_members o on o.chat_id = c.id and o.user_id <> m.user_id
  where m.user_id = auth.uid()
    and exists (select 1 from public.friendships f where f.status = 'accepted' and f.a::text || ':' || f.b::text = c.dm_key);
$$;

create or replace function public.dm_silence(p_chat uuid, p_silenced boolean) returns void
language sql security definer set search_path = '' as $$
  update public.chat_members set silenced = coalesce(p_silenced, false)
  where chat_id = p_chat and user_id = auth.uid() and public.chat_is_dm(p_chat);
$$;

do $$
declare f text;
begin
  foreach f in array array['public.people_list(text, int)', 'public.dm_open(text)', 'public.dm_list()', 'public.dm_silence(uuid, boolean)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
revoke all on function public.chat_dm_guard() from public, anon, authenticated;
