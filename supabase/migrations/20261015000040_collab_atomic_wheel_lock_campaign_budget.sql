-- Is birligi ve sayaclarda eszamanlilik / atomiklik duzeltmeleri + kampanya kisi basi butce (SYSTEM_MAP 3.18-S2, 3.18-S3, 3.17-S4, 3.19-S1).
-- Eklemeli degisiklik: yeni kolonlar, yeni fonksiyonlar (yalnizca service role), mevcut tetikleyici fonksiyonlarina danisma kilidi.
-- Mevcut veriye dokunmaz; yeniden acilan is birliginde eski kayitlarin silinmesi yalnizca gelecekteki yeniden acilislarda calisir.
-- Canli: 1, 4, 5 MCP ile uygulandi (2026-10-15). 2 ve 3 (govdesinde DELETE olan fonksiyonlar) MCP onayinda zaman asimina
-- ugradi; supabase/manual/2026-10-15_is_birligi_rpc.sql ile SQL Editor de calistirilir. Calistirilana kadar sunucu kodu
-- ayni isi eski yoldan (sirali yazim) yapar.

-- 1) Kampanya kisi basi butce ve planlanan profil sayisi (3.19-S1). Ikisi de istege bagli.
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS per_creator_budget integer;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS planned_creators integer;
DO $d$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_per_creator_budget_check') THEN
    ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_per_creator_budget_check
      CHECK (per_creator_budget IS NULL OR per_creator_budget BETWEEN 0 AND 100000000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_planned_creators_check') THEN
    ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_planned_creators_check
      CHECK (planned_creators IS NULL OR planned_creators BETWEEN 1 AND 1000);
  END IF;
END
$d$;

-- 2) Iptal edilmis is birligini yeniden acma (3.18-S2): durum, anlasma ozeti, teslimatlar (taslak gecmisi ve olcumler
-- cascade ile) ve odeme kaydi tek islemde sifirlanir. Yalnizca service role (lib/collaborations.ts createCollaborationFor).
CREATE OR REPLACE FUNCTION public.reopen_collaboration(p_collaboration_id uuid, p_title text, p_room_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $f$
BEGIN
  UPDATE public.collaborations
     SET status = 'agreed',
         title = p_title,
         publish_url = NULL,
         published_at = NULL,
         completed_at = NULL,
         auto_completed = false,
         cancelled_at = NULL,
         cancelled_by = NULL,
         cancel_reason = NULL,
         room_id = coalesce(p_room_id, room_id),
         updated_at = now()
   WHERE id = p_collaboration_id
     AND status = 'cancelled';
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  DELETE FROM public.collaboration_deliverables WHERE collaboration_id = p_collaboration_id;
  DELETE FROM public.collaboration_agreements WHERE collaboration_id = p_collaboration_id;
  DELETE FROM public.collaboration_payments WHERE collaboration_id = p_collaboration_id;
  RETURN true;
END
$f$;
REVOKE EXECUTE ON FUNCTION public.reopen_collaboration(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_collaboration(uuid, text, uuid) TO service_role;

-- 3) Anlasma ozeti + teslimatlar tek islemde (3.18-S3). Surum kilidi korunur: p_expected_version NULL ise ilk kayit,
-- degilse yalnizca o surumdeyse guncellenir. Celiski olursa collab_agreement_stale hatasi firlatilir ve hicbir sey yazilmaz.
-- p_deliverables: [{id|null, kind, quantity, note, due_date}] (sira = position). Sunucu kodu (lib/collaboration-workspace.ts)
-- alanlari once dogrular; buradaki kontroller yaris durumlari icindir. SQL Editor uyumu icin DECLARE kullanilmadi.
CREATE OR REPLACE FUNCTION public.save_collaboration_agreement(
  p_collaboration_id uuid,
  p_user_id uuid,
  p_is_brand boolean,
  p_expected_version integer,
  p_fee_amount integer,
  p_payment_type text,
  p_usage_rights text,
  p_revision_limit integer,
  p_deliverables jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $f$
BEGIN
  IF jsonb_typeof(p_deliverables) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'collab_agreement_invalid' USING ERRCODE = 'P0001';
  END IF;

  IF p_expected_version IS NULL THEN
    INSERT INTO public.collaboration_agreements (
      collaboration_id, drafted_by, updated_by, version, fee_amount, payment_type, usage_rights, revision_limit,
      brand_confirmed_at, influencer_confirmed_at, updated_at
    ) VALUES (
      p_collaboration_id, p_user_id, p_user_id, 1, p_fee_amount, p_payment_type, p_usage_rights, p_revision_limit,
      CASE WHEN p_is_brand THEN now() END, CASE WHEN p_is_brand THEN NULL ELSE now() END, now()
    )
    ON CONFLICT (collaboration_id) DO NOTHING;
  ELSE
    UPDATE public.collaboration_agreements
       SET fee_amount = p_fee_amount,
           payment_type = p_payment_type,
           usage_rights = p_usage_rights,
           revision_limit = p_revision_limit,
           updated_by = p_user_id,
           updated_at = now(),
           brand_confirmed_at = CASE WHEN p_is_brand THEN now() END,
           influencer_confirmed_at = CASE WHEN p_is_brand THEN NULL ELSE now() END,
           version = version + 1
     WHERE collaboration_id = p_collaboration_id
       AND version = p_expected_version;
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'collab_agreement_stale' USING ERRCODE = 'P0001';
  END IF;

  -- Listede kalan her teslimat bu is birliginin olmali.
  IF (SELECT count(*) FROM public.collaboration_deliverables d
       WHERE d.collaboration_id = p_collaboration_id
         AND d.id IN (SELECT (e->>'id')::uuid FROM jsonb_array_elements(p_deliverables) e WHERE nullif(e->>'id', '') IS NOT NULL))
     <> (SELECT count(DISTINCT e->>'id') FROM jsonb_array_elements(p_deliverables) e WHERE nullif(e->>'id', '') IS NOT NULL) THEN
    RAISE EXCEPTION 'collab_agreement_stale' USING ERRCODE = 'P0001';
  END IF;
  -- Cikarilan teslimat yalnizca hic taslak almamissa silinebilir (arada taslak gonderildiyse hepsi geri alinir).
  IF EXISTS (
    SELECT 1 FROM public.collaboration_deliverables d
     WHERE d.collaboration_id = p_collaboration_id
       AND d.id NOT IN (SELECT (e->>'id')::uuid FROM jsonb_array_elements(p_deliverables) e WHERE nullif(e->>'id', '') IS NOT NULL)
       AND (d.status <> 'pending' OR d.draft_submitted_at IS NOT NULL OR d.revisions_used > 0)
  ) THEN
    RAISE EXCEPTION 'collab_agreement_stale' USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM public.collaboration_deliverables d
   WHERE d.collaboration_id = p_collaboration_id
     AND d.id NOT IN (SELECT (e->>'id')::uuid FROM jsonb_array_elements(p_deliverables) e WHERE nullif(e->>'id', '') IS NOT NULL);

  UPDATE public.collaboration_deliverables d
     SET kind = x.kind,
         quantity = x.quantity,
         note = x.note,
         due_date = x.due_date,
         position = x.position,
         updated_at = now()
    FROM (
      SELECT (e->>'id')::uuid AS id, e->>'kind' AS kind, (e->>'quantity')::integer AS quantity, nullif(e->>'note', '') AS note,
             nullif(e->>'due_date', '')::date AS due_date, (o - 1)::integer AS position
        FROM jsonb_array_elements(p_deliverables) WITH ORDINALITY AS t(e, o)
       WHERE nullif(e->>'id', '') IS NOT NULL
    ) x
   WHERE d.id = x.id
     AND d.collaboration_id = p_collaboration_id;

  INSERT INTO public.collaboration_deliverables (collaboration_id, kind, quantity, note, due_date, position)
  SELECT p_collaboration_id, e->>'kind', (e->>'quantity')::integer, nullif(e->>'note', ''), nullif(e->>'due_date', '')::date, (o - 1)::integer
    FROM jsonb_array_elements(p_deliverables) WITH ORDINALITY AS t(e, o)
   WHERE nullif(e->>'id', '') IS NULL;

  RETURN (SELECT a.version FROM public.collaboration_agreements a WHERE a.collaboration_id = p_collaboration_id);
END
$f$;
REVOKE EXECUTE ON FUNCTION public.save_collaboration_agreement(uuid, uuid, boolean, integer, integer, text, text, integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_collaboration_agreement(uuid, uuid, boolean, integer, integer, text, text, integer, jsonb) TO service_role;

-- 4) Kesif carki: ayni anda iki "Carki cevir" istegi tek cevirme acar (3.17-S4). Marka basina danisma kilidi;
-- suresi dolmamis cevirme varsa o doner (already_active = true). Yalnizca service role (lib/discovery-wheel.ts).
CREATE OR REPLACE FUNCTION public.create_discovery_spin(p_brand_id uuid, p_influencer_ids uuid[], p_window_hours integer)
RETURNS TABLE (id uuid, influencer_ids uuid[], created_at timestamptz, expires_at timestamptz, already_active boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $f$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('discovery_spin:' || p_brand_id::text, 0));
  RETURN QUERY
    SELECT s.id, s.influencer_ids, s.created_at, s.expires_at, true
      FROM public.discovery_spins s
     WHERE s.brand_id = p_brand_id AND s.expires_at > now()
     ORDER BY s.created_at DESC
     LIMIT 1;
  IF FOUND THEN
    RETURN;
  END IF;
  RETURN QUERY
    INSERT INTO public.discovery_spins AS s (brand_id, influencer_ids, created_at, expires_at)
    VALUES (p_brand_id, p_influencer_ids, now(), now() + make_interval(hours => greatest(1, least(p_window_hours, 720))))
    RETURNING s.id, s.influencer_ids, s.created_at, s.expires_at, false;
END
$f$;
REVOKE EXECUTE ON FUNCTION public.create_discovery_spin(uuid, uuid[], integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_discovery_spin(uuid, uuid[], integer) TO service_role;

-- 5) Teklif ve ilan sayaclari: eszamanli eklemelerde sinir bir fazla gecmesin (3.17-S4). Sinir varken marka basina
-- islem sonuna kadar danisma kilidi alinir; ikinci istek ilkinin commit etmesini bekler ve sayimi yeni goruntuyle yapar.
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
  IF public.brand_limit_for(NEW.sender_user_id, 'offers_per_day') IS NULL
     AND public.brand_limit_for(NEW.sender_user_id, 'offers_per_month') IS NULL THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('brand_offer_limit:' || NEW.sender_user_id::text, 0));
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
  IF public.brand_limit_for(NEW.brand_user_id, 'active_adverts') IS NULL THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('brand_advert_limit:' || NEW.brand_user_id::text, 0));
  IF (SELECT count(*) FROM public.advert_projects a
       WHERE a.brand_user_id = NEW.brand_user_id AND a.status = 'open' AND a.id <> NEW.id)
     >= public.brand_limit_for(NEW.brand_user_id, 'active_adverts') THEN
    RAISE EXCEPTION 'brand_limit:active_adverts' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.enforce_brand_offer_limits() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_brand_advert_limits() FROM PUBLIC, anon, authenticated;
