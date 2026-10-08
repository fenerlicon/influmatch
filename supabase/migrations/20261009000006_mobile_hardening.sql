-- Mobil parca 6: veritabani sikilastirma (mobil select('*') okumalari kaldirildiktan SONRA calistirin).
-- 2.1-S8: social_accounts.verification_code istemcilere kapatilir (kod sunucuda service role ile okunuyor).
REVOKE SELECT ON public.social_accounts FROM anon, authenticated;
GRANT SELECT (id, created_at, user_id, platform, username, platform_user_id, is_verified, has_stats, follower_count,
  engagement_rate, last_scraped_at, stats_payload, updated_at, scrape_lock_until, scrape_attempts,
  scrape_window_started_at, scrape_fail_count, scrape_retry_after) ON public.social_accounts TO anon, authenticated;

-- Avatar yuklemeleri artik yalnizca kendi klasorune: "Users can manage their own avatar" bunu karsiliyor.
DROP POLICY IF EXISTS "avatars insert" ON storage.objects;

-- Dogrulama
SELECT has_column_privilege('authenticated', 'public.social_accounts', 'verification_code', 'SELECT') AS kod_okunabilir;
SELECT count(*) AS avatars_insert_kalan FROM pg_policies WHERE schemaname = 'storage' AND policyname = 'avatars insert';
