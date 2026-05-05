drop policy if exists "Shared viewers can read permitted files" on storage.objects;

create policy "Shared viewers can read permitted files"
on storage.objects for select
using (
  bucket_id = 'bookmark-images'
  and exists (
    select 1 from public.shared_permissions sp
    where sp.owner_id = storage.objects.owner
      and sp.viewer_id = auth.uid()
      and sp.status = 'accepted'
      and (
        sp.share_all = true
        or exists (
          select 1 from public.bookmarks b
          join public.bookmark_folders bf on bf.bookmark_id = b.id
          where b.image_path = storage.objects.name
            and b.user_id    = storage.objects.owner
            and bf.folder_id = any(sp.folder_ids)
        )
      )
  )
);
