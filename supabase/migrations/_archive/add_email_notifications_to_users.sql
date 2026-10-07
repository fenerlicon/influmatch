-- Add email_notifications column to users table (safe migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'email_notifications'
  ) THEN
    ALTER TABLE public.users 
    ADD COLUMN email_notifications JSONB DEFAULT '{
      "offers": true,
      "advert_applications": true,
      "messages": true,
      "marketing": false,
      "updates": true
    }'::jsonb;
    
    -- Update existing users with default settings
    UPDATE public.users 
    SET email_notifications = '{
      "offers": true,
      "advert_applications": true,
      "messages": true,
      "marketing": false,
      "updates": true
    }'::jsonb
    WHERE email_notifications IS NULL;
  ELSE
    -- Column exists, just update NULL values
    UPDATE public.users 
    SET email_notifications = '{
      "offers": true,
      "advert_applications": true,
      "messages": true,
      "marketing": false,
      "updates": true
    }'::jsonb
    WHERE email_notifications IS NULL;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN public.users.email_notifications IS 'Email notification preferences stored as JSONB';

