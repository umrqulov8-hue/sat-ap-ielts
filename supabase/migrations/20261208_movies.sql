-- Movies: watch rooms, SAT checkpoints, room chat and saved words (2026-12-08).
-- Run after 20261207_people_dm.sql. Idempotent.

create table if not exists public.movie_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host uuid not null references auth.users(id) on delete cascade,
  film text not null,
  title text not null,
  duration int not null default 0,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'quiz')),
  playing boolean not null default false,
  pos double precision not null default 0,
  pos_at timestamptz not null default now(),
  quiz jsonb,
  quiz_round int not null default 0,
  quiz_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.movie_members (
  room_id uuid not null references public.movie_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  round int not null default 0,
  answers jsonb not null default '[]'::jsonb,
  done boolean not null default true,
  primary key (room_id, user_id)
);
create table if not exists public.movie_messages (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.movie_rooms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('text', 'voice')),
  body text not null default '',
  path text,
  duration int,
  created_at timestamptz not null default now()
);
create index if not exists movie_messages_room_idx on public.movie_messages (room_id, id);
create table if not exists public.movie_invites (
  room_id uuid not null references public.movie_rooms(id) on delete cascade,
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  seen boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (room_id, to_user)
);
create table if not exists public.movie_words (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  word text not null check (length(word) between 1 and 80),
  film text not null default '' check (length(film) <= 200),
  created_at timestamptz not null default now(),
  primary key (user_id, word)
);

-- rooms are reached only through the functions below; saved words are each person's own
alter table public.movie_rooms enable row level security;
alter table public.movie_members enable row level security;
alter table public.movie_messages enable row level security;
alter table public.movie_invites enable row level security;
alter table public.movie_words enable row level security;
revoke all on public.movie_words from anon;
grant select, insert, update, delete on public.movie_words to authenticated;
drop policy if exists "own words" on public.movie_words;
create policy "own words" on public.movie_words for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create or replace function public.movie_is_member(p_room uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.movie_members m where m.room_id = p_room and m.user_id = auth.uid());
$$;

create or replace function public.movie_is_friend(a_user uuid, b_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.friendships f where f.a = least(a_user, b_user) and f.b = greatest(a_user, b_user) and f.status = 'accepted');
$$;
revoke all on function public.movie_is_friend(uuid, uuid) from public, anon, authenticated;

-- empty rooms disappear after 3 minutes; if the host is gone, someone present takes over
create or replace function public.movie_cleanup() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.movie_rooms r where r.created_at < now() - interval '3 minutes'
    and not exists (select 1 from public.movie_members m where m.room_id = r.id and m.last_seen > now() - interval '3 minutes');
  update public.movie_rooms r set host = (select m.user_id from public.movie_members m where m.room_id = r.id and m.last_seen > now() - interval '40 seconds' order by m.joined_at limit 1)
    where not exists (select 1 from public.movie_members m where m.room_id = r.id and m.user_id = r.host and m.last_seen > now() - interval '60 seconds')
      and exists (select 1 from public.movie_members m where m.room_id = r.id and m.last_seen > now() - interval '40 seconds');
  delete from public.movie_invites where created_at < now() - interval '15 minutes';
end $$;
revoke all on function public.movie_cleanup() from public, anon, authenticated;

-- the film goes on when everyone still present has finished the questions (or after 12 minutes)
create or replace function public.movie_settle(p_room uuid) returns void
language sql security definer set search_path = '' as $$
  update public.movie_rooms r set status = 'playing', playing = true, pos_at = now(), quiz = null
  where r.id = p_room and r.status = 'quiz'
    and (r.quiz_at < now() - interval '12 minutes'
      or not exists (select 1 from public.movie_members m where m.room_id = r.id and m.round = r.quiz_round and not m.done and m.last_seen > now() - interval '40 seconds'));
$$;
revoke all on function public.movie_settle(uuid) from public, anon, authenticated;

create or replace function public.movie_json(r public.movie_rooms) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', r.id, 'code', r.code, 'film', r.film, 'title', r.title, 'duration', r.duration, 'visibility', r.visibility,
    'status', r.status, 'playing', r.playing,
    'pos', r.pos + case when r.playing then extract(epoch from now() - r.pos_at) else 0 end,
    'isHost', r.host = auth.uid(), 'host', public.game_nick(r.host), 'quiz', r.quiz, 'quizRound', r.quiz_round,
    'members', coalesce((select jsonb_agg(jsonb_build_object('nick', public.game_nick(m.user_id), 'me', m.user_id = auth.uid(), 'host', m.user_id = r.host,
        'online', m.last_seen > now() - interval '40 seconds', 'round', m.round, 'done', m.done,
        -- other people's answers are shown only to those who have finished
        'answers', case when m.user_id = auth.uid() or exists (select 1 from public.movie_members x where x.room_id = r.id and x.user_id = auth.uid() and x.done) then m.answers else '[]'::jsonb end)
      order by m.joined_at) from public.movie_members m where m.room_id = r.id), '[]'::jsonb));
