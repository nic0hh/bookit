-- create permissions table + trigger + RPC to set permissions by viewer email

create extension if not exists "pgcrypto";

create table if not exists public.shared_permissions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  share_all boolean default false,
  share_home boolean default false,
  folder_ids uuid[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (owner_id, viewer_id)
);

-- updated_at trigger
create or replace function public.update_modified_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists shared_permissions_mod on public.shared_permissions;
create trigger shared_permissions_mod
  before insert or update on public.shared_permissions
  for each row execute function public.update_modified_at();

-- RPC: upsert permissions by email (owner calls this)
create or replace function public.set_share_permissions_by_email(
  viewer_email text,
  p_share_all boolean default false,
  p_share_home boolean default false,
  p_folder_ids uuid[] default '{}'
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_viewer uuid;
begin
  select id into v_viewer from auth.users where lower(email) = lower(viewer_email) limit 1;
  if v_viewer is null then
    return jsonb_build_object('error','User not found');
  end if;

  insert into public.shared_permissions (owner_id, viewer_id, share_all, share_home, folder_ids)
  values (auth.uid(), v_viewer, p_share_all, p_share_home, p_folder_ids)
  on conflict (owner_id, viewer_id) do update
    set share_all = excluded.share_all,
        share_home = excluded.share_home,
        folder_ids = excluded.folder_ids,
        updated_at = now();

  return jsonb_build_object('ok', true, 'viewer_id', v_viewer);
end;
$$;

grant execute on function public.set_share_permissions_by_email(text, boolean, boolean, uuid[]) to authenticated;

-- Replace viewer SELECT policies to check shared_permissions

-- Profiles: allow owner OR permissions (share_all or share_home)
drop policy if exists "View shared profiles" on public.profiles;
create policy "View shared profiles"
  on public.profiles for select
  using (
    auth.uid() = id
    or exists (
      select 1 from public.shared_permissions sp
      where sp.owner_id = public.profiles.id
        and sp.viewer_id = auth.uid()
        and (sp.share_all or sp.share_home or array_length(sp.folder_ids,1) > 0)
    )
  );

-- Folders: viewer can read if share_all OR folder id included
drop policy if exists "Viewer can read shared folders" on public.folders;
create policy "Viewer can read shared folders"
  on public.folders for select
  using (
    exists (
      select 1 from public.shared_permissions sp
      where sp.owner_id = public.folders.user_id
        and sp.viewer_id = auth.uid()
        and (
          sp.share_all
          or public.folders.id = any(sp.folder_ids)
        )
    )
  );

-- Bookmarks: viewer can read if share_all OR containing folder shared
drop policy if exists "Viewer can read shared bookmarks" on public.bookmarks;
create policy "Viewer can read shared bookmarks"
  on public.bookmarks for select
  using (
    exists (
      select 1 from public.shared_permissions sp
      where sp.owner_id = public.bookmarks.user_id
        and sp.viewer_id = auth.uid()
        and (
          sp.share_all
          or public.bookmarks.folder_id = any(sp.folder_ids)
        )
    )
  );