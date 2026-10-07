-- Fix all RLS policies for users table
-- This ensures all operations work correctly

-- 1. SELECT policy - Everyone can read profiles
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.users;

CREATE POLICY "Profiles are viewable by everyone"
  ON public.users
  FOR SELECT
  USING (true);

-- 2. INSERT policy - Users can insert their own profile
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;

CREATE POLICY "Users can insert their own profile"
  ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 3. UPDATE policy - Users can update their own profile
-- Drop both versions if they exist
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

CREATE POLICY "Users can update their own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4. DELETE policy - Users can delete their own profile
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.users;

CREATE POLICY "Users can delete their own profile"
  ON public.users
  FOR DELETE
  USING (auth.uid() = id);

-- 5. Admin policy - Admins can update any user (keep if exists)
-- This is optional, only if you have admin role

-- Verify all policies
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY cmd, policyname;

