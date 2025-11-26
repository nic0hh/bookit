-- =============================================================
-- ✅ COMPLETE BOOKIT SHARING SYSTEM WITH ACCEPT/DENY FLOW
-- Run this ONCE in Supabase SQL editor (replaces all old SQL)
-- =============================================================

-- 1️⃣ ENSURE TABLES EXIST
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  created_at timestamptz default now()
);

create table if not exists public.shared_permissions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  viewer_email text,
  share_all boolean default false,
  share_home boolean default false,
  folder_ids uuid[] default '{}',
  status text default 'pending' check (status in ('pending', 'accepted', 'denied')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (owner_id, viewer_id)
);

-- 2️⃣ ENABLE RLS
alter table public.profiles enable row level security;
alter table public.folders enable row level security;
alter table public.bookmarks enable row level security;
alter table public.shared_permissions enable row level security;

-- 3️⃣ DROP OLD POLICIES (cleanup)
do $$
declare
  pol record;
begin
  for pol in 
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'folders', 'bookmarks', 'shared_permissions')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- 4️⃣ CREATE CLEAN POLICIES (require accepted status for viewer access)

-- PROFILES: owner full access, viewer can read if accepted
create policy "profiles_owner_all"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_viewer_select"
  on public.profiles for select
  using (
    exists (
      select 1 from public.shared_permissions sp
      where sp.owner_id = public.profiles.id
        and sp.viewer_id = auth.uid()
        and sp.status = 'accepted'
        and (sp.share_all or sp.share_home or array_length(sp.folder_ids, 1) > 0)
    )
  );

-- FOLDERS: owner full access, viewer can read if accepted
create policy "folders_owner_all"
  on public.folders for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "folders_viewer_select"
  on public.folders for select
  using (
    exists (
      select 1 from public.shared_permissions sp
      where sp.owner_id = public.folders.user_id
        and sp.viewer_id = auth.uid()
        and sp.status = 'accepted'
        and (sp.share_all or public.folders.id = any(sp.folder_ids))
    )
  );

-- BOOKMARKS: owner full access, viewer can read if accepted
create policy "bookmarks_owner_all"
  on public.bookmarks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "bookmarks_viewer_select"
  on public.bookmarks for select
  using (
    exists (
      select 1 from public.shared_permissions sp
      where sp.owner_id = public.bookmarks.user_id
        and sp.viewer_id = auth.uid()
        and sp.status = 'accepted'
        and (sp.share_all or public.bookmarks.folder_id = any(sp.folder_ids))
    )
  );

-- SHARED_PERMISSIONS: owner full access, viewer can read their own row
create policy "shared_permissions_owner_all"
  on public.shared_permissions for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "shared_permissions_viewer_select"
  on public.shared_permissions for select
  using (auth.uid() = viewer_id);

-- 5️⃣ CREATE RPC FUNCTIONS

-- Share profile with email (sends pending request)
create or replace function public.share_profile_with_email(viewer_email text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_viewer uuid;
begin
  select id into v_viewer
  from auth.users
  where lower(email) = lower(viewer_email)
  limit 1;

  if v_viewer is null then
    return jsonb_build_object('error', 'User not found');
  end if;

  if v_viewer = auth.uid() then
    return jsonb_build_object('error', 'Cannot share with yourself');
  end if;

  insert into public.shared_permissions (owner_id, viewer_id, viewer_email, share_all, share_home, folder_ids, status)
  values (auth.uid(), v_viewer, viewer_email, true, false, '{}', 'pending')
  on conflict (owner_id, viewer_id) do update
    set viewer_email = excluded.viewer_email,
        share_all = true,
        status = 'pending',
        updated_at = now();

  return jsonb_build_object('ok', true, 'viewer_id', v_viewer);
end;
$$;

-- Unshare profile with email
create or replace function public.unshare_profile_with_email(viewer_email text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_viewer uuid;
begin
  select id into v_viewer
  from auth.users
  where lower(email) = lower(viewer_email)
  limit 1;

  if v_viewer is null then
    return jsonb_build_object('error', 'User not found');
  end if;

  delete from public.shared_permissions 
  where owner_id = auth.uid() 
    and viewer_id = v_viewer;

  return jsonb_build_object('ok', true);
end;
$$;

-- Update folder sharing for an existing permission
create or replace function public.update_shared_folders(permission_id uuid, new_folder_ids uuid[])
returns jsonb
language plpgsql
security definer
as $$
begin
  -- Verify the caller owns this permission
  if not exists (
    select 1 from public.shared_permissions
    where id = permission_id and owner_id = auth.uid()
  ) then
    return jsonb_build_object('error', 'Permission not found or not owned by you');
  end if;

  -- Update folder_ids and ensure share_home stays true
  update public.shared_permissions
  set folder_ids = new_folder_ids,
      share_home = true,
      updated_at = now()
  where id = permission_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- Accept or deny a share request
create or replace function public.respond_to_share_request(request_id uuid, new_status text)
returns jsonb
language plpgsql
security definer
as $$
begin
  if new_status not in ('accepted', 'denied') then
    return jsonb_build_object('error', 'Invalid status');
  end if;

  update public.shared_permissions
  set status = new_status, updated_at = now()
  where id = request_id
    and viewer_id = auth.uid();

  if not found then
    return jsonb_build_object('error', 'Request not found or not authorized');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- 6️⃣ GRANT PERMISSIONS
grant usage on schema public to authenticated;
grant select on public.profiles, public.folders, public.bookmarks, public.shared_permissions to authenticated;
grant insert, update, delete on public.folders, public.bookmarks to authenticated;
grant insert, update, delete on public.shared_permissions to authenticated;
grant insert, update on public.profiles to authenticated;

grant execute on function public.share_profile_with_email(text) to authenticated;
grant execute on function public.unshare_profile_with_email(text) to authenticated;
grant execute on function public.respond_to_share_request(uuid, text) to authenticated;
grant execute on function public.update_shared_folders(uuid, uuid[]) to authenticated;

-- 7️⃣ ENSURE PROFILES EXIST FOR ALL USERS
insert into public.profiles (id, username)
select id, lower(email)
from auth.users
where id not in (select id from public.profiles)
on conflict (id) do nothing;

-- 8️⃣ RELOAD POSTGREST
notify pgrst, 'reload schema';

-- ✅ VERIFY (shows created policies and functions)
select '=== POLICIES ===' as info;
select tablename, policyname from pg_policies 
where schemaname = 'public' 
  and tablename in ('profiles', 'folders', 'bookmarks', 'shared_permissions')
order by tablename, policyname;

select '=== FUNCTIONS ===' as info;
select routine_name from information_schema.routines 
where routine_schema = 'public' 
  and routine_name in ('share_profile_with_email', 'unshare_profile_with_email', 'respond_to_share_request');
