-- Community chat (2026-12-04): public and private chats, replies, images, files, voice messages.
-- Run after 20261203_duel_wait_spectate.sql. Idempotent.

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  closed boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz
);
create table if not exists public.chat_members (
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  muted boolean not null default false,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);
create index if not exists chat_members_user_idx on public.chat_members (user_id);
create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null default 'text' check (kind in ('text', 'image', 'file', 'voice')),
  body text not null default '',
  reply_to bigint,
  file_path text,
  file_name text,
  file_size int,
  duration int,
  deleted boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create index if not exists chat_messages_chat_idx on public.chat_messages (chat_id, id desc);
create index if not exists chat_messages_sync_idx on public.chat_messages (chat_id, updated_at);
create table if not exists public.chat_reports (
  message_id bigint not null references public.chat_messages(id) on delete cascade,
  reporter uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, reporter)
);
-- closed to direct access: everything goes through the functions below
alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_reports enable row level security;

create or replace function public.chat_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'owner'));
$$;
create or replace function public.chat_is_member(p_chat uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.chat_members m where m.chat_id = p_chat and m.user_id = auth.uid());
$$;
-- the chat a stored file belongs to (first folder of its path), or null when the path is not one of ours
create or replace function public.chat_of_file(p_name text) returns uuid
language sql immutable set search_path = '' as $$
  select case when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then split_part(p_name, '/', 1)::uuid end;
$$;
grant execute on function public.chat_of_file(text) to authenticated;
-- may this person write (and upload) in this chat?
create or replace function public.chat_can_post(p_chat uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.chat_members m join public.chats c on c.id = m.chat_id
                 where m.chat_id = p_chat and m.user_id = auth.uid() and not m.muted and (not c.closed or public.chat_is_admin()));
$$;

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
      where c.visibility = 'public' or m.user_id is not null or adm), '[]'::jsonb));
end $$;

