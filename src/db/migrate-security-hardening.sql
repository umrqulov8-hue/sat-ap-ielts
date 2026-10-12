-- Tighten access to curriculum, profiles, and privileged RPCs.
-- Safe to re-run; existing content remains readable to the intended roles.

-- RLS had been disabled on these two tables in production. Keep curriculum
-- readable, but allow writes only to authenticated admins and owners.
alter table public.subjects enable row level security;
alter table public.modules enable row level security;
alter table public.questions enable row level security;
alter table public.topics enable row level security;

revoke insert, update, delete on table public.subjects, public.modules from anon, authenticated;
revoke insert, update, delete on table public.questions, public.topics from anon, authenticated;
grant select on table public.subjects, public.modules to anon, authenticated;
grant select on table public.questions, public.topics to authenticated;
grant insert, update, delete on table public.subjects, public.modules, public.questions, public.topics to authenticated;

drop policy if exists "Anyone can view subjects" on public.subjects;
drop policy if exists "Anyone can insert subjects" on public.subjects;
drop policy if exists "Anyone can update subjects" on public.subjects;
drop policy if exists "Anyone can delete subjects" on public.subjects;
drop policy if exists "Public can view subjects" on public.subjects;
drop policy if exists "Admins can insert subjects" on public.subjects;
drop policy if exists "Admins can update subjects" on public.subjects;
drop policy if exists "Admins can delete subjects" on public.subjects;
create policy "Public can view subjects" on public.subjects
  for select to anon, authenticated using (true);
create policy "Admins can insert subjects" on public.subjects
  for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')));
create policy "Admins can update subjects" on public.subjects
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')));
create policy "Admins can delete subjects" on public.subjects
  for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')));

drop policy if exists "Anyone can view modules" on public.modules;
drop policy if exists "Anyone can insert modules" on public.modules;
drop policy if exists "Anyone can update modules" on public.modules;
drop policy if exists "Anyone can delete modules" on public.modules;
drop policy if exists "Admins can insert modules" on public.modules;
drop policy if exists "Admins can update modules" on public.modules;
drop policy if exists "Admins can delete modules" on public.modules;
drop policy if exists "Public can view modules" on public.modules;
create policy "Public can view modules" on public.modules
  for select to anon, authenticated using (true);
create policy "Admins can insert modules" on public.modules
  for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')));
create policy "Admins can update modules" on public.modules
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')));
create policy "Admins can delete modules" on public.modules
  for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')));

drop policy if exists "Anyone can view questions" on public.questions;
drop policy if exists "Anyone can insert questions" on public.questions;
drop policy if exists "Anyone can update questions" on public.questions;
drop policy if exists "Anyone can delete questions" on public.questions;
drop policy if exists "Admins can insert questions" on public.questions;
drop policy if exists "Admins can update questions" on public.questions;
drop policy if exists "Admins can delete questions" on public.questions;
drop policy if exists "Authenticated can view questions" on public.questions;
create policy "Authenticated can view questions" on public.questions
  for select to authenticated using (true);
create policy "Admins can insert questions" on public.questions
  for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')));
create policy "Admins can update questions" on public.questions
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')));
create policy "Admins can delete questions" on public.questions
  for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')));

drop policy if exists "Anyone can view topics" on public.topics;
drop policy if exists "Anyone can insert topics" on public.topics;
drop policy if exists "Anyone can update topics" on public.topics;
drop policy if exists "Anyone can delete topics" on public.topics;
drop policy if exists "Admins can view topics" on public.topics;
drop policy if exists "Admins can insert topics" on public.topics;
drop policy if exists "Admins can update topics" on public.topics;
drop policy if exists "Admins can delete topics" on public.topics;
drop policy if exists "Authenticated can view topics" on public.topics;
create policy "Authenticated can view topics" on public.topics
  for select to authenticated using (true);
create policy "Admins can insert topics" on public.topics
  for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')));
create policy "Admins can update topics" on public.topics
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')));
create policy "Admins can delete topics" on public.topics
  for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')));

-- Users may edit only their public profile fields, never their role or plan.
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Users can update own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
revoke insert, update, delete on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name, avatar_url, lang, exam_date) on table public.profiles to authenticated;

-- Prevent ownership changes through UPDATE/upsert policies.
drop policy if exists "Users can update own progress" on public.user_progress;
create policy "Users can update own progress" on public.user_progress
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update own scores" on public.user_scores;
create policy "Users can update own scores" on public.user_scores
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update own total score" on public.user_total_scores;
create policy "Users can update own total score" on public.user_total_scores
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Use a stable, searchable subject foreign key for practice history.
alter table public.practice_tests add column if not exists subject_id uuid references public.subjects(id) on delete set null;
update public.practice_tests pt
set subject_id = s.id
from public.subjects s
where pt.subject_id is null
  and (lower(trim(pt.subject)) = lower(trim(s.title)) or lower(trim(pt.subject)) = lower(trim(s.slug)));
create index if not exists practice_tests_user_subject_idx on public.practice_tests (user_id, subject_id);

-- Privileged RPCs are only callable by signed-in users and use a fixed path.
create or replace function public.get_all_profiles()
returns table (id uuid, display_name text, email text, role text, plan_type text, created_at timestamptz)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('owner', 'admin')) then
    raise exception 'Not authorized';
  end if;
  return query
    select p.id, p.display_name, u.email::text, p.role, p.plan_type, p.created_at
    from public.profiles p
    left join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;

create or replace function public.get_all_practice_tests()
returns table (id uuid, user_id uuid, user_name text, title text, subject text, score int, total int, taken_at timestamptz)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('owner', 'admin')) then
    raise exception 'Not authorized';
  end if;
  return query
    select t.id, t.user_id, coalesce(p.display_name, '')::text, t.title, t.subject, t.score, t.total, t.taken_at
    from public.practice_tests t
    left join public.profiles p on p.id = t.user_id
    order by t.taken_at desc;
end;
$$;

create or replace function public.set_user_role(target_user_id uuid, new_role text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  caller_role text;
  target_role text;
begin
  select p.role into caller_role from public.profiles p where p.id = (select auth.uid());
  if caller_role not in ('owner', 'admin') or caller_role is null then
    raise exception 'Not authorized';
  end if;
  if new_role is null or new_role not in ('user', 'admin', 'owner') then
    raise exception 'Invalid role';
  end if;
  select p.role into target_role from public.profiles p where p.id = target_user_id;
  if target_role is null then
    raise exception 'User not found';
  end if;
  if caller_role = 'admin' and (new_role <> 'user' or target_role <> 'user') then
    raise exception 'Only an owner can change admin or owner roles';
  end if;
  update public.profiles set role = new_role, updated_at = pg_catalog.now()
  where id = target_user_id;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''));
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;

revoke all on function public.get_all_profiles() from public, anon, authenticated;
revoke all on function public.get_all_practice_tests() from public, anon, authenticated;
revoke all on function public.set_user_role(uuid, text) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.get_all_profiles() to authenticated;
grant execute on function public.get_all_practice_tests() to authenticated;
grant execute on function public.set_user_role(uuid, text) to authenticated;
