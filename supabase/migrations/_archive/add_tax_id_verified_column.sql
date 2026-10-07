-- Add tax_id_verified column to users table
-- This column tracks whether a brand's tax ID has been verified by admin

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'tax_id_verified'
  ) THEN
    ALTER TABLE public.users 
    ADD COLUMN tax_id_verified boolean DEFAULT false;
    
    -- Set existing tax_id entries to false (needs verification)
    UPDATE public.users 
    SET tax_id_verified = false 
    WHERE tax_id IS NOT NULL AND tax_id_verified IS NULL;
  END IF;
END $$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_users_tax_id_verified ON public.users(tax_id_verified) WHERE tax_id_verified = true;

