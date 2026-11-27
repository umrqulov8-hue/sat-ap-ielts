-- Games (2026-11-28): scores, weekly leaderboard and multiplayer matches. Idempotent.

-- 1. Nickname + leaderboard opt-in ----------------------------------------------------
create table if not exists public.game_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  opt_in boolean not null default false,
  nick text not null default '' check (nick = '' or nick ~ '^[A-Za-z0-9._]{3,20}$'),
  updated_at timestamptz not null default now()
);
create unique index if not exists game_profiles_nick_idx on public.game_profiles (lower(nick)) where nick <> '';
alter table public.game_profiles enable row level security;
drop policy if exists "Own game profile" on public.game_profiles;
create policy "Own game profile" on public.game_profiles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 2. Solo runs -------------------------------------------------------------------------
create table if not exists public.game_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game text not null check (game in ('speed', 'survival')),
  mode int not null default 0 check (mode in (0, 60, 120, 180)),
  score int not null check (score between 0 and 100000),
  correct int not null default 0,
  reached int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists game_runs_user_idx on public.game_runs (user_id, created_at desc);
create index if not exists game_runs_week_idx on public.game_runs (created_at);
alter table public.game_runs enable row level security;
drop policy if exists "Own runs read" on public.game_runs;
create policy "Own runs read" on public.game_runs for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Own runs write" on public.game_runs;
create policy "Own runs write" on public.game_runs for insert to authenticated with check (user_id = (select auth.uid()));

-- 3. Matches. Tables are closed to direct access; everything goes through the functions below. ----
create table if not exists public.game_matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  host uuid not null references auth.users(id) on delete cascade,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  password_hash text,
  max_players int not null check (max_players between 2 and 20),
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'done')),
  question_ids jsonb not null,
  created_at timestamptz not null default now(),
  started_at timestamptz
);
create table if not exists public.game_match_players (
  match_id uuid not null references public.game_matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nick text not null,
  joined_at timestamptz not null default now(),
  answered int not null default 0,
  points int not null default 0,
  right_count int not null default 0,
  per jsonb not null default '[]'::jsonb,
  finished boolean not null default false,
  primary key (match_id, user_id)
);
alter table public.game_matches enable row level security;
alter table public.game_match_players enable row level security;

-- the name others see: the chosen nickname, otherwise a neutral tag (never the real name or email)
create or replace function public.game_nick(u uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select nullif(g.nick, '') from public.game_profiles g where g.user_id = u), 'player_' || substr(md5(u::text), 1, 5));
$$;
revoke all on function public.game_nick(uuid) from public, anon, authenticated;

create or replace function public.game_week_start() returns timestamptz
language sql stable set search_path = '' as $$
  select date_trunc('week', now() at time zone 'Asia/Tashkent') at time zone 'Asia/Tashkent';
$$;

create or replace function public.game_match_json(m public.game_matches, with_questions boolean) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', m.id, 'code', m.code, 'name', m.name, 'visibility', m.visibility, 'maxPlayers', m.max_players, 'status', m.status,
    'host', public.game_nick(m.host), 'isHost', m.host = auth.uid(),
    'createdAt', floor(extract(epoch from m.created_at) * 1000), 'startedAt', floor(extract(epoch from m.started_at) * 1000),
    'questionIds', case when with_questions then m.question_ids else null end,
    'players', coalesce((select jsonb_agg(jsonb_build_object(
        'nick', p.nick, 'me', p.user_id = auth.uid(), 'host', p.user_id = m.host,
        'answered', p.answered, 'points', p.points, 'right', p.right_count, 'finished', p.finished,
        -- other players' answers are only revealed once you have finished too
        'per', case when p.user_id = auth.uid() or exists (select 1 from public.game_match_players x where x.match_id = m.id and x.user_id = auth.uid() and x.finished) then p.per else '[]'::jsonb end
      ) order by p.joined_at) from public.game_match_players p where p.match_id = m.id), '[]'::jsonb));
