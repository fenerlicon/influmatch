-- Canlı veritabanında olup repodaki migration'larda olmayan şema parçaları (7.6).
-- Tümü idempotent; canlıda etkisizdir, sıfırdan kurulumu canlıyla aynı hale getirir.
-- Canlı tanımlar 2026-10-07'de information_schema / pg_constraint'ten okundu.

-- 7.6-S1: advert_applications.influencer_id (politikalar, web ve mobil kullanıyor)
ALTER TABLE public.advert_applications ADD COLUMN IF NOT EXISTS influencer_id uuid;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'advert_applications_influencer_id_fkey') THEN
    ALTER TABLE public.advert_applications
      ADD CONSTRAINT advert_applications_influencer_id_fkey
      FOREIGN KEY (influencer_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Başvuru durumları: arayüz 'shortlisted' (Ön Listede) kullanıyor; canlı kısıt bunu reddediyordu
-- (2026-10-07'de canlıda düzeltildi).
ALTER TABLE public.advert_applications DROP CONSTRAINT IF EXISTS advert_applications_status_check;
ALTER TABLE public.advert_applications
  ADD CONSTRAINT advert_applications_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'shortlisted'::text, 'accepted'::text, 'rejected'::text]));

-- 7.6-S2: social_accounts doğrulama/kazıma kolonları
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS verification_code varchar;
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS has_stats boolean DEFAULT false;
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS last_scraped_at timestamptz;

-- 7.6-S3: users.role 'admin' değerini kabul eder
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check CHECK (role = ANY (ARRAY['influencer'::text, 'brand'::text, 'admin'::text]));
