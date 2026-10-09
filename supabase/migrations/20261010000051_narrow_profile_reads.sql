-- 3.17-S2 (2026-10-10), 2. parca: users ve social_accounts SELECT politikalarinin daraltilmasi.
-- !!! CANLIYA YALNIZCA bu daldaki kod (claude/profile-reads-server) uretimde yayina girdikten SONRA uygulanir. !!!
-- Once uygulanirsa eski kod (kesif, profil sayfasi, mobil Kesfet / marka ana sayfasi) baskasinin satirini okuyamaz ve listeler bos gelir.
--
-- Sonra:
--   users           : kendi satiri + admin + iliskili taraflar (my_related_user_ids: teklif, sohbet, is birligi, ilan basvurusu).
--   social_accounts : ayni kural; anon rolune artik hicbir satir donmez (eskiden "public" + true idi: giris yapmadan okunuyordu).
-- Diger profiller (kesif, profil sayfasi, vitrin, ilan sahibi kartlari) yalnizca sunucu kodundan, service role ile ve kesif carki
-- kurali uygulanarak okunur (lib/profile-reads.ts). Gizli kolonlarin kolon yetkileri degismez.
-- DROP POLICY yok; yalnizca ALTER POLICY (geri almak icin USING (true) ile ayni komut).

ALTER POLICY "Authenticated users can view profiles" ON public.users
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
    OR id IN (SELECT public.my_related_user_ids())
  );

ALTER POLICY "Public can view verified social accounts" ON public.social_accounts
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
    OR user_id IN (SELECT public.my_related_user_ids())
  );

-- Geri alma (gerekirse):
-- ALTER POLICY "Authenticated users can view profiles" ON public.users TO authenticated USING (true);
-- ALTER POLICY "Public can view verified social accounts" ON public.social_accounts TO public USING (true);