$$;
revoke all on function public.game_match_json(public.game_matches, boolean) from public, anon, authenticated;

create or replace function public.game_list_matches() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  return coalesce((select jsonb_agg(public.game_match_json(m, false) order by m.created_at desc)
    from (select * from public.game_matches where status in ('lobby', 'playing') and created_at > now() - interval '1 hour' order by created_at desc limit 30) m), '[]'::jsonb);
end $$;

create or replace function public.game_create_match(p_name text, p_visibility text, p_password text, p_max int, p_questions jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m public.game_matches; c text; i int; abc constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) <> 10 then raise exception 'A match needs 10 questions'; end if;
  if p_visibility = 'private' and length(coalesce(p_password, '')) not between 4 and 12 then raise exception 'Password must be 4 to 12 characters'; end if;
  if (select count(*) from public.game_matches where host = auth.uid() and created_at > now() - interval '1 hour') >= 20 then raise exception 'Too many matches, try later'; end if;
  loop
    c := '';
    for i in 1..6 loop c := c || substr(abc, 1 + floor(random() * length(abc))::int, 1); end loop;
    exit when not exists (select 1 from public.game_matches where code = c);
  end loop;
  insert into public.game_matches (code, name, host, visibility, max_players, question_ids)
  values (c, left(coalesce(nullif(trim(p_name), ''), public.game_nick(auth.uid()) || '’s match'), 28), auth.uid(),
          case when p_visibility = 'private' then 'private' else 'public' end, greatest(2, least(20, p_max)), p_questions)
  returning * into m;
  if m.visibility = 'private' then
    update public.game_matches set password_hash = md5(m.id::text || p_password) where id = m.id returning * into m;
  end if;
  insert into public.game_match_players (match_id, user_id, nick) values (m.id, auth.uid(), public.game_nick(auth.uid()));
  return public.game_match_json(m, true);
end $$;

