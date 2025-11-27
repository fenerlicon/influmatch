-- Fix RLS policies for onboarding/profile creation
-- This ensures users can create and update their own profiles

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
-- Drop all versions
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

CREATE POLICY "Users can update their own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Verify policies
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY cmd, policyname;

-- Test: Check if current user can insert (should return true if logged in)
SELECT 
  CASE 
    WHEN auth.uid() IS NOT NULL THEN 'User is authenticated'
    ELSE 'User is not authenticated'
  END as auth_status,
  auth.uid() as user_id;

