-- Friends, online status and duel invites (2026-12-01). Run after 20261129_games_lobbies.sql. Idempotent.
-- Also contains the owner-away rule of 20261130, so that file does not need to be run separately.

create table if not exists public.user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen timestamptz not null default now(),
  activity text not null default ''
);
create table if not exists public.friendships (
  a uuid not null references auth.users(id) on delete cascade,
  b uuid not null references auth.users(id) on delete cascade,
  requested_by uuid not null,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);
create index if not exists friendships_b_idx on public.friendships (b);
create table if not exists public.game_invites (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  match_id uuid not null references public.game_matches(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);
create index if not exists game_invites_to_idx on public.game_invites (to_user, status);
-- closed to direct access: everything goes through the functions below
alter table public.user_presence enable row level security;
alter table public.friendships enable row level security;
alter table public.game_invites enable row level security;

create or replace function public.game_cleanup() returns void
language plpgsql security definer set search_path = '' as $$
declare m record; waiting int; gone constant interval := interval '150 seconds';
begin
  for m in select * from public.game_matches where status = 'lobby' for update skip locked loop
    delete from public.game_match_players where match_id = m.id and user_id <> m.host and last_seen < now() - gone;
    if m.created_at < now() - interval '1 hour' then
      delete from public.game_matches where id = m.id;
    elsif not exists (select 1 from public.game_match_players where match_id = m.id and user_id = m.host and last_seen >= now() - gone) then
      -- owner away: two or more waiting players start the match, otherwise the lobby closes
      select count(*) into waiting from public.game_match_players where match_id = m.id and user_id <> m.host;
      if waiting >= 2 then
        delete from public.game_match_players where match_id = m.id and user_id = m.host;
        update public.game_matches set status = 'playing', started_at = now() where id = m.id;
      else
        delete from public.game_matches where id = m.id;
      end if;
    end if;
  end loop;
  update public.game_matches g set status = 'done'
   where g.status = 'playing' and g.started_at < now() - interval '3 minutes'
     and not exists (select 1 from public.game_match_players p where p.match_id = g.id and not p.finished and p.last_seen >= now() - gone);
end $$;
revoke all on function public.game_cleanup() from public, anon, authenticated;

create or replace function public.friend_find(p_username text) returns uuid
language sql stable security definer set search_path = '' as $$
  select g.user_id from public.game_profiles g where g.nick <> '' and lower(g.nick) = lower(trim(p_username)) limit 1;
$$;
revoke all on function public.friend_find(text) from public, anon, authenticated;

create or replace function public.friend_send(p_username text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); other uuid; f public.friendships;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if not exists (select 1 from public.game_profiles where user_id = me and nick <> '') then return jsonb_build_object('error', 'nick'); end if;
  other := public.friend_find(p_username);
  if other is null then return jsonb_build_object('error', 'notfound'); end if;
  if other = me then return jsonb_build_object('error', 'self'); end if;
  select * into f from public.friendships where a = least(me, other) and b = greatest(me, other);
  if found then
    if f.status = 'accepted' then return jsonb_build_object('error', 'already'); end if;
    if f.requested_by = me then return jsonb_build_object('error', 'sent'); end if;
    update public.friendships set status = 'accepted' where a = f.a and b = f.b;
    return jsonb_build_object('ok', 'accepted');
  end if;
  if (select count(*) from public.friendships where requested_by = me and status = 'pending') >= 30 then return jsonb_build_object('error', 'limit'); end if;
  insert into public.friendships (a, b, requested_by) values (least(me, other), greatest(me, other), me);
  return jsonb_build_object('ok', 'sent');
end $$;

create or replace function public.friend_respond(p_username text, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); other uuid := public.friend_find(p_username);
begin
  if me is null or other is null then return; end if;
  if p_accept then
    update public.friendships set status = 'accepted' where a = least(me, other) and b = greatest(me, other) and requested_by = other;
  else
    delete from public.friendships where a = least(me, other) and b = greatest(me, other) and status = 'pending';
  end if;
end $$;

create or replace function public.friend_remove(p_username text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); other uuid := public.friend_find(p_username);
begin
  if me is null or other is null then return; end if;
  delete from public.friendships where a = least(me, other) and b = greatest(me, other);
end $$;

-- one call every few seconds from every page: "I am here", and what is waiting for me
create or replace function public.friends_ping(p_activity text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); result jsonb;
begin
  if me is null then raise exception 'Not signed in'; end if;
  insert into public.user_presence (user_id, last_seen, activity) values (me, now(), left(coalesce(p_activity, ''), 40))
    on conflict (user_id) do update set last_seen = now(), activity = excluded.activity;
  -- being anywhere on the site keeps my own lobby alive
  update public.game_match_players p set last_seen = now() from public.game_matches g where g.id = p.match_id and g.status = 'lobby' and g.host = me and p.user_id = me;
  perform public.game_cleanup();
  delete from public.game_invites where created_at < now() - interval '10 minutes';
  result := jsonb_build_object(
    'username', coalesce((select nick from public.game_profiles where user_id = me), ''),
    'friends', coalesce((select jsonb_agg(jsonb_build_object('nick', public.game_nick(x.other), 'online', coalesce(p.last_seen > now() - interval '90 seconds', false), 'activity', coalesce(p.activity, ''))
          order by coalesce(p.last_seen > now() - interval '90 seconds', false) desc, public.game_nick(x.other))
        from (select case when a = me then b else a end as other from public.friendships where (a = me or b = me) and status = 'accepted') x
        left join public.user_presence p on p.user_id = x.other), '[]'::jsonb),
    'incoming', coalesce((select jsonb_agg(public.game_nick(requested_by) order by created_at desc) from public.friendships where (a = me or b = me) and status = 'pending' and requested_by <> me), '[]'::jsonb),
    'outgoing', coalesce((select jsonb_agg(public.game_nick(case when a = me then b else a end) order by created_at desc) from public.friendships where status = 'pending' and requested_by = me), '[]'::jsonb),
    'invites', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'from', public.game_nick(i.from_user), 'match', g.name, 'age', floor(extract(epoch from now() - i.created_at))) order by i.created_at desc)
        from public.game_invites i join public.game_matches g on g.id = i.match_id
        where i.to_user = me and i.status = 'pending' and g.status = 'lobby' and i.created_at > now() - interval '60 seconds'), '[]'::jsonb),
    'declined', coalesce((select jsonb_agg(public.game_nick(i.to_user)) from public.game_invites i where i.from_user = me and i.status = 'declined'), '[]'::jsonb));
  delete from public.game_invites where from_user = me and status = 'declined';
  return result;
