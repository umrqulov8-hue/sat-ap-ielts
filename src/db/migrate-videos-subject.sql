-- =====================
-- MIGRATION: VIDEOS BY SUBJECT
-- Videos attach to subjects directly (no topic picking needed).
-- Re-runnable.
-- =====================

alter table public.videos
  add column if not exists subject_id uuid references subjects(id) on delete cascade;

create index if not exists videos_subject_id_idx on public.videos (subject_id);