$$;
revoke all on function public.movie_json(public.movie_rooms) from public, anon, authenticated;

-- private rooms are listed without saying what is being watched
create or replace function public.movie_list() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Not signed in'; end if;
  perform public.movie_cleanup();
  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'visibility', x.visibility, 'open', x.open,
      'film', case when x.open then x.film else '' end, 'title', case when x.open then x.title else '' end,
      'host', public.game_nick(x.host), 'count', x.n, 'status', x.status,
      'pos', x.pos + case when x.playing then extract(epoch from now() - x.pos_at) else 0 end) order by x.created_at desc)
    from (select r.*, (select count(*) from public.movie_members m where m.room_id = r.id and m.last_seen > now() - interval '60 seconds') as n,
            (r.visibility = 'public' or public.movie_is_friend(r.host, me) or exists (select 1 from public.movie_members m where m.room_id = r.id and m.user_id = me)
             or exists (select 1 from public.movie_invites i where i.room_id = r.id and i.to_user = me)) as open
          from public.movie_rooms r) x
    where x.n > 0), '[]'::jsonb);
end $$;

create or replace function public.movie_create(p_film text, p_title text, p_duration int, p_visibility text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); rid uuid; c text;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if length(coalesce(p_film, '')) not between 3 and 240 then raise exception 'Bad film'; end if;
  delete from public.movie_members where user_id = me;
  loop
    c := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when not exists (select 1 from public.movie_rooms where code = c);
  end loop;
  insert into public.movie_rooms (code, host, film, title, duration, visibility)
  values (c, me, p_film, left(p_title, 160), greatest(0, least(coalesce(p_duration, 0), 36000)), case when p_visibility = 'private' then 'private' else 'public' end)
  returning id into rid;
  insert into public.movie_members (room_id, user_id) values (rid, me);
  return rid;
end $$;

-- join by room id or by code
create or replace function public.movie_join(p_room uuid default null, p_code text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); r public.movie_rooms; by_code boolean := false;
begin
  if me is null then raise exception 'Not signed in'; end if;
  perform public.movie_cleanup();
  if p_code is not null then
    select * into r from public.movie_rooms where code = upper(trim(p_code)) and (p_room is null or id = p_room) for update;
    by_code := found;
  else
    select * into r from public.movie_rooms where id = p_room for update;
  end if;
  if r.id is null then return jsonb_build_object('error', case when p_code is null then 'notfound' else 'code' end); end if;
  if not exists (select 1 from public.movie_members where room_id = r.id and user_id = me) then
    if r.visibility = 'private' and not by_code and not public.movie_is_friend(r.host, me)
       and not exists (select 1 from public.movie_invites where room_id = r.id and to_user = me) then
      return jsonb_build_object('error', 'private');
    end if;
    if (select count(*) from public.movie_members where room_id = r.id and last_seen > now() - interval '60 seconds') >= 10 then return jsonb_build_object('error', 'full'); end if;
    delete from public.movie_members where user_id = me;
    insert into public.movie_members (room_id, user_id, round) values (r.id, me, r.quiz_round);
  end if;
  return jsonb_build_object('roomId', r.id);
end $$;

create or replace function public.movie_leave(p_room uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); files jsonb;
begin
  -- my own voice files are returned so the page can remove them from storage
  select coalesce(jsonb_agg(path), '[]'::jsonb) into files from public.movie_messages where room_id = p_room and user_id = me and path is not null;
  delete from public.movie_members where room_id = p_room and user_id = me;
  if not exists (select 1 from public.movie_members where room_id = p_room) then
    delete from public.movie_rooms where id = p_room;
  else
    update public.movie_rooms set host = (select user_id from public.movie_members where room_id = p_room order by last_seen desc, joined_at limit 1) where id = p_room and host = me;
    perform public.movie_settle(p_room);
  end if;
  return files;
end $$;

create or replace function public.movie_get(p_room uuid, p_since bigint default 0) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); r public.movie_rooms;
begin
  update public.movie_members set last_seen = now() where room_id = p_room and user_id = me;
  if not found then return jsonb_build_object('error', 'gone'); end if;
  perform public.movie_cleanup();
  perform public.movie_settle(p_room);
  select * into r from public.movie_rooms where id = p_room;
  if not found then return jsonb_build_object('error', 'gone'); end if;
  return jsonb_build_object('room', public.movie_json(r),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'nick', public.game_nick(g.user_id), 'mine', g.user_id = me, 'kind', g.kind, 'body', g.body, 'path', g.path, 'duration', g.duration) order by g.id)
      from (select * from public.movie_messages where room_id = p_room and id > coalesce(p_since, 0) order by id desc limit 100) g), '[]'::jsonb));
end $$;

