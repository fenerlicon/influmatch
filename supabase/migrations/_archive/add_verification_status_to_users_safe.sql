-- Safe version: Check if columns exist before adding

-- Check and add verification_status column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'verification_status'
  ) THEN
    ALTER TABLE public.users 
    ADD COLUMN verification_status text DEFAULT 'pending';
    
    UPDATE public.users 
    SET verification_status = 'pending' 
    WHERE verification_status IS NULL;
    
    ALTER TABLE public.users 
    ALTER COLUMN verification_status SET NOT NULL;
  END IF;
END $$;

-- Add check constraint (drop first if exists)
ALTER TABLE public.users 
DROP CONSTRAINT IF EXISTS users_verification_status_check;

ALTER TABLE public.users 
ADD CONSTRAINT users_verification_status_check 
CHECK (verification_status IN ('pending', 'verified', 'rejected'));

-- Check and add admin_notes column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'admin_notes'
  ) THEN
    ALTER TABLE public.users 
    ADD COLUMN admin_notes text;
  END IF;
END $$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_users_verification_status ON public.users(verification_status);

