-- =====================
-- MIGRATION: VIDEO LESSONS (STUDY section)
-- Videos table linked to topics. Re-runnable.
-- =====================

create table if not exists videos (
  id uuid default gen_random_uuid() primary key,
  topic_id uuid references topics(id) on delete cascade,
  title text not null,
  description text default '',
  video_url text not null,
  video_type text default 'youtube' check (video_type in ('youtube', 'file')),
  thumbnail_url text default '',
  order_index int default 0,
  created_at timestamptz default now()
);

alter table videos enable row level security;

drop policy if exists "Anyone can view videos" on videos;
create policy "Anyone can view videos"
  on videos for select using (true);

drop policy if exists "Admins can manage videos" on videos;
create policy "Admins can manage videos"
  on videos for all using (auth.uid() in (select id from profiles where role in ('admin','owner')));