-- the host plays, pauses and seeks for everyone
create or replace function public.movie_control(p_room uuid, p_playing boolean, p_pos double precision) returns void
language sql security definer set search_path = '' as $$
  update public.movie_rooms set status = 'playing', playing = p_playing, pos = greatest(0, coalesce(p_pos, 0)), pos_at = now()
  where id = p_room and host = auth.uid() and status <> 'quiz';
$$;

create or replace function public.movie_quiz_start(p_room uuid, p_round int, p_quiz jsonb, p_pos double precision) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if length(p_quiz::text) > 2000 then raise exception 'Bad questions'; end if;
  update public.movie_rooms set status = 'quiz', playing = false, pos = greatest(0, p_pos), pos_at = now(), quiz = p_quiz, quiz_round = p_round, quiz_at = now()
  where id = p_room and host = auth.uid() and status = 'playing' and p_round > quiz_round;
  if found then
    update public.movie_members set round = p_round, answers = '[]'::jsonb, done = false
    where room_id = p_room and last_seen > now() - interval '40 seconds';
  end if;
end $$;

create or replace function public.movie_quiz_answer(p_room uuid, p_answers jsonb, p_done boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) > 6 then raise exception 'Bad answers'; end if;
  update public.movie_members m set answers = p_answers, done = p_done, last_seen = now()
  from public.movie_rooms r
  where r.id = p_room and m.room_id = r.id and m.user_id = auth.uid() and m.round = r.quiz_round and not m.done;
  perform public.movie_settle(p_room);
end $$;

create or replace function public.movie_send(p_room uuid, p_kind text, p_body text default '', p_path text default null, p_duration int default null) returns void
language plpgsql security definer set search_path = '' as $$
declare txt text := trim(coalesce(p_body, ''));
begin
  if not public.movie_is_member(p_room) then raise exception 'Not in this room'; end if;
  if p_kind not in ('text', 'voice') then raise exception 'Bad message'; end if;
  if p_kind = 'text' and txt = '' then raise exception 'Empty message'; end if;
  if p_kind = 'voice' and (p_path is null or p_path not like p_room::text || '/%') then raise exception 'Bad file'; end if;
  if (select count(*) from public.movie_messages where user_id = auth.uid() and created_at > now() - interval '10 seconds') >= 12 then raise exception 'slow'; end if;
  insert into public.movie_messages (room_id, user_id, kind, body, path, duration)
  values (p_room, auth.uid(), p_kind, left(txt, 500), case when p_kind = 'voice' then p_path end, p_duration);
end $$;

create or replace function public.movie_invite(p_room uuid, p_username text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); other uuid := public.friend_find(p_username);
begin
  if not public.movie_is_member(p_room) then return jsonb_build_object('error', 'closed'); end if;
  if other is null or not public.movie_is_friend(me, other) then return jsonb_build_object('error', 'notfriend'); end if;
  insert into public.movie_invites (room_id, from_user, to_user) values (p_room, me, other)
    on conflict (room_id, to_user) do update set from_user = excluded.from_user, seen = false, created_at = now();
  return jsonb_build_object('ok', true);
end $$;

-- invitations not yet shown to me, each delivered once
create or replace function public.movie_invites_take() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); result jsonb;
begin
  if me is null then raise exception 'Not signed in'; end if;
  perform public.movie_cleanup();
  with got as (update public.movie_invites set seen = true where to_user = me and not seen returning room_id, from_user)
  select coalesce(jsonb_agg(jsonb_build_object('roomId', got.room_id, 'from', public.game_nick(got.from_user), 'title', r.title)), '[]'::jsonb) into result
    from got join public.movie_rooms r on r.id = got.room_id;
  return result;
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.movie_is_member(uuid)', 'public.movie_list()', 'public.movie_create(text, text, int, text)', 'public.movie_join(uuid, text)',
    'public.movie_leave(uuid)', 'public.movie_get(uuid, bigint)', 'public.movie_control(uuid, boolean, double precision)',
    'public.movie_quiz_start(uuid, int, jsonb, double precision)', 'public.movie_quiz_answer(uuid, jsonb, boolean)',
    'public.movie_send(uuid, text, text, text, int)', 'public.movie_invite(uuid, text)', 'public.movie_invites_take()'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- voice messages: a private bucket, folder name = room id
insert into storage.buckets (id, name, public, file_size_limit)
values ('movie', 'movie', false, 3145728)
on conflict (id) do update set public = false, file_size_limit = 3145728;
drop policy if exists "movie voice read" on storage.objects;
create policy "movie voice read" on storage.objects for select to authenticated
  using (bucket_id = 'movie' and (public.movie_is_member(public.chat_of_file(name)) or owner_id = auth.uid()::text));
drop policy if exists "movie voice add" on storage.objects;
create policy "movie voice add" on storage.objects for insert to authenticated
  with check (bucket_id = 'movie' and public.movie_is_member(public.chat_of_file(name)));
drop policy if exists "movie voice remove" on storage.objects;
create policy "movie voice remove" on storage.objects for delete to authenticated
  using (bucket_id = 'movie' and owner_id = auth.uid()::text);
