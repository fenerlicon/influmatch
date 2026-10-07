-- ==============================================================================
-- 2026-10-09 ŞEMA DÜZELTMESİ — Supabase Dashboard > SQL Editor'de çalıştırın.
-- İçerik: 20261009000002 (social_accounts korumaları). Tekrar çalıştırılabilir.
-- Not: 20261009000000 temel dosyası canlıda zaten var; onu çalıştırmaya gerek yok.
-- ==============================================================================

-- ==============================================================================
-- 2026-10-09: social_accounts güncelleme korumaları tabloda olmayan kolonlara yazıyordu (SYSTEM_MAP 7.4-S8)
--
-- restrict_social_accounts_columns: following_count ve verified_at kolonları yok.
-- protect_social_account_metrics: avg_likes kolonu yok.
-- Admin olmayan oturumlu bir kullanıcı bu tabloyu güncellemeye kalksa trigger hata verirdi. Bugün istemcide
-- UPDATE kuralı olmadığı ve tüm yazımlar service role ile yapıldığı için tetiklenmiyordu; koruma yine de
-- doğru kolonlarla çalışır hale getirildi. Doğrulama kodu ve kazıma kilidi kolonları da korunur.
--
-- SQL Editor uyumu: fonksiyonlarda DECLARE yok, yorumlarda tek tırnak ve soru işareti yok.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.restrict_social_accounts_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'authenticated' THEN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
      NEW.is_verified = OLD.is_verified;
      NEW.follower_count = OLD.follower_count;
      NEW.engagement_rate = OLD.engagement_rate;
      NEW.has_stats = OLD.has_stats;
      NEW.stats_payload = OLD.stats_payload;
      NEW.platform_user_id = OLD.platform_user_id;
      NEW.verification_code = OLD.verification_code;
      NEW.last_scraped_at = OLD.last_scraped_at;
      NEW.scrape_lock_until = OLD.scrape_lock_until;
      NEW.scrape_attempts = OLD.scrape_attempts;
      NEW.scrape_window_started_at = OLD.scrape_window_started_at;
      NEW.scrape_fail_count = OLD.scrape_fail_count;
      NEW.scrape_retry_after = OLD.scrape_retry_after;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Aynı işi yapan ikinci trigger fonksiyonu; olmayan kolonu çıkarıp birincisiyle uyumlu hale getirildi.
CREATE OR REPLACE FUNCTION public.protect_social_account_metrics()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (auth.jwt() ->> 'role' = 'authenticated') THEN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
      NEW.follower_count = OLD.follower_count;
      NEW.engagement_rate = OLD.engagement_rate;
      NEW.stats_payload = OLD.stats_payload;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