end $$;

create or replace function public.invite_send(p_username text, p_match uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); other uuid := public.friend_find(p_username);
begin
  if me is null then raise exception 'Not signed in'; end if;
  if other is null or not exists (select 1 from public.friendships where a = least(me, other) and b = greatest(me, other) and status = 'accepted') then return jsonb_build_object('error', 'notfriend'); end if;
  if not exists (select 1 from public.game_matches m join public.game_match_players p on p.match_id = m.id and p.user_id = me where m.id = p_match and m.status = 'lobby') then return jsonb_build_object('error', 'closed'); end if;
  delete from public.game_invites where from_user = me and to_user = other;
  insert into public.game_invites (from_user, to_user, match_id) values (me, other, p_match);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.invite_answer(p_id uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); i public.game_invites; m public.game_matches;
begin
  if me is null then raise exception 'Not signed in'; end if;
  select * into i from public.game_invites where id = p_id and to_user = me and status = 'pending';
  if not found then return jsonb_build_object('error', 'closed'); end if;
  if not p_accept then
    update public.game_invites set status = 'declined' where id = p_id;
    return jsonb_build_object('ok', true);
  end if;
  select * into m from public.game_matches where id = i.match_id for update;
  if not found or m.status <> 'lobby' then return jsonb_build_object('error', 'closed'); end if;
  if not exists (select 1 from public.game_match_players where match_id = m.id and user_id = me) then
    if (select count(*) from public.game_match_players where match_id = m.id) >= m.max_players then return jsonb_build_object('error', 'full'); end if;
    insert into public.game_match_players (match_id, user_id, nick) values (m.id, me, public.game_nick(me));
  end if;
  update public.game_invites set status = 'accepted' where id = p_id;
  return jsonb_build_object('matchId', m.id);
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.friend_send(text)', 'public.friend_respond(text, boolean)', 'public.friend_remove(text)',
    'public.friends_ping(text)', 'public.invite_send(text, uuid)', 'public.invite_answer(uuid, boolean)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
