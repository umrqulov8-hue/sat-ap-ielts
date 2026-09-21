-- =====================
-- MIGRATION: DATA INTEGRITY
-- 1. push_subscriptions: unique(user_id) so upserts work
-- 2. user_settings: allow users to insert their own row
-- 3. Backfill missing profiles + user_settings rows
-- 4. Admin RPCs: only owner/admin can call
-- Re-runnable.
-- =====================

-- 1. Unique constraint for push upserts
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'push_subscriptions_user_id_key') then
    alter table public.push_subscriptions
      add constraint push_subscriptions_user_id_key unique (user_id);
  end if;
end $$;

-- 2. Users can insert their own settings row
drop policy if exists "Users can insert own settings" on user_settings;
create policy "Users can insert own settings"
  on user_settings for insert
  with check (auth.uid() = user_id);

-- 3. Backfill missing profiles
insert into public.profiles (id, display_name)
select u.id, coalesce(nullif(u.raw_user_meta_data->>'display_name', ''), split_part(u.email, '@', 1), '')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null and u.deleted_at is null;

-- Backfill missing user_settings
insert into public.user_settings (user_id)
select u.id
from auth.users u
left join public.user_settings s on s.user_id = u.id
where s.user_id is null and u.deleted_at is null;

-- 4. Admin-only RPCs
create or replace function get_all_profiles()
returns table (
  id uuid,
  display_name text,
  email text,
  role text,
  plan_type text,
  created_at timestamptz
)
language plpgsql security definer stable
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','admin')) then
    raise exception 'Not authorized';
  end if;
  return query
    select p.id, p.display_name, u.email::text, p.role, p.plan_type, p.created_at
    from public.profiles p
    left join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;

create or replace function get_all_practice_tests()
returns table (
  id uuid,
  user_id uuid,
  user_name text,
  title text,
  subject text,
  score int,
  total int,
  taken_at timestamptz
)
language plpgsql security definer stable
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','admin')) then
    raise exception 'Not authorized';
  end if;
  return query
    select t.id, t.user_id, coalesce(p.display_name, '')::text, t.title, t.subject, t.score, t.total, t.taken_at
    from public.practice_tests t
    left join public.profiles p on p.id = t.user_id
    order by t.taken_at desc;
end;
$$;
