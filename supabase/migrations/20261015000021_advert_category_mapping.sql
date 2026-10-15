-- 2026-10-15 (SYSTEM_MAP 3.7-S5): eski serbest metin ilan kategorilerini influencer kategori anahtarina esler.
-- Kod (kategori secici + advertCategoryLabel) yayina girdikten SONRA uygulanir; once uygulanirsa eski surum
-- ekranda 'general' / 'fashion' gibi anahtarlari gosterir. Tekrar calistirilabilir.
-- 2026-10-15 canlida 4 farkli deger, 7 ilan vardi: Genel (4), Çanta -Cüzdan (1), Çanta (1), Bakım (1).
-- Listede olmayan baska deger kalirsa oldugu gibi gosterilir.
UPDATE public.advert_projects SET category = 'general' WHERE category IS NULL OR category IN ('Genel', '');
UPDATE public.advert_projects SET category = 'fashion' WHERE category IN ('Çanta -Cüzdan', 'Çanta');
UPDATE public.advert_projects SET category = 'beauty' WHERE category = 'Bakım';


-- Dogrulama
SELECT category, count(*) FROM public.advert_projects GROUP BY 1 ORDER BY 2 DESC;
