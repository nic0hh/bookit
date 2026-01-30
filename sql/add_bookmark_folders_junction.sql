-- =============================================================
-- CREATE BOOKMARK-FOLDER JUNCTION TABLE FOR MANY-TO-MANY RELATIONSHIP
-- This allows a bookmark to belong to multiple folders
-- =============================================================

-- 1️⃣ Create the junction table
create table if not exists public.bookmark_folders (
  id uuid primary key default gen_random_uuid(),
  bookmark_id uuid not null references public.bookmarks(id) on delete cascade,
  folder_id uuid not null references public.folders(id) on delete cascade,
  created_at timestamptz default now(),
  unique (bookmark_id, folder_id)
);

-- 2️⃣ Create indexes for performance
create index if not exists bookmark_folders_bookmark_id_idx on public.bookmark_folders (bookmark_id);
create index if not exists bookmark_folders_folder_id_idx on public.bookmark_folders (folder_id);

-- 3️⃣ Enable RLS
alter table public.bookmark_folders enable row level security;

-- 4️⃣ Create policies (user can manage their own bookmark-folder relationships)
create policy "bookmark_folders_owner_all"
  on public.bookmark_folders for all
  using (
    exists (
      select 1 from public.bookmarks b
      where b.id = bookmark_folders.bookmark_id
        and b.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.bookmarks b
      where b.id = bookmark_folders.bookmark_id
        and b.user_id = auth.uid()
    )
  );

-- 5️⃣ Viewer policy (can read if they have access to the bookmark)
create policy "bookmark_folders_viewer_select"
  on public.bookmark_folders for select
  using (
    exists (
      select 1 from public.bookmarks b
      join public.shared_permissions sp on sp.owner_id = b.user_id
      where b.id = bookmark_folders.bookmark_id
        and sp.viewer_id = auth.uid()
        and sp.status = 'accepted'
        and (sp.share_all or b.folder_id = any(sp.folder_ids))
    )
  );

-- 6️⃣ MIGRATION: Copy existing folder_id data to junction table
-- This preserves existing folder assignments
insert into public.bookmark_folders (bookmark_id, folder_id)
select id, folder_id
from public.bookmarks
where folder_id is not null
on conflict (bookmark_id, folder_id) do nothing;

-- 7️⃣ Optional: Keep the old folder_id column for backward compatibility
-- Or you can drop it after confirming the migration worked:
-- alter table public.bookmarks drop column if exists folder_id;

-- Notify PostgREST to reload schema
notify pgrst, 'reload schema';
