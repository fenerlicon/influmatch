-- Kampanyalar (marka) + musaitlik (influencer/UGC) (2026-10-14, yol haritasi ozellik 4, SYSTEM_MAP 3.19).
-- Eklemeli degisiklik: yeni tablo, yeni kolonlar, indeksler, sahiplik tetikleyicileri. Canliya 2026-10-14 uygulandi.
--
-- Kampanya markaya aittir. Istemciye yalnizca sahibine (ve admin'e) SELECT acik; butun yazimlar sunucu kodundan
-- (lib/campaigns.ts, service role) rol ve sahiplik kontrolunden sonra. Davet edilen influencer brief'i yalnizca sunucu
-- kodu uzerinden gorur (teklifin alicisi / is birliginin tarafi oldugu kontrol edilerek); influencer'a dar bir RLS
-- politikasi acilmaz, boylece kampanyanin hedef, butce ve diger davetliler gibi alanlari istemciye hic gitmez.
--
-- Teklif ve ilan kampanyaya campaign_id ile baglanir. Teklifte istemci yalnizca INSERT yapabilir (UPDATE yalnizca status);
-- ilanda marka kendi satirini gunceller. Iki yolda da kampanya baska markaya aitse tetikleyici reddeder.
--
-- Musaitlik users tablosunda; yazim yalnizca sunucudan (lib/availability.ts, service role). users_before_update_guard
-- beyaz listesinde olmadigi icin istemci guncellemesi bu kolonlari sessizce dusurur. Sahibi kendi satirini okuyabilsin
-- diye kolon SELECT yetkisi verilir; diger profillerde lib/profile-reads.ts kart alanlariyla okunur.

-- 1) Kampanyalar ------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  goal text CHECK (goal IS NULL OR char_length(goal) <= 1000),
  key_messages text CHECK (key_messages IS NULL OR char_length(key_messages) <= 1500),
  dos text CHECK (dos IS NULL OR char_length(dos) <= 1500),
  donts text CHECK (donts IS NULL OR char_length(donts) <= 1500),
  example_links text[] NOT NULL DEFAULT '{}' CHECK (coalesce(array_length(example_links, 1), 0) <= 10),
  hashtags text[] NOT NULL DEFAULT '{}' CHECK (coalesce(array_length(hashtags, 1), 0) <= 20),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 1500),
  target_categories text[] NOT NULL DEFAULT '{}' CHECK (coalesce(array_length(target_categories, 1), 0) <= 20),
  target_cities text[] NOT NULL DEFAULT '{}' CHECK (coalesce(array_length(target_cities, 1), 0) <= 20),
  target_platforms text[] NOT NULL DEFAULT '{}' CHECK (target_platforms <@ ARRAY['instagram', 'tiktok']::text[]),
  target_creator_type text CHECK (target_creator_type IS NULL OR target_creator_type IN ('influencer', 'ugc')),
  min_followers integer CHECK (min_followers IS NULL OR min_followers BETWEEN 0 AND 1000000000),
  max_followers integer CHECK (max_followers IS NULL OR max_followers BETWEEN 0 AND 1000000000),
  total_budget integer CHECK (total_budget IS NULL OR total_budget BETWEEN 0 AND 100000000),
  start_date date,
  end_date date,
  default_deliverables jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(default_deliverables) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaigns_dates_check CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date),
  CONSTRAINT campaigns_followers_check CHECK (min_followers IS NULL OR max_followers IS NULL OR max_followers >= min_followers)
);
CREATE INDEX IF NOT EXISTS idx_campaigns_brand_id ON public.campaigns USING btree (brand_id, created_at DESC);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.campaigns FROM anon, authenticated;
REVOKE SELECT ON public.campaigns FROM anon;
GRANT SELECT ON public.campaigns TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'campaigns' AND policyname = 'Brands read own campaigns') THEN
    CREATE POLICY "Brands read own campaigns" ON public.campaigns
      FOR SELECT TO authenticated
      USING (brand_id = (SELECT auth.uid()) OR public.is_admin());
  END IF;
END $$;

-- 2) Teklif ve ilan baglantisi -----------------------------------------------------------------------

ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL;
ALTER TABLE public.advert_projects ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_offers_campaign_id ON public.offers USING btree (campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_advert_projects_campaign_id ON public.advert_projects USING btree (campaign_id) WHERE campaign_id IS NOT NULL;

-- Kampanya yalnizca kendi markasinin teklifine / ilanina baglanabilir (istemci ve sunucu yazimlari icin yedek kontrol).
CREATE OR REPLACE FUNCTION public.enforce_campaign_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.campaign_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.campaign_id IS NOT DISTINCT FROM OLD.campaign_id THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'offers' THEN
    IF NOT EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = NEW.campaign_id AND c.brand_id = NEW.sender_user_id) THEN
      RAISE EXCEPTION 'campaign_owner_mismatch';
    END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = NEW.campaign_id AND c.brand_id = NEW.brand_user_id) THEN
      RAISE EXCEPTION 'campaign_owner_mismatch';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.enforce_campaign_owner() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER enforce_campaign_owner_offers
  BEFORE INSERT OR UPDATE OF campaign_id ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_campaign_owner();
CREATE OR REPLACE TRIGGER enforce_campaign_owner_adverts
  BEFORE INSERT OR UPDATE OF campaign_id ON public.advert_projects
  FOR EACH ROW EXECUTE FUNCTION public.enforce_campaign_owner();

-- 3) Musaitlik ---------------------------------------------------------------------------------------

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS availability_status text NOT NULL DEFAULT 'open';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS availability_note text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS availability_until date;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS availability_updated_at timestamptz;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_availability_status_check') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_availability_status_check CHECK (availability_status IN ('open', 'busy'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_availability_note_check') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_availability_note_check CHECK (availability_note IS NULL OR char_length(availability_note) <= 140);
  END IF;
END $$;
GRANT SELECT (availability_status, availability_note, availability_until, availability_updated_at) ON public.users TO authenticated;
