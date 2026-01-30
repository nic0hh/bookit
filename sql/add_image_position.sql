-- Add image position columns to bookmarks table
-- This allows users to adjust how cropped images are positioned

alter table public.bookmarks 
add column if not exists image_position_x real default 0.5,
add column if not exists image_position_y real default 0.5;

-- Values are 0-1 where 0.5 is centered
-- 0 = left/top, 1 = right/bottom

comment on column public.bookmarks.image_position_x is 'Horizontal position of image crop (0=left, 0.5=center, 1=right)';
comment on column public.bookmarks.image_position_y is 'Vertical position of image crop (0=top, 0.5=center, 1=bottom)';

notify pgrst, 'reload schema';
