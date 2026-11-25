-- Admin panel support (2026-11-25). Idempotent: safe to run more than once.
-- Everything here is callable only by signed-in admins/owners, checked inside each function.

-- 1. Suspended accounts ---------------------------------------------------------
alter table public.profiles add column if not exists suspended boolean not null default false;

-- 2. Audit log -----------------------------------------------------------------
create table if not exists public.admin_audit (
  id uuid default gen_random_uuid() primary key,
  who uuid references auth.users(id) on delete set null,
  who_name text default '',
  action text not null,
  kind text default 'Content',
  created_at timestamptz default now()
);
alter table public.admin_audit enable row level security;
drop policy if exists "Admins read audit" on public.admin_audit;
create policy "Admins read audit" on public.admin_audit for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')));
drop policy if exists "Admins write audit" on public.admin_audit;
create policy "Admins write audit" on public.admin_audit for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')));

-- 3. Invites (a role waiting for an email address) ---------------------------------
create table if not exists public.invites (
  email text primary key,
  role text not null default 'user' check (role in ('user', 'admin')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  accepted boolean not null default false
);
alter table public.invites enable row level security;
drop policy if exists "Admins manage invites" on public.invites;
create policy "Admins manage invites" on public.invites for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'owner')));

-- A new user calls this after signing in: if their email was invited, they get the invited role.
create or replace function public.claim_invite()
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  inv record;
  mail text;
begin
  select u.email into mail from auth.users u where u.id = auth.uid();
  if mail is null then return null; end if;
  select * into inv from public.invites i where lower(i.email) = lower(mail) and not i.accepted;
  if not found then return null; end if;
  update public.profiles set role = inv.role where id = auth.uid() and role = 'user';
  update public.invites set accepted = true where email = inv.email;
  return inv.role;
end;
$$;
revoke all on function public.claim_invite() from public, anon;
grant execute on function public.claim_invite() to authenticated;

-- 4. Suspend / reactivate ---------------------------------------------------------
create or replace function public.admin_set_suspended(target uuid, flag boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  caller text;
  target_role text;
begin
  select p.role into caller from public.profiles p where p.id = auth.uid();
  if caller is null or caller not in ('admin', 'owner') then raise exception 'Not authorized'; end if;
  select p.role into target_role from public.profiles p where p.id = target;
  if target_role is null then raise exception 'User not found'; end if;
  if target = auth.uid() then raise exception 'You cannot suspend yourself'; end if;
  if target_role = 'owner' then raise exception 'The owner cannot be suspended'; end if;
  if target_role = 'admin' and caller <> 'owner' then raise exception 'Only the owner can suspend an admin'; end if;
  update public.profiles set suspended = flag, updated_at = now() where id = target;
end;
$$;
revoke all on function public.admin_set_suspended(uuid, boolean) from public, anon;
grant execute on function public.admin_set_suspended(uuid, boolean) to authenticated;

-- 5. Remove a user for good (owner only): their results and their sign-in -------------
create or replace function public.admin_remove_user(target uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  target_role text;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner') then
    raise exception 'Only the owner can remove users';
  end if;
  select p.role into target_role from public.profiles p where p.id = target;
  if target_role is null then raise exception 'User not found'; end if;
  if target = auth.uid() or target_role = 'owner' then raise exception 'The owner cannot be removed'; end if;
  delete from public.practice_tests where user_id = target;
  delete from public.user_scores where user_id = target;
  delete from public.user_total_scores where user_id = target;
  delete from public.user_activity where user_id = target;
  delete from public.login_streaks where user_id = target;
  delete from auth.users where id = target;
end;
$$;
revoke all on function public.admin_remove_user(uuid) from public, anon;
grant execute on function public.admin_remove_user(uuid) to authenticated;

-- 6. Hand the Owner role to someone else (owner only) -----------------------------------
create or replace function public.transfer_ownership(new_owner uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner') then
    raise exception 'Only the owner can transfer ownership';
  end if;
  if new_owner = auth.uid() then raise exception 'You already own this workspace'; end if;
  if not exists (select 1 from public.profiles p where p.id = new_owner) then raise exception 'User not found'; end if;
  update public.profiles set role = 'owner', suspended = false, updated_at = now() where id = new_owner;
  update public.profiles set role = 'admin', updated_at = now() where id = auth.uid();
end;
$$;
revoke all on function public.transfer_ownership(uuid) from public, anon;
grant execute on function public.transfer_ownership(uuid) to authenticated;

-- 7. Sign-in days of everyone, for admin charts --------------------------------------
create or replace function public.get_all_logins()
returns table (user_id uuid, login_date date)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'owner')) then
    raise exception 'Not authorized';
  end if;
  return query select l.user_id, l.login_date from public.login_streaks l order by l.login_date desc limit 20000;
end;
$$;
revoke all on function public.get_all_logins() from public, anon;
grant execute on function public.get_all_logins() to authenticated;

-- 8. get_all_profiles now also reports the suspended flag ------------------------------------
drop function if exists public.get_all_profiles();
create or replace function public.get_all_profiles()
returns table (id uuid, display_name text, email text, role text, plan_type text, created_at timestamptz, suspended boolean)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'admin')) then
    raise exception 'Not authorized';
  end if;
  return query
    select p.id, p.display_name, u.email::text, p.role, p.plan_type, p.created_at, p.suspended
    from public.profiles p
    left join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;
revoke all on function public.get_all_profiles() from public, anon;
grant execute on function public.get_all_profiles() to authenticated;
