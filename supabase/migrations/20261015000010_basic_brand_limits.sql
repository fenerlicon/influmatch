-- 2026-10-15 kullanıcı kararı (SYSTEM_MAP 4.3-N1): Marka Basic sınırları — günde 10 / ayda 60 teklif, 3 aktif ilan.
-- Yalnızca free_brand_limits_enabled açıkken uygulanır (satış başlayınca). Pro sınırsız, ücretsiz 3 / 15 / 1.
-- Canlıya 2026-10-15'te uygulandı.
UPDATE public.platform_settings
SET value = CASE key
    WHEN 'basic_offers_per_day' THEN '10'::jsonb
    WHEN 'basic_offers_per_month' THEN '60'::jsonb
    WHEN 'basic_active_adverts' THEN '3'::jsonb
  END,
  updated_at = now()
WHERE key IN ('basic_offers_per_day', 'basic_offers_per_month', 'basic_active_adverts');
