-- Add optional brand verification fields to users table
-- These fields are nullable to encourage but not force users to provide them

-- Add tax_id column (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'tax_id'
  ) THEN
    ALTER TABLE public.users 
    ADD COLUMN tax_id text;
  END IF;
END $$;

-- Add company_legal_name column (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'company_legal_name'
  ) THEN
    ALTER TABLE public.users 
    ADD COLUMN company_legal_name text;
  END IF;
END $$;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_users_tax_id ON public.users(tax_id) WHERE tax_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_company_legal_name ON public.users(company_legal_name) WHERE company_legal_name IS NOT NULL;

