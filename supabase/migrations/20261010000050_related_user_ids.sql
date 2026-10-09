-- 3.17-S2 (2026-10-10), 1. parca: eklemeli, canliya uygulandi.
-- Oturum sahibinin "iliskili taraflari": teklif (iki yon), sohbet odasi, is birligi ve ilan basvurusu (basvuran ile ilan sahibi).
-- users / social_accounts SELECT politikalari daraltilinca (20261010000051) baskasinin satiri yalnizca bu kimlikler icin okunur;
-- teklif, sohbet, basvuru ve is birligi ekranlarindaki karsi taraf kartlari bozulmaz. Diger profiller yalnizca sunucu kodundan
-- (service role, kesif carki kurali uygulanarak) gelir: lib/profile-reads.ts.
-- SECURITY DEFINER: tablolarin RLS kurallarina takilmadan yalnizca auth.uid() ile iliskili kimlikleri dondurur, baska veri dondurmez.

CREATE OR REPLACE FUNCTION public.my_related_user_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT o.receiver_user_id FROM public.offers o WHERE o.sender_user_id = auth.uid()
  UNION
  SELECT o.sender_user_id FROM public.offers o WHERE o.receiver_user_id = auth.uid()
  UNION
  SELECT r.influencer_id FROM public.rooms r WHERE r.brand_id = auth.uid()
  UNION
  SELECT r.brand_id FROM public.rooms r WHERE r.influencer_id = auth.uid()
  UNION
  SELECT c.influencer_id FROM public.collaborations c WHERE c.brand_id = auth.uid()
  UNION
  SELECT c.brand_id FROM public.collaborations c WHERE c.influencer_id = auth.uid()
  UNION
  SELECT coalesce(a.influencer_user_id, a.influencer_id)
  FROM public.advert_applications a
  JOIN public.advert_projects p ON p.id = coalesce(a.advert_id, a.project_id)
  WHERE coalesce(p.brand_user_id, p.brand_id) = auth.uid()
  UNION
  SELECT coalesce(p.brand_user_id, p.brand_id)
  FROM public.advert_applications a
  JOIN public.advert_projects p ON p.id = coalesce(a.advert_id, a.project_id)
  WHERE coalesce(a.influencer_user_id, a.influencer_id) = auth.uid()
$$;

REVOKE EXECUTE ON FUNCTION public.my_related_user_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_related_user_ids() TO authenticated, service_role;
