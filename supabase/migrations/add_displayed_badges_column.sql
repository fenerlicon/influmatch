-- Add displayed_badges column to users table if it doesn't exist
-- This column stores the badge IDs that should be displayed on user cards (max 3)

-- Check if column exists, if not add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'displayed_badges'
  ) THEN
    ALTER TABLE public.users
    ADD COLUMN displayed_badges text[] DEFAULT ARRAY[]::text[];
    
    -- Set default empty array for existing rows
    UPDATE public.users
    SET displayed_badges = ARRAY[]::text[]
    WHERE displayed_badges IS NULL;
  END IF;
END $$;

-- Drop existing constraint if it exists and recreate it
ALTER TABLE public.users 
DROP CONSTRAINT IF EXISTS displayed_badges_max_length;

ALTER TABLE public.users
ADD CONSTRAINT displayed_badges_max_length 
CHECK (array_length(displayed_badges, 1) IS NULL OR array_length(displayed_badges, 1) <= 3);

