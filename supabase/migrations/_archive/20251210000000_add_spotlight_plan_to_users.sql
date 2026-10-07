-- Add spotlight_plan column to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'spotlight_plan'
  ) THEN
    ALTER TABLE public.users 
    ADD COLUMN spotlight_plan text CHECK (spotlight_plan IN ('basic', 'pro') OR spotlight_plan IS NULL);

    -- Migrate existing spotlight users to 'pro' plan
    UPDATE public.users 
    SET spotlight_plan = 'pro' 
    WHERE spotlight_active = true AND spotlight_plan IS NULL;
  END IF;
END $$;
