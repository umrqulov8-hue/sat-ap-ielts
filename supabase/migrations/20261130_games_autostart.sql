-- Owner-away rule (2026-11-30). Run after 20261129_games_lobbies.sql. Idempotent.
-- While the owner is anywhere on the site, only the owner starts the match.
-- Owner away: two or more players waiting -> the match starts by itself; fewer -> the lobby closes.

create or replace function public.game_cleanup() returns void
language plpgsql security definer set search_path = '' as $$
declare m record; waiting int; gone constant interval := interval '150 seconds';
begin
  for m in select * from public.game_matches where status = 'lobby' for update skip locked loop
    -- people who closed the page free their seat (the owner is handled below)
    delete from public.game_match_players where match_id = m.id and user_id <> m.host and last_seen < now() - gone;
    if m.created_at < now() - interval '1 hour' then
      delete from public.game_matches where id = m.id;
    elsif not exists (select 1 from public.game_match_players where match_id = m.id and user_id = m.host and last_seen >= now() - gone) then
      select count(*) into waiting from public.game_match_players where match_id = m.id and user_id <> m.host;
      if waiting >= 2 then
        delete from public.game_match_players where match_id = m.id and user_id = m.host;
        update public.game_matches set status = 'playing', started_at = now() where id = m.id;
      else
        delete from public.game_matches where id = m.id;
      end if;
    end if;
  end loop;
  -- a running match nobody is attending any more is finished
  update public.game_matches g set status = 'done'
   where g.status = 'playing' and g.started_at < now() - interval '3 minutes'
     and not exists (select 1 from public.game_match_players p where p.match_id = g.id and not p.finished and p.last_seen >= now() - gone);
end $$;
revoke all on function public.game_cleanup() from public, anon, authenticated;

-- the owner's other pages on the site call this so the lobby knows they are still around
create or replace function public.game_heartbeat() returns boolean
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if auth.uid() is null then return false; end if;
  update public.game_match_players p set last_seen = now() from public.game_matches g
   where g.id = p.match_id and g.status = 'lobby' and g.host = auth.uid() and p.user_id = auth.uid();
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke all on function public.game_heartbeat() from public, anon;
grant execute on function public.game_heartbeat() to authenticated;
