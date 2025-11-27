-- Add DELETE policy for users table
-- Users can delete their own profile

DROP POLICY IF EXISTS "Users can delete their own profile" ON public.users;

CREATE POLICY "Users can delete their own profile"
  ON public.users
  FOR DELETE
  USING (auth.uid() = id);

