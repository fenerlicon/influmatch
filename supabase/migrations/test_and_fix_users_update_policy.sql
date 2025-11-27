-- Test and fix RLS policy for users table UPDATE operations
-- This ensures users can update their own profiles

-- First, check current policy
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'users' AND policyname = 'Users can update their own profile';

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

-- Create policy with both USING and WITH CHECK clauses
CREATE POLICY "Users can update their own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Verify the policy was created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'users' AND policyname = 'Users can update their own profile';

