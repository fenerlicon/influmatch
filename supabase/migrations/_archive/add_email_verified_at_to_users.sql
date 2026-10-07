-- Add email_verified_at column to public.users
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- Create function to sync email_confirmed_at from auth.users
CREATE OR REPLACE FUNCTION public.sync_email_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update public.users when email_confirmed_at changes in auth.users
  IF NEW.email_confirmed_at IS DISTINCT FROM OLD.email_confirmed_at THEN
    UPDATE public.users
    SET email_verified_at = NEW.email_confirmed_at
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_email_verified ON auth.users;
CREATE TRIGGER on_auth_user_email_verified
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_email_verification();

-- Initial sync for existing users
UPDATE public.users u
SET email_verified_at = au.email_confirmed_at
FROM auth.users au
WHERE u.id = au.id
  AND u.email_verified_at IS NULL
  AND au.email_confirmed_at IS NOT NULL;
