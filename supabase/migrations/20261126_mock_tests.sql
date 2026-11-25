-- Adaptive mock tests built from the question bank (2026-11-26). Idempotent.
-- A mock test = Module 1 + two Module 2 variants (harder / easier).
-- Every question can sit in at most ONE mock test (unique question_id).

create table if not exists public.mock_tests (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  module_size int not null default 22 check (module_size between 1 and 200),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.mock_test_questions (
  id uuid default gen_random_uuid() primary key,
  test_id uuid not null references public.mock_tests(id) on delete cascade,
  module text not null check (module in ('m1', 'm2_hard', 'm2_easy')),
  position int not null default 0,
  question_id uuid not null references public.questions(id) on delete cascade,
  unique (question_id)
);
create index if not exists mock_test_questions_test_idx on public.mock_test_questions (test_id, module, position);

alter table public.mock_tests enable row level security;
alter table public.mock_test_questions enable row level security;

drop policy if exists "Signed-in users read mock tests" on public.mock_tests;
create policy "Signed-in users read mock tests" on public.mock_tests for select to authenticated using (true);
drop policy if exists "Admins manage mock tests" on public.mock_tests;
create policy "Admins manage mock tests" on public.mock_tests for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')));

drop policy if exists "Signed-in users read mock questions" on public.mock_test_questions;
create policy "Signed-in users read mock questions" on public.mock_test_questions for select to authenticated using (true);
drop policy if exists "Admins manage mock questions" on public.mock_test_questions;
create policy "Admins manage mock questions" on public.mock_test_questions for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')));
