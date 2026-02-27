drop policy if exists "bookmarks_viewer_select" on public.bookmarks;

create policy "bookmarks_viewer_select"
  on public.bookmarks for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.shared_permissions sp
      where sp.owner_id = public.bookmarks.user_id
        and sp.viewer_id = auth.uid()
        and sp.status = 'accepted'
        and (
          sp.share_all = true
          or exists (
            select 1 from public.bookmark_folders bf
            where bf.bookmark_id = public.bookmarks.id
              and bf.folder_id = any(sp.folder_ids)
          )
        )
    )
  );

notify pgrst, 'reload schema';
