-- Create a function to delete auth user (requires service_role key)
-- This function should be called from a server-side admin context
-- For security, we'll create a trigger that automatically deletes auth user when public.users is deleted

-- Function to delete auth user when public.users is deleted
CREATE OR REPLACE FUNCTION public.handle_delete_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete from auth.users
  -- Note: This requires the service_role key to be used
  -- In practice, you may want to handle this differently
  -- For now, we'll just log that the user should be deleted from auth.users manually
  -- or use Supabase Admin API from your backend
  
  RETURN OLD;
END;
$$;

-- Create trigger (commented out for now - requires careful consideration)
-- DROP TRIGGER IF EXISTS on_user_deleted ON public.users;
-- CREATE TRIGGER on_user_deleted
--   AFTER DELETE ON public.users
--   FOR EACH ROW
--   EXECUTE FUNCTION public.handle_delete_auth_user();

