-- Fix RLS policies for support_tickets table
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can create their own support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can view their own support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admins can view all support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admins can update support tickets" ON public.support_tickets;

-- Ensure RLS is enabled
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Users can create their own support tickets
-- Using auth.uid() to match the authenticated user's ID
CREATE POLICY "Users can create their own support tickets"
  ON public.support_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own support tickets
CREATE POLICY "Users can view their own support tickets"
  ON public.support_tickets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all support tickets
CREATE POLICY "Admins can view all support tickets"
  ON public.support_tickets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND (role = 'admin' OR email = 'admin@influmatch.net')
    )
  );

-- Admins can update support tickets
CREATE POLICY "Admins can update support tickets"
  ON public.support_tickets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND (role = 'admin' OR email = 'admin@influmatch.net')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND (role = 'admin' OR email = 'admin@influmatch.net')
    )
  );

