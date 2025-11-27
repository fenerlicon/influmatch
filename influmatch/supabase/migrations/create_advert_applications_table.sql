-- Create advert_applications table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.advert_applications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4()
);

-- Add columns if they don't exist
DO $$
BEGIN
  -- Add influencer_user_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'advert_applications' 
    AND column_name = 'influencer_user_id'
  ) THEN
    ALTER TABLE public.advert_applications 
    ADD COLUMN influencer_user_id uuid REFERENCES public.users(id) ON DELETE CASCADE;
    
    ALTER TABLE public.advert_applications 
    ALTER COLUMN influencer_user_id SET NOT NULL;
  END IF;

  -- Add advert_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'advert_applications' 
    AND column_name = 'advert_id'
  ) THEN
    ALTER TABLE public.advert_applications 
    ADD COLUMN advert_id uuid REFERENCES public.advert_projects(id) ON DELETE CASCADE;
    
    ALTER TABLE public.advert_applications 
    ALTER COLUMN advert_id SET NOT NULL;
  END IF;

  -- Add cover_letter column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'advert_applications' 
    AND column_name = 'cover_letter'
  ) THEN
    ALTER TABLE public.advert_applications 
    ADD COLUMN cover_letter text;
  END IF;

  -- Add deliverable_idea column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'advert_applications' 
    AND column_name = 'deliverable_idea'
  ) THEN
    ALTER TABLE public.advert_applications 
    ADD COLUMN deliverable_idea text;
  END IF;

  -- Add budget_expectation column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'advert_applications' 
    AND column_name = 'budget_expectation'
  ) THEN
    ALTER TABLE public.advert_applications 
    ADD COLUMN budget_expectation numeric(12,2);
  END IF;

  -- Add status column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'advert_applications' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.advert_applications 
    ADD COLUMN status text NOT NULL DEFAULT 'pending';
    
    -- Add check constraint for status
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'advert_applications_status_check'
    ) THEN
      ALTER TABLE public.advert_applications 
      ADD CONSTRAINT advert_applications_status_check 
      CHECK (status IN ('pending', 'shortlisted', 'rejected', 'accepted'));
    END IF;
  END IF;

  -- Add created_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'advert_applications' 
    AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.advert_applications 
    ADD COLUMN created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now());
  END IF;
END $$;

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'advert_applications_advert_id_influencer_user_id_key'
  ) THEN
    -- First check if both columns exist
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'advert_applications' 
      AND column_name = 'advert_id'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'advert_applications' 
      AND column_name = 'influencer_user_id'
    ) THEN
      ALTER TABLE public.advert_applications 
      ADD CONSTRAINT advert_applications_advert_id_influencer_user_id_key 
      UNIQUE (advert_id, influencer_user_id);
    END IF;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.advert_applications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Influencers manage their applications" ON public.advert_applications;
DROP POLICY IF EXISTS "Brands view applications to their adverts" ON public.advert_applications;

-- Create RLS policies
CREATE POLICY "Influencers manage their applications"
  ON public.advert_applications
  FOR ALL
  USING (auth.uid() = influencer_user_id)
  WITH CHECK (auth.uid() = influencer_user_id);

CREATE POLICY "Brands view applications to their adverts"
  ON public.advert_applications
  FOR SELECT
  USING (EXISTS (
    SELECT 1
    FROM public.advert_projects ap
    WHERE ap.id = advert_id AND ap.brand_user_id = auth.uid()
  ));

