-- ==============================================================================
-- ILAN BASVURUSU POLITIKALARI (7.7-S1, 2.12-S1)
--
-- Permissive politikalar OR ile birlestigi icin eski gevsek iki politika yeni kurallari
-- etkisiz birakiyordu:
--   "Influencers can apply": yalnizca auth.uid() = influencer_id istiyordu; marka veya
--   onaysiz hesap REST ile basvuru acabiliyordu.
--   "Influencers can delete their own applications": kabul edilmis basvuru da silinebiliyordu.
-- Yeni basvuru kurali: onayli influencer, ilan acik, son basvuru gunu gecmemis
-- (Turkiye saatiyle, gun dahil), iki kimlik kolonu da basvuranin kendisi.
--
-- Supabase SQL Editor uyumu: DECLARE yok, yorumlarda tek tirnak yok, soru isareti yok.
-- ==============================================================================

DROP POLICY IF EXISTS "Influencers can apply" ON public.advert_applications;
DROP POLICY IF EXISTS "Influencers can delete their own applications" ON public.advert_applications;

DROP POLICY IF EXISTS "Influencers can apply to adverts" ON public.advert_applications;
CREATE POLICY "Influencers can apply to adverts" ON public.advert_applications
  FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE(influencer_user_id, influencer_id) = auth.uid()
    AND (influencer_id IS NULL OR influencer_id = auth.uid())
    AND (influencer_user_id IS NULL OR influencer_user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'influencer' AND u.verification_status = 'verified'
    )
    AND EXISTS (
      SELECT 1 FROM public.advert_projects ap
      WHERE ap.id = advert_applications.advert_id
        AND ap.status = 'open'
        AND (ap.deadline IS NULL OR ap.deadline >= (now() AT TIME ZONE 'Europe/Istanbul')::date)
    )
  );

DROP POLICY IF EXISTS "Influencers delete their own applications" ON public.advert_applications;
CREATE POLICY "Influencers delete their own applications" ON public.advert_applications
  FOR DELETE TO authenticated
  USING (
    (influencer_user_id = auth.uid() OR influencer_id = auth.uid())
    AND status <> ALL (ARRAY['accepted', 'shortlisted'])
  );
