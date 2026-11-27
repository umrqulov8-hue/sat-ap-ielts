-- Duel: results only when everyone is finished or gone; spectating (2026-12-03).
-- Run after 20261202_friends_plus.sql. Idempotent.

alter table public.game_match_players add column if not exists q_started timestamptz;

-- During a match an open page asks the server every few seconds. 40 s of silence means the player is gone;
-- their unanswered questions count as zero. Ten minutes after the start the match is closed in any case.
create or replace function public.game_settle(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare m public.game_matches;
begin
  select * into m from public.game_matches where id = p_id for update;
  if not found or m.status <> 'playing' then return; end if;
  update public.game_match_players set finished = true
   where match_id = p_id and not finished
     and (m.started_at < now() - interval '10 minutes'
          or (m.started_at < now() - interval '45 seconds' and last_seen < now() - interval '40 seconds'));
  if not exists (select 1 from public.game_match_players where match_id = p_id and not finished) then
    update public.game_matches set status = 'done' where id = p_id;
  end if;
end $$;
revoke all on function public.game_settle(uuid) from public, anon, authenticated;

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
        'offline', p.last_seen < now() - interval '40 seconds',
        'qAgo', floor(extract(epoch from now() - coalesce(p.q_started, m.started_at))),
        -- other players' answers are only revealed once you have finished too
        'per', case when p.user_id = auth.uid() or exists (select 1 from public.game_match_players x where x.match_id = m.id and x.user_id = auth.uid() and x.finished) then p.per else '[]'::jsonb end
      ) order by p.joined_at) from public.game_match_players p where p.match_id = m.id), '[]'::jsonb));
$$;
revoke all on function public.game_match_json(public.game_matches, boolean) from public, anon, authenticated;

create or replace function public.game_get_match(p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare m public.game_matches;
begin
  update public.game_match_players set last_seen = now() where match_id = p_id and user_id = auth.uid();
  perform public.game_settle(p_id);
  perform public.game_cleanup();
  select * into m from public.game_matches where id = p_id;
  if not found or not exists (select 1 from public.game_match_players where match_id = p_id and user_id = auth.uid()) then raise exception 'missing'; end if;
  return public.game_match_json(m, true);
end $$;

create or replace function public.game_push_answers(p_id uuid, p_per jsonb, p_finished boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m public.game_matches;
begin
  select * into m from public.game_matches where id = p_id;
  if not found or m.status = 'lobby' then raise exception 'missing'; end if;
  if jsonb_typeof(p_per) <> 'array' or jsonb_array_length(p_per) > 10 then raise exception 'Bad answers'; end if;
  update public.game_match_players set
    q_started = case when jsonb_array_length(p_per) <> answered then now() else q_started end,
    last_seen = now(),
    per = p_per,
    answered = jsonb_array_length(p_per),
    right_count = (select count(*) from jsonb_array_elements(p_per) a where a ->> 'correct' = 'true'),
    points = (select coalesce(sum(case when a ->> 'correct' = 'true' then 100 + greatest(0, least(45, coalesce((a ->> 'left')::numeric, 0)))::int else 0 end), 0) from jsonb_array_elements(p_per) a),
    finished = p_finished
  where match_id = p_id and user_id = auth.uid() and not finished;
  perform public.game_settle(p_id);
  select * into m from public.game_matches where id = p_id;
  return public.game_match_json(m, true);
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.game_get_match(uuid)', 'public.game_push_answers(uuid, jsonb, boolean)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