create or replace function public.game_join_match(p_key text, p_password text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m public.game_matches; joined boolean;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into m from public.game_matches
   where (code = upper(trim(p_key)) or id::text = trim(p_key)) and created_at > now() - interval '48 hours' for update;
  if not found then return jsonb_build_object('error', case when length(trim(p_key)) = 6 then 'notfound' else 'format' end); end if;
  joined := exists (select 1 from public.game_match_players where match_id = m.id and user_id = auth.uid());
  if not joined then
    if m.status <> 'lobby' then return jsonb_build_object('error', 'started'); end if;
    if (select count(*) from public.game_match_players where match_id = m.id) >= m.max_players then return jsonb_build_object('error', 'full'); end if;
    if m.visibility = 'private' and m.password_hash is distinct from md5(m.id::text || coalesce(p_password, '')) then
      perform pg_sleep(0.4);
      return jsonb_build_object('error', case when coalesce(p_password, '') = '' then 'needpass' else 'wrongpass' end, 'match', public.game_match_json(m, false) - 'players' || jsonb_build_object('players', '[]'::jsonb));
    end if;
    insert into public.game_match_players (match_id, user_id, nick) values (m.id, auth.uid(), public.game_nick(auth.uid()));
  end if;
  return jsonb_build_object('match', public.game_match_json(m, true));
end $$;

create or replace function public.game_get_match(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare m public.game_matches;
begin
  select * into m from public.game_matches where id = p_id;
  if not found or not exists (select 1 from public.game_match_players where match_id = p_id and user_id = auth.uid()) then raise exception 'missing'; end if;
  return public.game_match_json(m, true);
end $$;

create or replace function public.game_start_match(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m public.game_matches;
begin
  select * into m from public.game_matches where id = p_id and host = auth.uid() for update;
  if not found then raise exception 'Only the host can start'; end if;
  if (select count(*) from public.game_match_players where match_id = p_id) < 2 then raise exception 'Need two players'; end if;
  if m.status = 'lobby' then update public.game_matches set status = 'playing', started_at = now() where id = p_id returning * into m; end if;
  return public.game_match_json(m, true);
end $$;

create or replace function public.game_leave_match(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.game_matches where id = p_id and host = auth.uid() and status = 'lobby') then
    delete from public.game_matches where id = p_id;
  else
    delete from public.game_match_players p using public.game_matches m
     where p.match_id = p_id and p.user_id = auth.uid() and m.id = p.match_id and m.status = 'lobby';
  end if;
end $$;

-- progress during play and the final result use the same function; scores are recomputed from the answer list
create or replace function public.game_push_answers(p_id uuid, p_per jsonb, p_finished boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m public.game_matches;
begin
  select * into m from public.game_matches where id = p_id;
  if not found or m.status = 'lobby' then raise exception 'missing'; end if;
  if jsonb_typeof(p_per) <> 'array' or jsonb_array_length(p_per) > 10 then raise exception 'Bad answers'; end if;
  update public.game_match_players set
    per = p_per,
    answered = jsonb_array_length(p_per),
    right_count = (select count(*) from jsonb_array_elements(p_per) a where a ->> 'correct' = 'true'),
    points = (select coalesce(sum(case when a ->> 'correct' = 'true' then 100 + greatest(0, least(45, coalesce((a ->> 'left')::numeric, 0)))::int else 0 end), 0) from jsonb_array_elements(p_per) a),
    finished = p_finished
  where match_id = p_id and user_id = auth.uid() and not finished;
  if not exists (select 1 from public.game_match_players where match_id = p_id and not finished) then
    update public.game_matches set status = 'done' where id = p_id returning * into m;
  end if;
  return public.game_match_json(m, true);
end $$;

-- matches a user won (sole top score or tied top, with at least one opponent) since a moment
create or replace function public.game_wins(u uuid, since timestamptz) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.game_match_players me
  join public.game_matches m on m.id = me.match_id
  where me.user_id = u and me.finished and me.points > 0 and m.created_at >= since
    and (m.status = 'done' or m.started_at < now() - interval '20 minutes')
    and (select count(*) from public.game_match_players x where x.match_id = m.id and x.finished) >= 2
    and not exists (select 1 from public.game_match_players x where x.match_id = m.id and x.points > me.points);
$$;
revoke all on function public.game_wins(uuid, timestamptz) from public, anon, authenticated;

create or replace function public.game_my_wins() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('total', public.game_wins(auth.uid(), '-infinity'), 'week', public.game_wins(auth.uid(), public.game_week_start()));
$$;

-- this week's board: opted-in players only
create or replace function public.game_leaderboard(p_mode int default 60)
returns table (nick text, me boolean, speed int, speed60 int, survival int, duel_wins int, overall int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  return query
  with who as (select g.user_id, g.nick as n from public.game_profiles g where g.opt_in and g.nick <> ''),
  best as (
    select w.user_id, w.n,
      coalesce(max(r.score) filter (where r.game = 'speed' and r.mode = p_mode), 0)::int as sp,
      coalesce(max(r.score) filter (where r.game = 'speed' and r.mode = 60), 0)::int as sp60,
      coalesce(max(r.score) filter (where r.game = 'survival'), 0)::int as sv,
      public.game_wins(w.user_id, public.game_week_start()) as dw
    from who w left join public.game_runs r on r.user_id = w.user_id and r.created_at >= public.game_week_start()
    group by w.user_id, w.n)
  select b.n, b.user_id = auth.uid(), b.sp, b.sp60, b.sv, b.dw, b.sp60 + b.sv + 150 * b.dw from best b
  where b.sp60 + b.sp + b.sv + b.dw > 0 or b.user_id = auth.uid()
  limit 500;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.game_week_start()', 'public.game_list_matches()', 'public.game_create_match(text, text, text, int, jsonb)',
    'public.game_join_match(text, text)', 'public.game_get_match(uuid)', 'public.game_start_match(uuid)', 'public.game_leave_match(uuid)',
    'public.game_push_answers(uuid, jsonb, boolean)', 'public.game_my_wins()', 'public.game_leaderboard(int)']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
