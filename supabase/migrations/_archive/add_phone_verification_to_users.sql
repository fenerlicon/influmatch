-- Add phone and phone_verified columns to users table

-- Add phone column (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.users 
    ADD COLUMN phone text;
  END IF;
END $$;

-- Add phone_verified column (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'phone_verified'
  ) THEN
    ALTER TABLE public.users 
    ADD COLUMN phone_verified boolean NOT NULL DEFAULT false;
  ELSE
    -- Column exists, just ensure default value
    ALTER TABLE public.users 
    ALTER COLUMN phone_verified SET DEFAULT false;
    
    -- Update NULL values to false
    UPDATE public.users 
    SET phone_verified = false 
    WHERE phone_verified IS NULL;
    
    -- Make column NOT NULL if it isn't already
    ALTER TABLE public.users 
    ALTER COLUMN phone_verified SET NOT NULL;
  END IF;
END $$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_users_phone_verified ON public.users(phone_verified);

