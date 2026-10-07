-- ==============================================================================
-- APIFY HARCAMA SINIRI (sosyal hesap kazıma kilidi ve deneme sayacı)
--
-- Her doğrulama veya istatistik yenileme ücretli bir Apify koşusudur. lib/social-stats.ts:
-- 1. scrape_lock_until: aynı hesap için aynı anda tek koşu (atomik UPDATE ile alınır,
--    süre dolunca kendiliğinden düşer).
-- 2. scrape_attempts + scrape_window_started_at: saatlik deneme sayacı.
-- Bu kolonlara yalnızca sunucu yazar (social_accounts yazma yetkisi istemcide yok).
--
-- Supabase SQL Editor uyumu: DECLARE yok, yorumlarda tek tırnak yok, soru işareti yok.
-- ==============================================================================

ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS scrape_lock_until timestamptz;
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS scrape_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS scrape_window_started_at timestamptz;
