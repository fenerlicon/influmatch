-- Create trigger manually (if function exists but trigger doesn't)
-- Run this if handle_new_auth_user function exists but on_auth_user_created trigger is missing

-- First, ensure the function exists (it should already exist)
-- If not, the function creation will be skipped

-- Drop trigger if exists (to avoid conflicts)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- Note: In PostgreSQL 11+, use EXECUTE FUNCTION instead of EXECUTE PROCEDURE

