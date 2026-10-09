-- Yol haritasi adim 3 (2026-10-10): ucretsiz marka sinirlari + kesif carki. KAPALI BAYRAKLA gelir:
-- free_brand_limits_enabled = false iken hicbir davranis degismez (tetikleyiciler ilk satirda cikar).
-- Eklemeli degisiklik: iki yeni tablo (RLS acik, istemcilere kapali / yalnizca sahibine SELECT), varsayilan ayar satirlari,
-- sinir fonksiyonu ve iki BEFORE tetikleyici (bayrak acikken sunucu kontrolunun DB tarafindaki yedegi), bir indeks.
-- Her tablo, RLS ve yetki geri almasi ile ayni blokta olusturulur (tablo bir an bile acik kalmasin).
-- Politikalar DROP POLICY olmadan, yoksa olusturulur.

-- 1) Platform ayarlari (anahtar/deger). Yalnizca sunucu (service role) okur ve yazar; admin paneli /admin/limits.

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY CHECK (key ~ '^[a-z0-9_]{1,64}$'),
  value jsonb NOT NULL DEFAULT 'null'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.platform_settings FROM anon, authenticated;
REVOKE SELECT ON public.platform_settings FROM anon, authenticated;

-- Varsayilanlar (kullanici karari 2026-10-10). null = sinirsiz. Basic degerleri paket icerigiyle belirlenecek.
INSERT INTO public.platform_settings (key, value) VALUES
  ('free_brand_limits_enabled', 'false'::jsonb),
  ('wheel_profiles_per_day', '10'::jsonb),
  ('wheel_window_hours', '24'::jsonb),
  ('free_offers_per_day', '3'::jsonb),
  ('free_offers_per_month', '15'::jsonb),
  ('free_active_adverts', '1'::jsonb),
  ('basic_offers_per_day', 'null'::jsonb),
  ('basic_offers_per_month', 'null'::jsonb),
  ('basic_active_adverts', 'null'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 2) Kesif carki cevirmeleri. Marka yalnizca kendi satirlarini okur; yazim yalnizca sunucudan (lib/discovery-wheel.ts).

CREATE TABLE IF NOT EXISTS public.discovery_spins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  influencer_ids uuid[] NOT NULL DEFAULT '{}'::uuid[] CHECK (cardinality(influencer_ids) <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT discovery_spins_expiry_check CHECK (expires_at > created_at)
);
ALTER TABLE public.discovery_spins ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.discovery_spins FROM anon, authenticated;
REVOKE SELECT ON public.discovery_spins FROM anon;
GRANT SELECT ON public.discovery_spins TO authenticated;

CREATE INDEX IF NOT EXISTS idx_discovery_spins_brand_created ON public.discovery_spins USING btree (brand_id, created_at DESC);

DO $p$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'discovery_spins' AND policyname = 'discovery_spins select owner') THEN
    CREATE POLICY "discovery_spins select owner" ON public.discovery_spins AS PERMISSIVE FOR SELECT TO authenticated
      USING (brand_id = (SELECT auth.uid()));
  END IF;
END
$p$;

-- 3) Sinir fonksiyonu: markanin gecerli sinirini dondurur; null = sinir yok (bayrak kapali, Pro, marka degil ya da deger bos).
-- p_kind: offers_per_day | offers_per_month | active_adverts. Plan: aktif Spotlight mpro = pro, diger aktif Spotlight = basic, yoksa free.
-- Ayni kural sunucuda lib/brand-limits.ts icinde; ikisi birlikte degistirilmeli.

CREATE OR REPLACE FUNCTION public.brand_limit_for(p_brand uuid, p_kind text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH flag AS (
    SELECT coalesce((SELECT value = 'true'::jsonb FROM public.platform_settings WHERE key = 'free_brand_limits_enabled'), false) AS enabled
  ),
  plan AS (
    SELECT CASE
      WHEN u.spotlight_active IS TRUE AND (u.spotlight_expires_at IS NULL OR u.spotlight_expires_at > now())
        THEN CASE WHEN u.spotlight_plan = 'mpro' THEN 'pro' ELSE 'basic' END
      ELSE 'free'
    END AS name
    FROM public.users u
    WHERE u.id = p_brand AND u.role = 'brand'
  )
  SELECT CASE
    WHEN NOT (SELECT enabled FROM flag) THEN NULL
    WHEN p_kind NOT IN ('offers_per_day', 'offers_per_month', 'active_adverts') THEN NULL
    WHEN (SELECT name FROM plan) IS NULL OR (SELECT name FROM plan) = 'pro' THEN NULL
    ELSE (
      SELECT CASE WHEN jsonb_typeof(s.value) = 'number' THEN greatest(0, floor((s.value #>> '{}')::numeric))::integer END
      FROM public.platform_settings s
      WHERE s.key = (SELECT name FROM plan) || '_' || p_kind
    )
  END;
$function$;
REVOKE EXECUTE ON FUNCTION public.brand_limit_for(uuid, text) FROM PUBLIC, anon, authenticated;

-- 4) Teklif siniri (gun / takvim ayi, Europe/Istanbul). Yalnizca istemci oturumunda (authenticated) uygulanir.

CREATE INDEX IF NOT EXISTS idx_offers_sender_created_at ON public.offers USING btree (sender_user_id, created_at);

CREATE OR REPLACE FUNCTION public.enforce_brand_offer_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(auth.role(), '') <> 'authenticated' THEN
    RETURN NEW;
  END IF;
  IF public.brand_limit_for(NEW.sender_user_id, 'offers_per_day') IS NOT NULL
     AND (SELECT count(*) FROM public.offers o
          WHERE o.sender_user_id = NEW.sender_user_id
            AND o.created_at >= (date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul'))
         >= public.brand_limit_for(NEW.sender_user_id, 'offers_per_day') THEN
    RAISE EXCEPTION 'brand_limit:offers_per_day' USING ERRCODE = 'P0001';
  END IF;
  IF public.brand_limit_for(NEW.sender_user_id, 'offers_per_month') IS NOT NULL
     AND (SELECT count(*) FROM public.offers o
          WHERE o.sender_user_id = NEW.sender_user_id
            AND o.created_at >= (date_trunc('month', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul'))
         >= public.brand_limit_for(NEW.sender_user_id, 'offers_per_month') THEN
    RAISE EXCEPTION 'brand_limit:offers_per_month' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.enforce_brand_offer_limits() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER enforce_brand_offer_limits_trigger
  BEFORE INSERT ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_brand_offer_limits();

-- 5) Aktif ilan siniri: ilan acik olarak olusturulurken ya da yeniden acilirken.

CREATE OR REPLACE FUNCTION public.enforce_brand_advert_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(auth.role(), '') <> 'authenticated' OR NEW.status IS DISTINCT FROM 'open' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'open' THEN
    RETURN NEW;
  END IF;
  IF public.brand_limit_for(NEW.brand_user_id, 'active_adverts') IS NOT NULL
     AND (SELECT count(*) FROM public.advert_projects a
          WHERE a.brand_user_id = NEW.brand_user_id AND a.status = 'open' AND a.id <> NEW.id)
         >= public.brand_limit_for(NEW.brand_user_id, 'active_adverts') THEN
    RAISE EXCEPTION 'brand_limit:active_adverts' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.enforce_brand_advert_limits() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER enforce_brand_advert_limits_trigger
  BEFORE INSERT OR UPDATE OF status ON public.advert_projects
  FOR EACH ROW EXECUTE FUNCTION public.enforce_brand_advert_limits();
