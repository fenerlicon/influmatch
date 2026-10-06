-- ==============================================================================
-- SAATLİK GÖREV KURULUMU (Supabase pg_cron + pg_net)
--
-- Vercel Hobby planı saatte bir çalışan cron görevine izin vermediği için saatlik
-- bakım görevi (/api/cron/hourly) Supabase tarafından tetiklenir:
--   - Apify ve Gemini anahtarlarının kredi ve geçerlilik kontrolü
--   - Sorun varsa admin e-postasına özet
--
-- Bu dosya bir migration DEĞİLDİR; içine gizli anahtar yazılacağı için repoya
-- değiştirilmiş hali commit edilmemelidir.
--
-- KURULUM (bir kez, Supabase Dashboard > SQL Editor):
--   1. Vercel ortam değişkenlerinde CRON_SECRET tanımlı olmalı (refresh-stats görevi de kullanır).
--   2. Aşağıda BURAYA_CRON_SECRET yazan yeri aynı değerle değiştirin.
--   3. Site adresiniz farklıysa https://influmatch.net kısmını değiştirin.
--   4. Dosyanın tamamını çalıştırın.
--   pg_cron veya pg_net komutu yetki hatası verirse: Database > Extensions ekranından
--   ikisini etkinleştirip dosyayı tekrar çalıştırın.
--
-- KONTROL:
--   Kayıtlı görevler:  SELECT * FROM cron.job;
--   Son çalışmalar:    SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;
--   HTTP yanıtları:    SELECT status_code, content FROM net._http_response ORDER BY created DESC LIMIT 5;
--   Admin paneli /admin/api-keys sayfasında "Son otomatik kontrol" zamanını da gösterir.
--
-- KALDIRMA:  SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = $$influmatch-hourly$$;
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Gizli anahtar Vault içinde saklanır; cron.job tablosunda açık metin olarak görünmez.
-- Dosya tekrar çalıştırılırsa mevcut kayıt korunur (değiştirmek için vault.update_secret kullanın).
SELECT vault.create_secret('BURAYA_CRON_SECRET', 'influmatch_cron_secret', 'Influmatch saatlik görev CRON_SECRET')
WHERE NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'influmatch_cron_secret');

-- Aynı isimle tekrar çalıştırılırsa mevcut görev güncellenir.
SELECT cron.schedule(
  'influmatch-hourly',
  '0 * * * *',
  $$
  SELECT net.http_get(
    url := 'https://influmatch.net/api/cron/hourly',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'influmatch_cron_secret')
    ),
    timeout_milliseconds := 60000
  );
  $$
);
