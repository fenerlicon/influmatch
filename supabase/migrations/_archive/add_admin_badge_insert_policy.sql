-- Add RLS policy for admins/system to insert badges for any user
-- This allows the badge awarding system to work properly

-- Drop existing admin badge policy if it exists
DROP POLICY IF EXISTS "Admins can insert badges for any user" ON public.user_badges;

-- Create policy for admins to insert badges
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

