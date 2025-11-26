-- Users handled by Supabase auth (auth.users). We store only foreign keys in our tables.

-- FOLDERS
create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) <= 120),
  hidden boolean default false,
  position integer default 0,
  created_at timestamptz default now()
);

-- BOOKMARKS
create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid references public.folders(id) on delete set null,
  url text not null,
  title text default '' check (char_length(title) <= 300),
  image text,
  tags text[] default '{}',
  created_at timestamptz default now()
);

-- Indexes
create index if not exists bookmarks_user_id_idx on public.bookmarks (user_id);
create index if not exists folders_user_id_idx on public.folders (user_id);
create index if not exists bookmarks_folder_id_idx on public.bookmarks (folder_id);

-- Enable RLS
alter table public.folders enable row level security;
alter table public.bookmarks enable row level security;

-- Drop old policies if they exist
drop policy if exists "folders_select_own" on public.folders;
drop policy if exists "folders_modify_own" on public.folders;
drop policy if exists "bookmarks_select_own" on public.bookmarks;
drop policy if exists "bookmarks_modify_own" on public.bookmarks;

-- Policies (ownership)
create policy "folders_select_own" on public.folders for select using (auth.uid() = user_id);
create policy "folders_modify_own" on public.folders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "bookmarks_select_own" on public.bookmarks for select using (auth.uid() = user_id);
create policy "bookmarks_modify_own" on public.bookmarks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Basic URL format constraint (optional, still validate in code)
alter table public.bookmarks
  drop constraint if exists url_protocol_chk;
alter table public.bookmarks
  add constraint url_protocol_chk
  check (url ~* '^(https?)://');

-- Clean up invalid blob URLs
update bookmarks
set image = null
where image like 'blob:%' or image like 'blon:%';

-- Drop old duplicate column if it exists
alter table public.folders drop column if exists hidden_on_home;

-- Add missing columns if they don't exist (for existing databases)
alter table public.folders add column if not exists hidden boolean default false;
alter table public.folders add column if not exists position integer default 0;

-- Notify PostgREST to reload schema
notify pgrst, 'reload schema';
