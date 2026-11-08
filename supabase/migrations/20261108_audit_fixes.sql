-- SATAP audit fixes (2026-11-08). Idempotent: safe to run more than once.
-- Run in Supabase -> SQL Editor (role: postgres).

begin;

-- ---------------------------------------------------------------------------
-- 1. Data integrity
-- ---------------------------------------------------------------------------
-- practice_tests.subject_id was never filled in by older app versions.
update public.practice_tests pt
set subject_id = s.id
from public.subjects s
where pt.subject_id is null and lower(pt.subject) = lower(s.title);

-- A question without a subject can never be shown to anyone (the bug that made
-- admin-added questions "disappear"). NOT VALID = enforce for new/changed rows
-- without touching the old rows.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'questions_subject_required') then
    alter table public.questions add constraint questions_subject_required check (subject_id is not null) not valid;
  end if;
end $$;

create index if not exists questions_subject_difficulty_idx on public.questions (subject_id, difficulty, order_index);
create index if not exists sat_modules_test_idx on public.sat_modules (test_id, order_index);
create index if not exists sat_questions_module_idx on public.sat_questions (module_id, question_number);

-- ---------------------------------------------------------------------------
-- 2. Storage (bucket avav2: avatars + question images)
-- ---------------------------------------------------------------------------
-- Before: any file type, any size. Now: images only, 5 MB.
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
where id = 'avav2';

-- There was no DELETE policy, so removing images silently did nothing.
drop policy if exists "Users can delete their own files" on storage.objects;
create policy "Users can delete their own files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avav2' and (select auth.uid())::text = (storage.foldername(name))[1]);

drop policy if exists "Admins can manage avav2 files" on storage.objects;
create policy "Admins can manage avav2 files" on storage.objects
  for all to authenticated
  using (bucket_id = 'avav2' and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')))
  with check (bucket_id = 'avav2' and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')));

-- ---------------------------------------------------------------------------
-- 3. Roles: only an owner may change roles (the UI already says so)
-- ---------------------------------------------------------------------------
create or replace function public.set_user_role(target_user_id uuid, new_role text)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'owner') then
    raise exception 'Only an owner can change roles';
  end if;
  if new_role not in ('user', 'admin', 'owner') then
    raise exception 'Invalid role';
  end if;
  if target_user_id = auth.uid() and new_role <> 'owner' then
    raise exception 'Owners cannot demote themselves';
  end if;
  update public.profiles set role = new_role, updated_at = now() where id = target_user_id;
  if not found then
    raise exception 'User not found';
  end if;
end;
$$;
revoke all on function public.set_user_role(uuid, text) from public, anon;
grant execute on function public.set_user_role(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. SAT tests: answer keys were readable without logging in, and the admin
--    policies had no explicit WITH CHECK / role.
-- ---------------------------------------------------------------------------
drop policy if exists "Anyone can view SAT tests" on public.sat_tests;
drop policy if exists "Anyone can view SAT modules" on public.sat_modules;
drop policy if exists "Anyone can view SAT questions" on public.sat_questions;
drop policy if exists "Authenticated can view SAT tests" on public.sat_tests;
drop policy if exists "Authenticated can view SAT modules" on public.sat_modules;
drop policy if exists "Authenticated can view SAT questions" on public.sat_questions;
create policy "Authenticated can view SAT tests" on public.sat_tests for select to authenticated using (true);
create policy "Authenticated can view SAT modules" on public.sat_modules for select to authenticated using (true);
create policy "Authenticated can view SAT questions" on public.sat_questions for select to authenticated using (true);

drop policy if exists "Admins can insert/update/delete SAT tests" on public.sat_tests;
drop policy if exists "Admins can manage SAT tests" on public.sat_tests;
drop policy if exists "Admins can manage SAT modules" on public.sat_modules;
drop policy if exists "Admins can manage SAT questions" on public.sat_questions;
create policy "Admins can manage SAT tests" on public.sat_tests for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')));
create policy "Admins can manage SAT modules" on public.sat_modules for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')));
create policy "Admins can manage SAT questions" on public.sat_questions for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')));

-- ---------------------------------------------------------------------------
-- 5. Least privilege. Row-level security does not apply to TRUNCATE, and the
--    anon (public key) role never needs to write anything.
-- ---------------------------------------------------------------------------
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
alter default privileges in schema public revoke insert, update, delete, truncate, references, trigger on tables from anon;

commit;

-- ---------------------------------------------------------------------------
-- OPTIONAL (not run automatically): 10 junk questions with no subject (test
-- data like "2+2-4=?", "asdasdsa") exist from earlier admin experiments.
-- They are invisible to students. To remove them:
--   delete from public.questions where subject_id is null;
-- ---------------------------------------------------------------------------
