-- Add social_links_last_updated column to users table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'social_links_last_updated'
  ) THEN
    ALTER TABLE public.users 
    ADD COLUMN social_links_last_updated timestamptz;
  END IF;
END $$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_users_social_links_last_updated ON public.users(social_links_last_updated);

