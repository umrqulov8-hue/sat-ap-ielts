-- Friends page extras (2026-12-02): stats, friends' leaderboard, activity, recent opponents, quick messages.
-- Run after 20261201_friends.sql. Idempotent.

create table if not exists public.friend_nudges (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('play', 'study', 'gg')),
  created_at timestamptz not null default now()
);
create index if not exists friend_nudges_to_idx on public.friend_nudges (to_user, created_at);
alter table public.friend_nudges enable row level security;

-- preset messages only (no free text), at most one every 30 seconds to the same friend
create or replace function public.friend_nudge(p_username text, p_kind text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); other uuid := public.friend_find(p_username);
begin
  if me is null then raise exception 'Not signed in'; end if;
  if other is null or not exists (select 1 from public.friendships where a = least(me, other) and b = greatest(me, other) and status = 'accepted') then return jsonb_build_object('error', 'notfriend'); end if;
  if p_kind not in ('play', 'study', 'gg') then return jsonb_build_object('error', 'kind'); end if;
  if exists (select 1 from public.friend_nudges where from_user = me and to_user = other and created_at > now() - interval '30 seconds') then return jsonb_build_object('error', 'slow'); end if;
  delete from public.friend_nudges where created_at < now() - interval '1 day';
  insert into public.friend_nudges (from_user, to_user, kind) values (me, other, p_kind);
  return jsonb_build_object('ok', true);
end $$;

-- messages waiting for me, each delivered once
create or replace function public.friend_nudges_take() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); result jsonb;
begin
  if me is null then raise exception 'Not signed in'; end if;
  with gone as (delete from public.friend_nudges where to_user = me returning from_user, kind, created_at)
  select coalesce(jsonb_agg(jsonb_build_object('from', public.game_nick(from_user), 'kind', kind) order by created_at), '[]'::jsonb) into result
    from gone where created_at > now() - interval '1 day';
  return result;
end $$;

create or replace function public.friend_stats(u uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'speed', coalesce((select max(score) from public.game_runs where user_id = u and game = 'speed' and mode = 60), 0),
    'survival', coalesce((select max(score) from public.game_runs where user_id = u and game = 'survival'), 0),
    'duelWins', public.game_wins(u, '-infinity'),
    'week', coalesce((select max(score) from public.game_runs where user_id = u and game = 'speed' and mode = 60 and created_at >= public.game_week_start()), 0)
          + coalesce((select max(score) from public.game_runs where user_id = u and game = 'survival' and created_at >= public.game_week_start()), 0)
          + 150 * public.game_wins(u, public.game_week_start()));
$$;
revoke all on function public.friend_stats(uuid) from public, anon, authenticated;

create or replace function public.friends_hub() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); ids uuid[];
begin
  if me is null then raise exception 'Not signed in'; end if;
  select coalesce(array_agg(case when a = me then b else a end), '{}') into ids from public.friendships where (a = me or b = me) and status = 'accepted';
  return jsonb_build_object(
    'me', public.friend_stats(me),
    'friends', coalesce((select jsonb_agg(public.friend_stats(f.id) || jsonb_build_object(
          'nick', public.game_nick(f.id),
          'lastSeen', (select floor(extract(epoch from now() - p.last_seen)) from public.user_presence p where p.user_id = f.id),
          'h2h', (select jsonb_build_object('wins', count(*) filter (where x.points > y.points), 'losses', count(*) filter (where x.points < y.points), 'draws', count(*) filter (where x.points = y.points))
                  from public.game_match_players x join public.game_match_players y on y.match_id = x.match_id and y.user_id = f.id
                  where x.user_id = me and x.finished and y.finished)))
        from unnest(ids) as f(id)), '[]'::jsonb),
    'feed', coalesce((select jsonb_agg(jsonb_build_object('nick', public.game_nick(r.user_id), 'game', r.game, 'mode', r.mode, 'score', r.score, 'age', floor(extract(epoch from now() - r.created_at))) order by r.created_at desc)
        from (select * from public.game_runs where user_id = any(ids) and score > 0 and created_at > now() - interval '7 days' order by created_at desc limit 25) r), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(public.game_nick(o.user_id))
        from (select distinct y.user_id from public.game_match_players x
              join public.game_match_players y on y.match_id = x.match_id and y.user_id <> me
              join public.game_profiles g on g.user_id = y.user_id and g.nick <> ''
              join public.game_matches m on m.id = x.match_id and m.created_at > now() - interval '14 days'
              where x.user_id = me
                and not exists (select 1 from public.friendships f where f.a = least(me, y.user_id) and f.b = greatest(me, y.user_id))
              limit 5) o), '[]'::jsonb));
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.friend_nudge(text, text)', 'public.friend_nudges_take()', 'public.friends_hub()'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
