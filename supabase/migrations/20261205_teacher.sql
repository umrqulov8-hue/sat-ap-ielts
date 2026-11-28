-- Teacher role (2026-12-05): runs the Community, no admin panel. Run after 20261204_community.sql. Idempotent.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('owner', 'admin', 'teacher', 'user'));
alter table public.invites drop constraint if exists invites_role_check;
alter table public.invites add constraint invites_role_check check (role in ('user', 'teacher', 'admin'));

-- the owner sets any role; an admin may make a student a teacher and back
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
  if caller_role is null or caller_role not in ('owner', 'admin') then
    raise exception 'Not authorized';
  end if;
  if new_role is null or new_role not in ('user', 'teacher', 'admin', 'owner') then
    raise exception 'Invalid role';
  end if;
  select p.role into target_role from public.profiles p where p.id = target_user_id;
  if target_role is null then
    raise exception 'User not found';
  end if;
  if caller_role = 'admin' and (new_role not in ('user', 'teacher') or target_role not in ('user', 'teacher')) then
    raise exception 'Only an owner can change admin or owner roles';
  end if;
  update public.profiles set role = new_role, updated_at = pg_catalog.now()
  where id = target_user_id;
end;
$$;

-- who runs the community: owner, admins and teachers
create or replace function public.chat_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'owner', 'teacher'));
$$;

create or replace function public.chat_badge(u uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case p.role when 'owner' then 'admin' when 'admin' then 'admin' when 'teacher' then 'teacher' end from public.profiles p where p.id = u;
$$;
revoke all on function public.chat_badge(uuid) from public, anon, authenticated;

create or replace function public.chat_members_list(p_chat uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare adm boolean := public.chat_is_admin();
begin
  if not (adm or public.chat_is_member(p_chat)) then raise exception 'Not a member'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', case when adm then m.user_id else null end, 'nick', public.game_nick(m.user_id),
      'me', m.user_id = auth.uid(), 'muted', m.muted, 'admin', public.chat_badge(m.user_id) is not null, 'role', public.chat_badge(m.user_id))
    order by public.game_nick(m.user_id)) from public.chat_members m where m.chat_id = p_chat), '[]'::jsonb);
end $$;

create or replace function public.chat_message_json(g public.chat_messages) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', g.id, 'mine', g.user_id = auth.uid(), 'nick', case when g.user_id is null then 'deleted user' else public.game_nick(g.user_id) end,
    'admin', public.chat_badge(g.user_id) is not null, 'role', public.chat_badge(g.user_id),
    'kind', g.kind, 'body', case when g.deleted then '' else g.body end, 'deleted', g.deleted,
    'path', case when g.deleted then null else g.file_path end, 'fileName', g.file_name, 'size', g.file_size, 'duration', g.duration,
    'at', floor(extract(epoch from g.created_at) * 1000),
    'reply', (select jsonb_build_object('id', r.id, 'nick', public.game_nick(r.user_id), 'text', case when r.deleted then 'Message deleted' when r.kind = 'text' then left(r.body, 80) when r.kind = 'image' then 'Photo' when r.kind = 'voice' then 'Voice message' else coalesce(r.file_name, 'File') end)
              from public.chat_messages r where r.id = g.reply_to and r.chat_id = g.chat_id));
$$;
revoke all on function public.chat_message_json(public.chat_messages) from public, anon, authenticated;
