-- Add spotlight_expires_at column to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'spotlight_expires_at'
  ) THEN
    ALTER TABLE public.users 
    ADD COLUMN spotlight_expires_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;
