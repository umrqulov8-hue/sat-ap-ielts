-- Lobby presence and automatic cleanup (2026-11-29). Run after 20261128_games.sql. Idempotent.

alter table public.game_match_players add column if not exists last_seen timestamptz not null default now();

-- "online" = the player's game page asked the server something in the last 150 seconds
-- (open pages ask every few seconds; hidden browser tabs may slow down to once a minute).
create or replace function public.game_cleanup() returns void
language plpgsql security definer set search_path = '' as $$
declare m record; heir uuid; gone constant interval := interval '150 seconds';
begin
  for m in select * from public.game_matches where status = 'lobby' for update skip locked loop
    -- people who closed the page free their seat (the host is handled below)
    delete from public.game_match_players where match_id = m.id and user_id <> m.host and last_seen < now() - gone;
    if m.created_at < now() - interval '1 hour' then
      delete from public.game_matches where id = m.id;
    elsif not exists (select 1 from public.game_match_players where match_id = m.id and user_id = m.host and last_seen >= now() - gone) then
      -- owner is away: hand the lobby to the longest-waiting player still here, or close it
      select user_id into heir from public.game_match_players where match_id = m.id and user_id <> m.host and last_seen >= now() - gone order by joined_at limit 1;
      if heir is null then
        delete from public.game_matches where id = m.id;
      else
        delete from public.game_match_players where match_id = m.id and user_id = m.host;
        update public.game_matches set host = heir where id = m.id;
      end if;
    end if;
  end loop;
  -- a running match nobody is attending any more is finished
  update public.game_matches g set status = 'done'
   where g.status = 'playing' and g.started_at < now() - interval '3 minutes'
     and not exists (select 1 from public.game_match_players p where p.match_id = g.id and not p.finished and p.last_seen >= now() - gone);
end $$;
revoke all on function public.game_cleanup() from public, anon, authenticated;

create or replace function public.game_list_matches() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  -- being on the games page keeps my own lobby alive
  update public.game_match_players p set last_seen = now() from public.game_matches g where g.id = p.match_id and g.status = 'lobby' and p.user_id = auth.uid() and g.host = auth.uid();
  perform public.game_cleanup();
  return coalesce((select jsonb_agg(public.game_match_json(m, false) order by m.created_at desc)
    from (select * from public.game_matches where status in ('lobby', 'playing') and created_at > now() - interval '1 hour' order by created_at desc limit 30) m), '[]'::jsonb);
end $$;

create or replace function public.game_get_match(p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare m public.game_matches;
begin
  update public.game_match_players set last_seen = now() where match_id = p_id and user_id = auth.uid();
  perform public.game_cleanup();
  select * into m from public.game_matches where id = p_id;
  if not found or not exists (select 1 from public.game_match_players where match_id = p_id and user_id = auth.uid()) then raise exception 'missing'; end if;
  return public.game_match_json(m, true);
end $$;

create or replace function public.game_join_match(p_key text, p_password text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m public.game_matches; joined boolean;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  update public.game_match_players set last_seen = now() where user_id = auth.uid();
  perform public.game_cleanup();
  select * into m from public.game_matches
   where (code = upper(trim(p_key)) or id::text = trim(p_key)) and created_at > now() - interval '48 hours' for update;
  if not found then return jsonb_build_object('error', case when length(trim(p_key)) = 6 then 'notfound' else 'format' end); end if;
  joined := exists (select 1 from public.game_match_players where match_id = m.id and user_id = auth.uid());
  if not joined then
    if m.status <> 'lobby' then return jsonb_build_object('error', 'started'); end if;
    if (select count(*) from public.game_match_players where match_id = m.id) >= m.max_players then return jsonb_build_object('error', 'full'); end if;
    if m.visibility = 'private' and m.password_hash is distinct from md5(m.id::text || coalesce(p_password, '')) then
      perform pg_sleep(0.4);
      return jsonb_build_object('error', case when coalesce(p_password, '') = '' then 'needpass' else 'wrongpass' end,
        'match', (public.game_match_json(m, false) - 'players') || jsonb_build_object('players', '[]'::jsonb));
    end if;
    insert into public.game_match_players (match_id, user_id, nick) values (m.id, auth.uid(), public.game_nick(auth.uid()));
  end if;
  return jsonb_build_object('match', public.game_match_json(m, true));
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.game_list_matches()', 'public.game_get_match(uuid)', 'public.game_join_match(text, text)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
