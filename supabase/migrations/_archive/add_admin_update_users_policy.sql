-- Add RLS policy for admins to update any user's verification status
-- This allows admins to verify/reject users in the admin panel

-- Drop existing admin policy if it exists
DROP POLICY IF EXISTS "Admins can update any user" ON public.users;

-- Create policy for admins to update any user
CREATE POLICY "Admins can update any user"
  ON public.users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 
      FROM public.users 
      WHERE id = auth.uid() 
      AND (role = 'admin' OR email = 'admin@influmatch.net')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.users 
      WHERE id = auth.uid() 
      AND (role = 'admin' OR email = 'admin@influmatch.net')
    )
  );

