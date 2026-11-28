-- Music: songs admins add to or remove from the built-in lists (2026-12-06). Idempotent.
create table if not exists public.music_tracks (
  track_id text not null check (track_id ~ '^[A-Za-z0-9]{3,16}$'),
  category text not null check (category in ('lofi', 'classical', 'piano', 'ambient', 'nature')),
  title text not null check (length(title) between 1 and 120),
  artist text not null default '' check (length(artist) <= 80),
  duration int not null default 0 check (duration between 0 and 36000),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (track_id, category)
);
alter table public.music_tracks enable row level security;
revoke all on public.music_tracks from anon;
grant select, insert, update, delete on public.music_tracks to authenticated;

drop policy if exists "Music read" on public.music_tracks;
create policy "Music read" on public.music_tracks for select to authenticated using (true);

drop policy if exists "Music admin write" on public.music_tracks;
create policy "Music admin write" on public.music_tracks for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')));
