-- Add tax_office and tax_office_city to users table for brand verification
-- These fields are mandatory when tax_id is entered to allow proper tax plate verification.

-- Add tax_office column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'tax_office'
  ) THEN
    ALTER TABLE public.users 
    ADD COLUMN tax_office text;
  END IF;
END $$;

-- Add tax_office_city column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'tax_office_city'
  ) THEN
    ALTER TABLE public.users 
    ADD COLUMN tax_office_city text;
  END IF;
END $$;

-- Create index for faster querying by tax_office_city (optional but helpful)
CREATE INDEX IF NOT EXISTS idx_users_tax_office_city ON public.users(tax_office_city) WHERE tax_office_city IS NOT NULL;
