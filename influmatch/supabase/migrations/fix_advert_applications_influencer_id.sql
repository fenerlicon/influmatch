-- Fix RLS policies to use influencer_id instead of influencer_user_id
-- This migration assumes the database column is named 'influencer_id'

-- Drop existing policies
DROP POLICY IF EXISTS "Influencers manage their applications" ON public.advert_applications;
DROP POLICY IF EXISTS "Brands view applications to their adverts" ON public.advert_applications;

-- Recreate policies with influencer_id
CREATE POLICY "Influencers manage their applications"
  ON public.advert_applications
  FOR ALL
  USING (auth.uid() = influencer_id)
  WITH CHECK (auth.uid() = influencer_id);

CREATE POLICY "Brands view applications to their adverts"
  ON public.advert_applications
  FOR SELECT
  USING (EXISTS (
    SELECT 1
    FROM public.advert_projects ap
    WHERE ap.id = advert_id AND ap.brand_user_id = auth.uid()
  ));

