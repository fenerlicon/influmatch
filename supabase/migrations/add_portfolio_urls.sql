-- Add portfolio_urls column to public.users table as a JSONB array
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'portfolio_urls'
  ) THEN
    ALTER TABLE public.users 
    ADD COLUMN portfolio_urls JSONB DEFAULT '[]'::JSONB;
  END IF;
END $$;
