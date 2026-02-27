-- Add hidden column to folders table
ALTER TABLE public.folders
ADD COLUMN IF NOT EXISTS hidden boolean DEFAULT false;

-- Add position column for folder ordering if it doesn't exist
ALTER TABLE public.folders
ADD COLUMN IF NOT EXISTS position integer DEFAULT 0;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
