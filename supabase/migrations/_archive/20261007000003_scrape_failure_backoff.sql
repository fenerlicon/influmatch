-- ==============================================================================
-- OTOMATIK YENILEMEDE BOZUK HESAP BEKLETMESI
--
-- Gizli, silinmis veya adi degismis hesaplar otomatik istatistik yenilemesinde her saat
-- basarisiz olup kuyrugun basini tikiyordu (ve her denemede ucretli Apify kosusu yakiyordu).
-- lib/social-stats.ts refreshStaleAccounts: hesaba ozel hatada scrape_retry_after ileri alinir
-- (1, 2, 4 gun; en fazla 7 gun), basarida sifirlanir.
--
-- Supabase SQL Editor uyumu: DECLARE yok, yorumlarda tek tirnak yok, soru isareti yok.
-- ==============================================================================

ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS scrape_fail_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS scrape_retry_after timestamptz;
