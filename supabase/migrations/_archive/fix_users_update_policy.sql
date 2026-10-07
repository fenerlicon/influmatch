-- Fix RLS policy for users table UPDATE operations
-- This adds the missing WITH CHECK clause to allow upsert operations

-- Drop and recreate the update policy with both USING and WITH CHECK
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

CREATE POLICY "Users can update their own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

