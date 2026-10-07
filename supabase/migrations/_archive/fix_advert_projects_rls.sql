-- Fix RLS policies for advert_projects table
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Brands can manage their adverts" ON public.advert_projects;

-- Create separate policies for better control
-- SELECT policy: Everyone can view open adverts or own drafts
DROP POLICY IF EXISTS "Everyone can view open adverts or own drafts" ON public.advert_projects;
CREATE POLICY "Everyone can view open adverts or own drafts"
  ON public.advert_projects
  FOR SELECT
  USING (status = 'open' OR auth.uid() = brand_user_id);

-- INSERT policy: Brands can insert their own adverts
CREATE POLICY "Brands can insert their own adverts"
  ON public.advert_projects
  FOR INSERT
  WITH CHECK (auth.uid() = brand_user_id);

-- UPDATE policy: Brands can update their own adverts
CREATE POLICY "Brands can update their own adverts"
  ON public.advert_projects
  FOR UPDATE
  USING (auth.uid() = brand_user_id)
  WITH CHECK (auth.uid() = brand_user_id);

-- DELETE policy: Brands can delete their own adverts
CREATE POLICY "Brands can delete their own adverts"
  ON public.advert_projects
  FOR DELETE
  USING (auth.uid() = brand_user_id);

