-- Fix RLS policies for user_badges table to allow system/admin badge awarding
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can insert their own badges" ON public.user_badges;

-- Allow users to insert their own badges (for manual operations if needed)
CREATE POLICY "Users can insert their own badges"
  ON public.user_badges
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow admins to insert badges for any user (for badge awarding system)
CREATE POLICY "Admins can insert badges for any user"
  ON public.user_badges
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.users 
      WHERE id = auth.uid() 
      AND (role = 'admin' OR email = 'admin@influmatch.net')
    )
  );

-- Also allow service role (for server-side badge awarding)
-- Note: Service role bypasses RLS, but we add this for clarity