create or replace function public.chat_create(p_name text, p_description text, p_visibility text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  if not public.chat_is_admin() then raise exception 'Only admins can create chats'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Give the chat a name'; end if;
  insert into public.chats (name, description, visibility, created_by)
  values (left(trim(p_name), 60), left(coalesce(p_description, ''), 200), case when p_visibility = 'private' then 'private' else 'public' end, auth.uid())
  returning id into cid;
  insert into public.chat_members (chat_id, user_id) values (cid, auth.uid());
  return cid;
end $$;

create or replace function public.chat_update(p_chat uuid, p_name text, p_description text, p_visibility text, p_closed boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.chat_is_admin() then raise exception 'Only admins can change chats'; end if;
  update public.chats set name = left(coalesce(nullif(trim(p_name), ''), name), 60), description = left(coalesce(p_description, description), 200),
    visibility = case when p_visibility in ('public', 'private') then p_visibility else visibility end, closed = coalesce(p_closed, closed)
  where id = p_chat;
end $$;

-- returns the stored files so the page can remove them from storage too
create or replace function public.chat_delete(p_chat uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare paths jsonb;
begin
  if not public.chat_is_admin() then raise exception 'Only admins can delete chats'; end if;
  select coalesce(jsonb_agg(file_path), '[]'::jsonb) into paths from public.chat_messages where chat_id = p_chat and file_path is not null;
  delete from public.chats where id = p_chat;
  return paths;
end $$;

create or replace function public.chat_join(p_chat uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if not exists (select 1 from public.chats where id = p_chat and (visibility = 'public' or public.chat_is_admin())) then raise exception 'This chat is private'; end if;
  insert into public.chat_members (chat_id, user_id) values (p_chat, auth.uid()) on conflict do nothing;
end $$;

create or replace function public.chat_leave(p_chat uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.chat_members where chat_id = p_chat and user_id = auth.uid();
$$;

create or replace function public.chat_members_list(p_chat uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare adm boolean := public.chat_is_admin();
begin
  if not (adm or public.chat_is_member(p_chat)) then raise exception 'Not a member'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', case when adm then m.user_id else null end, 'nick', public.game_nick(m.user_id),
      'me', m.user_id = auth.uid(), 'muted', m.muted, 'admin', exists (select 1 from public.profiles p where p.id = m.user_id and p.role in ('admin', 'owner')))
    order by public.game_nick(m.user_id)) from public.chat_members m where m.chat_id = p_chat), '[]'::jsonb);
end $$;

-- add by username, or by the account's email address
create or replace function public.chat_add_member(p_chat uuid, p_who text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid;
begin
  if not public.chat_is_admin() then raise exception 'Only admins can add people'; end if;
  u := public.friend_find(p_who);
  if u is null then select id into u from auth.users where lower(email) = lower(trim(p_who)); end if;
  if u is null then return jsonb_build_object('error', 'notfound'); end if;
  insert into public.chat_members (chat_id, user_id) values (p_chat, u) on conflict do nothing;
  return jsonb_build_object('nick', public.game_nick(u));
end $$;

create or replace function public.chat_remove_member(p_chat uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.chat_is_admin() then raise exception 'Only admins can remove people'; end if;
  delete from public.chat_members where chat_id = p_chat and user_id = p_user;
end $$;

create or replace function public.chat_mute(p_chat uuid, p_user uuid, p_muted boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.chat_is_admin() then raise exception 'Only admins can mute'; end if;
  update public.chat_members set muted = p_muted where chat_id = p_chat and user_id = p_user;
end $$;

create or replace function public.chat_message_json(g public.chat_messages) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', g.id, 'mine', g.user_id = auth.uid(), 'nick', case when g.user_id is null then 'deleted user' else public.game_nick(g.user_id) end,
    'admin', exists (select 1 from public.profiles p where p.id = g.user_id and p.role in ('admin', 'owner')),
    'kind', g.kind, 'body', case when g.deleted then '' else g.body end, 'deleted', g.deleted,
    'path', case when g.deleted then null else g.file_path end, 'fileName', g.file_name, 'size', g.file_size, 'duration', g.duration,
    'at', floor(extract(epoch from g.created_at) * 1000),
    'reply', (select jsonb_build_object('id', r.id, 'nick', public.game_nick(r.user_id), 'text', case when r.deleted then 'Message deleted' when r.kind = 'text' then left(r.body, 80) when r.kind = 'image' then 'Photo' when r.kind = 'voice' then 'Voice message' else coalesce(r.file_name, 'File') end)
              from public.chat_messages r where r.id = g.reply_to and r.chat_id = g.chat_id));
$$;
revoke all on function public.chat_message_json(public.chat_messages) from public, anon, authenticated;

-- p_before: older history; p_since: everything new or changed after that moment; neither: the latest messages
create or replace function public.chat_fetch(p_chat uuid, p_since timestamptz default null, p_before bigint default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare list jsonb; stamp timestamptz := clock_timestamp() - interval '2 seconds';
begin
  if not public.chat_is_member(p_chat) then raise exception 'Not a member'; end if;
  if p_since is not null then
    select coalesce(jsonb_agg(public.chat_message_json(x) order by x.id), '[]'::jsonb) into list
      from (select * from public.chat_messages where chat_id = p_chat and updated_at > p_since order by updated_at limit 200) x;
  else
    select coalesce(jsonb_agg(public.chat_message_json(x) order by x.id), '[]'::jsonb) into list
      from (select * from public.chat_messages where chat_id = p_chat and (p_before is null or id < p_before) order by id desc limit 40) x;
  end if;
  if p_before is null and (p_since is null or jsonb_array_length(list) > 0) then
    update public.chat_members set last_read_at = now() where chat_id = p_chat and user_id = auth.uid();
  end if;
  return jsonb_build_object('now', stamp, 'messages', list,
    'state', (select jsonb_build_object('closed', c.closed, 'muted', m.muted) from public.chats c join public.chat_members m on m.chat_id = c.id and m.user_id = auth.uid() where c.id = p_chat));
end $$;

create or replace function public.chat_send(p_chat uuid, p_body text, p_reply bigint default null, p_kind text default 'text',
  p_path text default null, p_name text default null, p_size int default null, p_duration int default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g public.chat_messages; txt text := trim(coalesce(p_body, ''));
begin
  if not public.chat_can_post(p_chat) then raise exception 'You cannot write in this chat'; end if;
  if p_kind not in ('text', 'image', 'file', 'voice') then raise exception 'Bad message'; end if;
  if p_kind = 'text' and txt = '' then raise exception 'Empty message'; end if;
  if p_kind <> 'text' and (p_path is null or p_path not like p_chat::text || '/%') then raise exception 'Bad file'; end if;
  -- flood guard only, no daily or total limits
  if (select count(*) from public.chat_messages where user_id = auth.uid() and created_at > now() - interval '10 seconds') >= 15 then raise exception 'slow'; end if;
  insert into public.chat_messages (chat_id, user_id, kind, body, reply_to, file_path, file_name, file_size, duration)
  values (p_chat, auth.uid(), p_kind, left(txt, 4000), p_reply, case when p_kind = 'text' then null else p_path end, left(p_name, 200), p_size, p_duration)
  returning * into g;
  update public.chats set last_message_at = now() where id = p_chat;
  update public.chat_members set last_read_at = now() where chat_id = p_chat and user_id = auth.uid();
  return public.chat_message_json(g);
end $$;

create or replace function public.chat_delete_message(p_id bigint) returns text
language plpgsql security definer set search_path = '' as $$
declare g public.chat_messages;
begin
  select * into g from public.chat_messages where id = p_id;
  if not found then return null; end if;
  if not (public.chat_is_admin() or (g.user_id = auth.uid() and public.chat_is_member(g.chat_id))) then raise exception 'Not allowed'; end if;
  update public.chat_messages set deleted = true, body = '', file_path = null, file_size = null, updated_at = clock_timestamp() where id = p_id;
  delete from public.chat_reports where message_id = p_id;
  return g.file_path;
end $$;

create or replace function public.chat_report(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.chat_messages g where g.id = p_id and public.chat_is_member(g.chat_id)) then raise exception 'Not allowed'; end if;
  insert into public.chat_reports (message_id, reporter) values (p_id, auth.uid()) on conflict do nothing;
end $$;

create or replace function public.chat_reports_list() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.chat_is_admin() then raise exception 'Only admins'; end if;
  return jsonb_build_object(
    'storage', coalesce((select sum(file_size) from public.chat_messages where file_path is not null), 0),
    'reports', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'chat', c.name, 'chatId', c.id, 'nick', public.game_nick(g.user_id), 'kind', g.kind, 'text', left(g.body, 200), 'count', r.n) order by r.latest desc)
      from (select message_id, count(*) n, max(created_at) latest from public.chat_reports group by message_id) r
      join public.chat_messages g on g.id = r.message_id join public.chats c on c.id = g.chat_id), '[]'::jsonb));
end $$;

create or replace function public.chat_report_dismiss(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.chat_is_admin() then raise exception 'Only admins'; end if;
  delete from public.chat_reports where message_id = p_id;
end $$;

-- free storage: forget files older than p_days days (the texts stay)
create or replace function public.chat_clear_media(p_days int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare paths jsonb;
begin
  if not public.chat_is_admin() then raise exception 'Only admins'; end if;
  select coalesce(jsonb_agg(file_path), '[]'::jsonb) into paths from public.chat_messages where file_path is not null and created_at < now() - make_interval(days => greatest(7, p_days));
  update public.chat_messages set deleted = true, body = '', file_path = null, file_size = null, updated_at = clock_timestamp()
    where file_path is not null and created_at < now() - make_interval(days => greatest(7, p_days));
  return paths;
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.chat_is_admin()', 'public.chat_is_member(uuid)', 'public.chat_can_post(uuid)', 'public.chat_list()',
    'public.chat_create(text, text, text)', 'public.chat_update(uuid, text, text, text, boolean)', 'public.chat_delete(uuid)',
    'public.chat_join(uuid)', 'public.chat_leave(uuid)', 'public.chat_members_list(uuid)', 'public.chat_add_member(uuid, text)',
    'public.chat_remove_member(uuid, uuid)', 'public.chat_mute(uuid, uuid, boolean)', 'public.chat_fetch(uuid, timestamptz, bigint)',
    'public.chat_send(uuid, text, bigint, text, text, text, int, int)', 'public.chat_delete_message(bigint)', 'public.chat_report(bigint)',
    'public.chat_reports_list()', 'public.chat_report_dismiss(bigint)', 'public.chat_clear_media(int)']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- files: a private bucket; only members of a chat can read or add its files (folder name = chat id)
insert into storage.buckets (id, name, public, file_size_limit)
values ('chat', 'chat', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = 20971520;

drop policy if exists "chat files read" on storage.objects;
create policy "chat files read" on storage.objects for select to authenticated
  using (bucket_id = 'chat' and (public.chat_is_admin() or public.chat_is_member(public.chat_of_file(name))));
drop policy if exists "chat files add" on storage.objects;
create policy "chat files add" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat' and public.chat_can_post(public.chat_of_file(name)));
drop policy if exists "chat files remove" on storage.objects;
create policy "chat files remove" on storage.objects for delete to authenticated
  using (bucket_id = 'chat' and (public.chat_is_admin() or owner_id = auth.uid()::text));
