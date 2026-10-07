-- Add advert_application_id column to rooms table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'rooms' 
    AND column_name = 'advert_application_id'
  ) THEN
    ALTER TABLE public.rooms 
    ADD COLUMN advert_application_id uuid REFERENCES public.advert_applications(id) ON DELETE CASCADE;
  END IF;
END $$;

