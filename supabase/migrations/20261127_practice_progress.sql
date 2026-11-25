-- Saved practice progress ("Save & archive"), 2026-11-27. Idempotent.
create table if not exists public.practice_progress (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Practice',
  total int not null default 0,
  answered int not null default 0,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists practice_progress_user_idx on public.practice_progress (user_id, updated_at desc);
alter table public.practice_progress enable row level security;
drop policy if exists "Own progress" on public.practice_progress;
create policy "Own progress" on public.practice_progress for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
