-- 2026-10-15: ilan soru yanitlari, ilan kategorisi listesi, anlik ilan alarmi ve alarm gonderim kaydi
-- (SYSTEM_MAP 3.7-S5, 3.7-S6, 3.15-S1, 3.15-S2, 3.15-S3, 3.8-S6). Hepsi eklemeli; tekrar calistirilabilir.
-- Eski ilan kategorilerinin eslemesi ayri dosyada (20261015000021), kod yayina girdikten sonra uygulanir.

-- 3.7-S6: basvuruda markanin sorularina yanitlar. Dogrulama sunucuda (lib/adverts.ts validateAnswers);
-- DB yalnizca bicim ve boyut sinirini uygular.
ALTER TABLE public.advert_applications ADD COLUMN IF NOT EXISTS answers jsonb;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'advert_applications_answers_check') THEN
    ALTER TABLE public.advert_applications
      ADD CONSTRAINT advert_applications_answers_check
      CHECK (answers IS NULL OR (jsonb_typeof(answers) = 'array' AND jsonb_array_length(answers) <= 10 AND pg_column_size(answers) <= 20000));
  END IF;
END $$;

-- 3.8-S6: istemci basvuruda yalnizca durumu guncelleyebilir (marka, kendi ilaninin basvurusunda; RLS + protect_application_status).
-- Onceden marka niyet mesajini / yanitlari / butce beklentisini da degistirebiliyordu; anon da tum yazma yetkilerine sahipti.
REVOKE UPDATE ON public.advert_applications FROM anon, authenticated;
GRANT UPDATE (status) ON public.advert_applications TO authenticated;
REVOKE INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.advert_applications FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.advert_applications FROM authenticated;

-- 3.15-S2: alarmda kategori secimi (influencer kategori anahtari); eski category kolonu anahtar kelime olarak kalir.
ALTER TABLE public.advert_alerts ADD COLUMN IF NOT EXISTS category_key text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'advert_alerts_category_key_check') THEN
    ALTER TABLE public.advert_alerts
      ADD CONSTRAINT advert_alerts_category_key_check CHECK (category_key IS NULL OR category_key ~ '^[a-z_]{2,30}$');
  END IF;
END $$;

-- 3.15-S1 / 3.15-S3: ilan + kullanici basina tek alarm bildirimi. Anlik gonderim (Spotlight) ve saatlik gorev ayni
-- tabloya yazar; tekil anahtar cift bildirimi engeller, sureye sigmayan alicilar sonraki saatte tamamlanir.
CREATE TABLE IF NOT EXISTS public.advert_alert_deliveries (
  advert_id uuid NOT NULL REFERENCES public.advert_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'hourly' CHECK (channel IN ('instant', 'hourly')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (advert_id, user_id)
);
ALTER TABLE public.advert_alert_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.advert_alert_deliveries FROM anon, authenticated;
REVOKE SELECT ON public.advert_alert_deliveries FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_advert_alert_deliveries_user_id ON public.advert_alert_deliveries (user_id);

-- Ilan tamamlandi mi (tum eslesen alicilara gonderildi). Varsayilan now(): eski kodun (yayin oncesi) yazdigi satirlar
-- islenmis sayilir, yeni kod bitiremedigi ilanda acikca NULL yazar. Mevcut satirlar islenmis sayilir.
ALTER TABLE public.advert_alert_runs ADD COLUMN IF NOT EXISTS completed_at timestamptz DEFAULT now();
UPDATE public.advert_alert_runs SET completed_at = processed_at WHERE completed_at IS NULL;

-- Dogrulama
SELECT
  (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'advert_applications' AND column_name = 'answers') AS answers_col,
  (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'advert_alert_deliveries') AS deliveries_rls;
