-- 3.18-S2 ve 3.18-S3: is birligi yeniden acma ve anlasma ozeti kaydi tek islemde (yalnizca service role cagirir).
-- Eklemeli: iki yeni fonksiyon, mevcut veriye dokunmaz. Siralama onemli degil; kod main e birlesmeden de calistirilabilir
-- (fonksiyon yoksa sunucu kodu eski yoldan devam eder). Kaynak: supabase/migrations/20261015000040_collab_atomic_wheel_lock_campaign_budget.sql

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

-- Kontrol: iki satir, proacl yalnizca postgres ve service_role icermeli.
SELECT proname, proacl::text FROM pg_proc
WHERE pronamespace = 'public'::regnamespace AND proname IN ('reopen_collaboration', 'save_collaboration_agreement');
