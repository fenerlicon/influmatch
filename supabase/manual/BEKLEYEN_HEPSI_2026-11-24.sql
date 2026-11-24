-- ==============================================================================
-- BEKLEYEN SQL'LERIN HEPSI (2026-11-24) - Supabase SQL Editor'de TEK SEFERDE calistirin.
--
-- Sirasiyla su dosyalarin birebir kopyasidir (hepsi eklemeli ve tekrar calistirilabilir;
-- daha once bir kismini calistirdiysaniz yine sorun olmaz):
--   1) supabase/manual/2026-10-15_is_birligi_rpc.sql
--   2) supabase/manual/2026-10-26_ret_nedeni_itiraz.sql
--   3) supabase/manual/2026-10-26_kvkk.sql
--   4) supabase/manual/2026-10-26_kurucu_uye.sql
--   5) supabase/manual/2026-11-23_odeme.sql
--   6) supabase/manual/2026-11-23_guvenli_is_birligi.sql
--
-- DAHIL DEGIL: supabase/manual/2026-11-23_influcash.sql (Influcash ilk etapta acilmayacak;
-- acmaya karar verince ayrica calistirilir).
--
-- Hata alirsaniz: hata veren dosyanin bolumunden itibaren tekrar calistirin; onceki bolumler
-- tekrar calistirilabilir oldugu icin bastan calistirmak da zararsizdir.
-- ==============================================================================


-- ##############################################################################
-- 1) 2026-10-15_is_birligi_rpc.sql
-- ##############################################################################

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

-- ##############################################################################
-- 2) 2026-10-26_ret_nedeni_itiraz.sql
-- ##############################################################################

-- ELLE CALISTIRILACAK (2026-10-26): Supabase SQL Editor ekraninda bir kez calistirin. Eklemeli ve tekrar calistirilabilir (IF NOT EXISTS / ON CONFLICT).
-- Bu oturumda canliya uygulanamadi (Supabase baglantisi izin vermedi). Calistirilana kadar retler nedenle bildirilir ama
-- karar kaydi ve itiraz yoktur; /admin/appeals bu dosyayi isaret eden bir uyari gosterir.
-- Ayni icerik: supabase/migrations/20261026000010_moderation_appeals.sql
-- Kontrol: en alttaki SELECT iki tablo icin rls = true, kova icin false dondurmeli.

-- Ret nedeni ve itiraz (2026-10-26, SYSTEM_MAP 6.10). Admin bir reddi (hesap onayi, vergi levhasi, gorev gonderimi) nedenle verir;
-- karar moderation_decisions tablosuna yazilir. Kullanici karar basina bir kez itiraz eder (moderation_appeals, decision_id benzersiz).
-- Admin /admin/appeals ekraninda kabul eder (asil kayit yeniden incelemeye alinir) ya da yanitla reddeder.
-- Eklemeli degisiklik: iki yeni tablo (istemci rollerine tamamen kapali; okuma ve yazma yalnizca sunucu / service role, lib/moderation.ts),
-- itiraz ekleri icin ozel bir kova (istemciler dogrudan yukleyemez; sunucu imzali yukleme adresi verir). DROP yok, veri degisikligi yok.
-- Kullanici silinince kararlari ve itirazlari da silinir (ON DELETE CASCADE).

-- 1) Kararlar
CREATE TABLE IF NOT EXISTS public.moderation_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL CHECK (subject_type IN ('account', 'tax_document', 'task_submission')),
  subject_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  decision text NOT NULL DEFAULT 'rejected' CHECK (decision IN ('rejected')),
  reason_code text NOT NULL CHECK (reason_code ~ '^[a-z_]{2,40}$'),
  reason_text text CHECK (reason_text IS NULL OR char_length(reason_text) <= 500),
  decided_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  decided_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.moderation_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.moderation_decisions FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_moderation_decisions_user ON public.moderation_decisions USING btree (user_id, subject_type, decided_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_decisions_subject ON public.moderation_decisions USING btree (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_moderation_decisions_decided_by ON public.moderation_decisions USING btree (decided_by);

-- 2) Itirazlar (karar basina tek itiraz)
CREATE TABLE IF NOT EXISTS public.moderation_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid NOT NULL UNIQUE REFERENCES public.moderation_decisions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 1000),
  attachment_path text CHECK (attachment_path IS NULL OR char_length(attachment_path) <= 200),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'rejected')),
  response_text text CHECK (response_text IS NULL OR char_length(response_text) <= 1000),
  outcome text CHECK (outcome IS NULL OR outcome IN ('reopened', 'unchanged', 'rejected')),
  resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.moderation_appeals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.moderation_appeals FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_moderation_appeals_status ON public.moderation_appeals USING btree (status, created_at);
CREATE INDEX IF NOT EXISTS idx_moderation_appeals_user ON public.moderation_appeals USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_appeals_resolved_by ON public.moderation_appeals USING btree (resolved_by);

-- 3) Itiraz ekleri (PDF ya da gorsel, en fazla 5 MB). Ozel kova; politikasi yok, yalnizca service role erisir.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('appeal-files', 'appeal-files', false, 5242880, '{application/pdf,image/png,image/jpeg,image/jpg,image/webp}')
ON CONFLICT (id) DO NOTHING;

-- Kontrol
SELECT c.relname::text AS ad, c.relrowsecurity AS deger FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('moderation_decisions', 'moderation_appeals')
UNION ALL SELECT 'kova ' || id, public FROM storage.buckets WHERE id = 'appeal-files';

-- ##############################################################################
-- 3) 2026-10-26_kvkk.sql
-- ##############################################################################

-- ELLE CALISTIRILACAK (Supabase SQL Editor, tek seferde). Migration 20261026000050 ile ayni icerik.
-- Bu oturumda Supabase baglantisi yetkisizdi; canliya uygulanmadi. Eklemeli ve tekrar calistirilabilir.
-- Kontrol (calistirdiktan sonra):
--   public.consent_records ve public.privacy_audit_log tablolari var, ikisinde de RLS acik (relrowsecurity = true),
--   pg_trigger tablosunda on_auth_user_consent satiri var.
-- Calistirilana kadar kod calisir; yalnizca riza ve erisim kayitlari tutulmaz, veri indirme hiz siniri bellekte kalir.

-- KVKK teknik altyapi (2026-10-26, docs/KVKK.md, SYSTEM_MAP 14):
-- 1) consent_records: kim, ne zaman, hangi metin surumune, hangi izni verdi / geri aldi
--    (kayitta kosullar + gizlilik onayi, istege bagli cerezler, pazarlama e-postasi).
-- 2) privacy_audit_log: admin hassas belge goruntulemeleri (vergi levhasi, ekler, gorev kanitlari)
--    ve kullanicinin kendi veri indirmeleri (hiz siniri bu kayittan okunur).
-- 3) auth.users uzerinde AFTER INSERT tetikleyici: kayit formundaki onay (metadata legal_consent_version)
--    sunucu saatiyle consent_records tablosuna yazilir. Kaydi asla engellemez.
-- Eklemeli degisiklik: yeni tablolar istemci rollerine tamamen kapali (okuma ve yazma yalnizca service role).
-- Yalnizca kendi tetikleyicisi icin DROP TRIGGER IF EXISTS; veri silme yok. Kod tablolar yokken de calisir (kayit atlanir).

-- 1) Riza kayitlari
CREATE TABLE IF NOT EXISTS public.consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('terms_privacy', 'cookies_optional', 'marketing_email')),
  granted boolean NOT NULL,
  version text CHECK (version IS NULL OR char_length(version) <= 40),
  source text NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'mobile')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.consent_records FROM anon, authenticated;
REVOKE SELECT ON public.consent_records FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS consent_records_user_kind_idx ON public.consent_records (user_id, kind, created_at DESC);

-- 2) Hassas erisim gunlugu
CREATE TABLE IF NOT EXISTS public.privacy_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subject_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('tax_document_view', 'attachment_view', 'task_proof_view', 'data_export')),
  resource_id text CHECK (resource_id IS NULL OR char_length(resource_id) <= 300),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.privacy_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.privacy_audit_log FROM anon, authenticated;
REVOKE SELECT ON public.privacy_audit_log FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS privacy_audit_log_actor_idx ON public.privacy_audit_log (actor_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS privacy_audit_log_subject_idx ON public.privacy_audit_log (subject_user_id, created_at DESC);

-- 3) Kayit aninda onay kaydi (web: lib/consent-shared.ts LEGAL_CONSENT_VERSION, mobil: constants/consent.js)
CREATE OR REPLACE FUNCTION public.record_signup_consent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $f$
BEGIN
  IF coalesce(NEW.raw_user_meta_data ->> 'legal_consent_version', '') <> '' THEN
    INSERT INTO public.consent_records (user_id, kind, granted, version, source)
    VALUES (
      NEW.id,
      'terms_privacy',
      true,
      left(NEW.raw_user_meta_data ->> 'legal_consent_version', 40),
      CASE WHEN NEW.raw_user_meta_data ->> 'signup_source' = 'mobile' THEN 'mobile' ELSE 'web' END
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END
$f$;
REVOKE EXECUTE ON FUNCTION public.record_signup_consent() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_consent ON auth.users;
CREATE TRIGGER on_auth_user_consent AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.record_signup_consent();

-- ##############################################################################
-- 4) 2026-10-26_kurucu_uye.sql
-- ##############################################################################

-- ==============================================================================
-- 2026-10-26: Kurucu Uye rozeti (SYSTEM_MAP 3.21-N3)
--
-- ISTEGE BAGLI. Kod bu satir olmadan da calisir: ayar yoksa son tarih "belirlenmemis" sayilir ve
-- admin /admin/tasks sayfasindan tarihi kaydedince satir kendiliginden olusur. Bu dosya canli
-- veritabanini repodaki kayitla ayni tutmak icindir (MCP bu oturumda izin vermedi).
--
-- Supabase SQL Editor'de calistir. Eklemeli; tekrar calistirmak zararsizdir.
-- ==============================================================================

-- 1) Ayar anahtari: null = son tarih henuz belirlenmedi (o ana kadar dogrulanan herkes rozeti alir).
INSERT INTO public.platform_settings (key, value)
VALUES ('founder_badge_cutoff', 'null'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 2) Kontrol: ayar ve mevcut rozet sahipleri (rol ve dogrulama durumuna gore).
SELECT key, value, updated_at FROM public.platform_settings WHERE key = 'founder_badge_cutoff';

SELECT u.role, u.verification_status, count(*) AS rozet_sahibi
FROM public.user_badges b
JOIN public.users u ON u.id = b.user_id
WHERE b.badge_id = 'founder-member'
GROUP BY 1, 2
ORDER BY 1, 2;

-- 3) BILGI (karar sende, SYSTEM_MAP 3.21-N4): eski kuralla ("ilk 1000 influencer", dogrulama sarti yok)
--    rozet almis ama hesabi dogrulanmamis olanlar. Kod verilmis rozeti geri almaz; silmek istersen
--    once listeye bak. Silme komutu bilerek yorum satirinda.
SELECT u.id, u.username, u.role, u.verification_status, b.earned_at
FROM public.user_badges b
JOIN public.users u ON u.id = b.user_id
WHERE b.badge_id = 'founder-member' AND u.verification_status IS DISTINCT FROM 'verified'
ORDER BY b.earned_at;

-- UPDATE public.users SET displayed_badges = array_remove(displayed_badges, 'founder-member')
--   WHERE id IN (SELECT b.user_id FROM public.user_badges b JOIN public.users u ON u.id = b.user_id
--                WHERE b.badge_id = 'founder-member' AND u.verification_status IS DISTINCT FROM 'verified');
-- DELETE FROM public.user_badges b USING public.users u
--   WHERE u.id = b.user_id AND b.badge_id = 'founder-member' AND u.verification_status IS DISTINCT FROM 'verified';

-- ##############################################################################
-- 5) 2026-11-23_odeme.sql
-- ##############################################################################

-- ==============================================================================
-- 2026-11-23: ODEMELER VE ABONELIKLER (iyzico + App Store + Google Play)
--
-- Supabase SQL Editor de calistir (Claude bu oturumda canli veritabanina baglanamadi; MCP izin vermedi).
-- Icerik supabase/migrations/20261123000010_payments.sql ile aynidir. EKLEMELI ve tekrar calistirilabilir:
-- yeni tablolar (subscriptions, payments, payment_events) RLS acik ve istemci yazmalari kapali dogar,
-- task_rewards tablosuna iki kolon eklenir, satis bayraklari KAPALI olarak eklenir, bugun admin tarafindan
-- acilmis Spotlight uyelikleri abonelik kaydi olarak aktarilir (kaynak admin, bitis tarihi aynen).
-- Calistirilana kadar kod eski yolla calisir: odeme arayuzu gizli kalir, hicbir sayfa bozulmaz.
--
-- Sonda kontrol sorgulari var (RLS durumu, istemci yetkileri, bayraklar, aktarilan kayitlar).
-- ==============================================================================

-- 1) Abonelikler: her kaynak (iyzico, Apple, Google, admin, 0 TL kampanyasi, gorev odulu) tek tabloda.
--    Spotlight durumu (users.spotlight_*) bu tablodan tek sunucu fonksiyonuyla turetilir (lib/payments/subscriptions.ts).
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('ibasic', 'ipro', 'mbasic', 'mpro')),
  billing_interval text CHECK (billing_interval IS NULL OR billing_interval IN ('mo', 'yr')),
  source text NOT NULL CHECK (source IN ('iyzico', 'apple', 'google', 'admin', 'promo', 'reward')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'past_due', 'canceled', 'expired')),
  current_period_start timestamptz,
  -- null = suresiz (yalnizca admin)
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  past_due_since timestamptz,
  grace_until timestamptz,
  iyzico_subscription_ref text UNIQUE,
  iyzico_customer_ref text,
  iyzico_pricing_plan_ref text,
  iyzico_checkout_token text UNIQUE,
  apple_original_transaction_id text UNIQUE,
  google_purchase_token text UNIQUE,
  store_product_id text,
  store_environment text,
  -- indirim: ilk ay yuzde 50 (0 TL donemi Pro) ya da gorev odulu kodu; birlesmez
  discount_kind text CHECK (discount_kind IS NULL OR discount_kind IN ('promo_first_period', 'task_code')),
  discount_percent integer CHECK (discount_percent IS NULL OR discount_percent BETWEEN 1 AND 90),
  discount_code text,
  discount_reward_id uuid REFERENCES public.task_rewards(id) ON DELETE SET NULL,
  -- scheduled: sonraki donem indirimli plana gecer; active: bu donem indirimli; done: normal plana donuldu
  discount_state text CHECK (discount_state IS NULL OR discount_state IN ('scheduled', 'active', 'done')),
  pending_plan text CHECK (pending_plan IS NULL OR pending_plan IN ('ibasic', 'ipro', 'mbasic', 'mpro')),
  renewal_reminder_for timestamptz,
  expiry_notice_for timestamptz,
  last_synced_at timestamptz,
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions USING btree (status, current_period_end);
CREATE INDEX IF NOT EXISTS idx_subscriptions_created_by ON public.subscriptions USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_subscriptions_reward ON public.subscriptions USING btree (discount_reward_id);
-- Kullanici basina en fazla bir canli ucretli abonelik (web ya da magaza; capraz platform kurali).
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_one_paid
  ON public.subscriptions USING btree (user_id)
  WHERE source IN ('iyzico', 'apple', 'google') AND status IN ('pending', 'active', 'past_due');
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.subscriptions FROM anon, authenticated;
REVOKE SELECT ON public.subscriptions FROM anon;

-- 2) Odemeler: her tahsilat (ve iade kaydi). Kart verisi hic tutulmaz.
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('iyzico', 'apple', 'google')),
  provider_order_ref text NOT NULL,
  provider_payment_id text,
  plan text CHECK (plan IS NULL OR plan IN ('ibasic', 'ipro', 'mbasic', 'mpro')),
  billing_interval text CHECK (billing_interval IS NULL OR billing_interval IN ('mo', 'yr')),
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'TRY',
  status text NOT NULL CHECK (status IN ('success', 'failed', 'refunded', 'partially_refunded', 'canceled')),
  period_start timestamptz,
  period_end timestamptz,
  discount_percent integer CHECK (discount_percent IS NULL OR discount_percent BETWEEN 1 AND 90),
  failure_reason text CHECK (failure_reason IS NULL OR char_length(failure_reason) <= 300),
  refunded_amount numeric(12, 2),
  refunded_at timestamptz,
  refund_note text CHECK (refund_note IS NULL OR char_length(refund_note) <= 500),
  refunded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- e-Arsiv fatura yer tutucusu (saglayici secilince lib/payments/invoice.ts)
  invoice_status text NOT NULL DEFAULT 'pending' CHECK (invoice_status IN ('pending', 'issued', 'failed', 'not_applicable')),
  invoice_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_provider_order_unique UNIQUE (provider, provider_order_ref)
);
CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_subscription ON public.payments USING btree (subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_refunded_by ON public.payments USING btree (refunded_by);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.payments FROM anon, authenticated;
REVOKE SELECT ON public.payments FROM anon;

-- 3) Saglayici bildirimleri (iyzico webhook, Apple, Google): yalnizca ekleme, tekrar islenmez.
CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('iyzico', 'apple', 'google')),
  idempotency_key text NOT NULL UNIQUE,
  event_type text,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- en aza indirilmis yuk: yalnizca referans kodlari ve olay turu, kart verisi yok
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  signature_valid boolean,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  result text CHECK (result IS NULL OR char_length(result) <= 300)
);
CREATE INDEX IF NOT EXISTS idx_payment_events_subscription ON public.payment_events USING btree (subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_user ON public.payment_events USING btree (user_id);
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.payment_events FROM anon, authenticated;
REVOKE SELECT ON public.payment_events FROM anon, authenticated;

-- 4) Okuma: kullanici yalnizca kendi aboneligini ve odemelerini gorur (kod zaten service role ile okur; bu dar bir yedek).
DO $pol$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'subscriptions' AND policyname = 'Users read own subscriptions') THEN
    CREATE POLICY "Users read own subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payments' AND policyname = 'Users read own payments') THEN
    CREATE POLICY "Users read own payments" ON public.payments FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
  END IF;
END $pol$;

-- 5) Gorev odulu indirim kodlari: tek kullanim (rezervasyon + kullanim zamani).
ALTER TABLE public.task_rewards ADD COLUMN IF NOT EXISTS used_at timestamptz;
ALTER TABLE public.task_rewards ADD COLUMN IF NOT EXISTS used_subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_task_rewards_used_subscription ON public.task_rewards USING btree (used_subscription_id);

-- 6) Ayarlar (yalnizca service role). Satis ve magaza ici satin alma KAPALI gelir.
INSERT INTO public.platform_settings (key, value) VALUES
  ('payments_enabled', 'false'::jsonb),
  ('iap_enabled', 'false'::jsonb),
  ('promo_ends_at', 'null'::jsonb),
  ('promo_discount_until', 'null'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 7) Bugun admin tarafindan acilmis Spotlight uyelikleri abonelik kaydi olarak aktarilir (kaynak admin).
--    Boylece Spotlight durumu tek yerden turetilir; aktarilan kayit uyeligin bitis tarihini aynen tasir.
INSERT INTO public.subscriptions (user_id, plan, source, status, current_period_start, current_period_end, note)
SELECT u.id, u.spotlight_plan::text, 'admin', 'active', now(), u.spotlight_expires_at, 'Mevcut uyelik aktarildi (2026-11-23)'
FROM public.users u
WHERE u.spotlight_active = true
  AND u.spotlight_plan IS NOT NULL
  AND (u.spotlight_expires_at IS NULL OR u.spotlight_expires_at > now())
  AND NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.user_id = u.id);

-- ==============================================================================
-- KONTROL
-- ==============================================================================
SELECT c.relname AS tablo, c.relrowsecurity AS rls_acik
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('subscriptions', 'payments', 'payment_events');

SELECT table_name, grantee, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS yetkiler
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name IN ('subscriptions', 'payments', 'payment_events') AND grantee IN ('anon', 'authenticated')
GROUP BY 1, 2 ORDER BY 1, 2;

SELECT key, value FROM public.platform_settings WHERE key IN ('payments_enabled', 'iap_enabled', 'promo_ends_at', 'promo_discount_until');

SELECT source, status, count(*) FROM public.subscriptions GROUP BY 1, 2 ORDER BY 1, 2;

-- ##############################################################################
-- 6) 2026-11-23_guvenli_is_birligi.sql
-- ##############################################################################

-- ==============================================================================
-- 2026-11-23: GUVENLI IS BIRLIGI (emanet yok; platform para tutmaz)
--
-- Supabase SQL Editor de bir kez calistirin. EKLEMELI ve tekrar calistirilabilir (IF NOT EXISTS / ON CONFLICT / DO bloklari).
-- Icerik supabase/migrations/20261123000020_trust_collaboration.sql ile aynidir.
-- Calistirilana kadar kod eski yolla calisir: taahhut penceresi, odeme vadesi, hatirlatmalar, anlasmazlik akisi,
-- inceleme / askiya alma ve kayit indirme gizli kalir; hicbir sayfa bozulmaz.
-- Onkosul: 2026-10-26_ret_nedeni_itiraz.sql (moderation_decisions) once calistirildiysa askiya alma karari itiraz sistemine baglanir;
-- calistirilmadiysa 6. adim atlanir, dosya yine calisir (sonra itiraz dosyasindan sonra bu dosya tekrar calistirilabilir).
--
-- Yeni tablolar istemci rollerine kapali dogar (RLS acik + yetkiler geri alinir); okuma ve yazma sunucuda service role ile
-- (lib/collaboration-trust.ts, lib/collaboration-disputes.ts, lib/brand-commitment.ts). Tek istisna: kullanici kendi taahhut kaydini okuyabilir.
-- DROP POLICY yok, veri silme yok. Kisit degisikligi yalnizca genisletme (moderation_decisions).
-- Sonda kontrol sorgulari var.
-- ==============================================================================

-- 1) Marka taahhudu: ilk ilan ya da ilk tekliften once bir kez kabul edilir (metin surumuyle).
CREATE TABLE IF NOT EXISTS public.collaboration_commitments (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  text_version text NOT NULL CHECK (text_version ~ '^[0-9a-z._-]{1,32}$'),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'mobile')),
  PRIMARY KEY (user_id, text_version)
);
ALTER TABLE public.collaboration_commitments ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.collaboration_commitments FROM anon, authenticated;
REVOKE SELECT ON public.collaboration_commitments FROM anon;
GRANT SELECT ON public.collaboration_commitments TO authenticated;
DO $p$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'collaboration_commitments' AND policyname = 'commitments_select_own') THEN
    CREATE POLICY commitments_select_own ON public.collaboration_commitments FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
END
$p$;

-- 2) Anlasma ozetinde odeme vadesi (yeni anlasmalarda zorunlu; eski kayitlar bos kalabilir). Ucret zaten fee_amount (TL).
ALTER TABLE public.collaboration_agreements ADD COLUMN IF NOT EXISTS payment_due_date date;

-- 3) Hatirlatma gunlugu: ayni adim iki kez gonderilmez (marka odeme hatirlatmasi 0/3/7/14. gun, influencer teyit hatirlatmasi 2/5/10. gun).
CREATE TABLE IF NOT EXISTS public.collaboration_reminders (
  collaboration_id uuid NOT NULL REFERENCES public.collaborations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('payment_brand', 'receipt_influencer')),
  step integer NOT NULL CHECK (step BETWEEN 0 AND 365),
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collaboration_id, kind, step)
);
ALTER TABLE public.collaboration_reminders ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.collaboration_reminders FROM anon, authenticated;
REVOKE SELECT ON public.collaboration_reminders FROM anon, authenticated;

-- 4) Anlasmazliklar: odeme alinamadi (influencer -> marka) ve teslim edilmedi (marka -> influencer).
--    open: karsi tarafin 7 gunu var (dekont / yanit ya da cozuldu) -> responded -> resolved (bildiren teyit etti)
--    7 gun icinde kanit yoksa escalated (hesap incelemede: yeni ilan / teklif / basvuru kapali) -> admin: upheld (askiya alma), dismissed, paid.
CREATE TABLE IF NOT EXISTS public.collaboration_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaboration_id uuid NOT NULL REFERENCES public.collaborations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('nonpayment', 'nondelivery')),
  deliverable_id uuid REFERENCES public.collaboration_deliverables(id) ON DELETE SET NULL,
  reporter_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  respondent_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'responded', 'resolved', 'escalated', 'upheld', 'dismissed', 'paid')),
  reporter_note text CHECK (reporter_note IS NULL OR char_length(reporter_note) <= 500),
  response_due_at timestamptz NOT NULL,
  response_note text CHECK (response_note IS NULL OR char_length(response_note) <= 1000),
  responded_at timestamptz,
  proof_path text CHECK (proof_path IS NULL OR char_length(proof_path) <= 300),
  proof_uploaded_at timestamptz,
  respondent_resolved_at timestamptz,
  reporter_confirmed_at timestamptz,
  escalated_at timestamptz,
  decided_at timestamptz,
  decided_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  decision_note text CHECK (decision_note IS NULL OR char_length(decision_note) <= 1000),
  support_ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.collaboration_disputes ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.collaboration_disputes FROM anon, authenticated;
REVOKE SELECT ON public.collaboration_disputes FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_collaboration_disputes_collab ON public.collaboration_disputes USING btree (collaboration_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_disputes_status ON public.collaboration_disputes USING btree (status, response_due_at);
CREATE INDEX IF NOT EXISTS idx_collaboration_disputes_reporter ON public.collaboration_disputes USING btree (reporter_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_disputes_respondent ON public.collaboration_disputes USING btree (respondent_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_disputes_deliverable ON public.collaboration_disputes USING btree (deliverable_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_disputes_decided_by ON public.collaboration_disputes USING btree (decided_by);
CREATE INDEX IF NOT EXISTS idx_collaboration_disputes_ticket ON public.collaboration_disputes USING btree (support_ticket_id);
-- Ayni is birligi + tur (+ teslimat) icin tek suren anlasmazlik.
CREATE UNIQUE INDEX IF NOT EXISTS uq_collaboration_disputes_active
  ON public.collaboration_disputes (collaboration_id, kind, coalesce(deliverable_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status IN ('open', 'responded', 'escalated');

-- 5) Hesap kisitlari: review (anlasmazlikta 7 gun kanit yok, admin karari bekleniyor) ve suspended (admin karari).
--    Aktif kisit varken yeni ilan, teklif ve ilan basvurusu sunucuda ve asagidaki tetikleyicilerle engellenir.
CREATE TABLE IF NOT EXISTS public.account_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('review', 'suspended')),
  dispute_id uuid REFERENCES public.collaboration_disputes(id) ON DELETE SET NULL,
  reason text CHECK (reason IS NULL OR char_length(reason) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  released_at timestamptz,
  released_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);
ALTER TABLE public.account_holds ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.account_holds FROM anon, authenticated;
REVOKE SELECT ON public.account_holds FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_account_holds_user_active ON public.account_holds USING btree (user_id) WHERE released_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_account_holds_dispute ON public.account_holds USING btree (dispute_id);
CREATE INDEX IF NOT EXISTS idx_account_holds_created_by ON public.account_holds USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_account_holds_released_by ON public.account_holds USING btree (released_by);
CREATE UNIQUE INDEX IF NOT EXISTS uq_account_holds_active
  ON public.account_holds (user_id, kind, coalesce(dispute_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE released_at IS NULL;

-- 6) Askiya alma karari itiraz sistemine baglanir: moderation_decisions turleri genisletilir (yalnizca genisletme).
DO $m$
BEGIN
  IF to_regclass('public.moderation_decisions') IS NOT NULL THEN
    ALTER TABLE public.moderation_decisions DROP CONSTRAINT IF EXISTS moderation_decisions_subject_type_check;
    ALTER TABLE public.moderation_decisions ADD CONSTRAINT moderation_decisions_subject_type_check
      CHECK (subject_type IN ('account', 'tax_document', 'task_submission', 'collaboration_dispute'));
    ALTER TABLE public.moderation_decisions DROP CONSTRAINT IF EXISTS moderation_decisions_decision_check;
    ALTER TABLE public.moderation_decisions ADD CONSTRAINT moderation_decisions_decision_check
      CHECK (decision IN ('rejected', 'suspended'));
  END IF;
END
$m$;

-- 6b) Erisim gunlugu (KVKK): is birligi kaydi indirme ve kanit dosyasi acma da yazilir (yalnizca genisletme; tablo yoksa atlanir).
DO $a$
BEGIN
  IF to_regclass('public.privacy_audit_log') IS NOT NULL THEN
    ALTER TABLE public.privacy_audit_log DROP CONSTRAINT IF EXISTS privacy_audit_log_action_check;
    ALTER TABLE public.privacy_audit_log ADD CONSTRAINT privacy_audit_log_action_check
      CHECK (action IN ('tax_document_view', 'attachment_view', 'task_proof_view', 'data_export', 'collab_record_export', 'payment_proof_view'));
  END IF;
END
$a$;

-- 7) Odeme dekontu / teslim kaniti: ozel kova, kullanici klasoru (payment-proofs/{kullanici}/{anlasmazlik}/{dosya}).
--    Yukleme sunucunun verdigi imzali adresle; okuma yalnizca sunucu (taraflara ve admin e kisa sureli imzali baglanti).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('payment-proofs', 'payment-proofs', false, 10485760, '{application/pdf,image/png,image/jpeg,image/jpg,image/webp}')
ON CONFLICT (id) DO NOTHING;
DO $s$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'payment proofs owner read') THEN
    CREATE POLICY "payment proofs owner read" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END
$s$;

-- 8) Veritabani yedegi: istemci oturumuyla (anahtarla dogrudan REST) yapilan eklemelerde taahhut ve hesap kisiti kontrolu.
--    Sunucu (service role) yollari ayni kurali kodda uygular; bu tetikleyiciler yalnizca auth.uid() dolu oldugunda calisir.
--    Tek fonksiyon uc tabloda calistigi icin kolonlar to_jsonb(NEW) ile okunur (tabloda olmayan kolon hata vermesin).
CREATE OR REPLACE FUNCTION public.enforce_trust_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $f$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'advert_applications' THEN
    IF EXISTS (SELECT 1 FROM public.account_holds h WHERE h.user_id = (to_jsonb(NEW) ->> 'influencer_user_id')::uuid AND h.released_at IS NULL) THEN
      RAISE EXCEPTION 'trust_account_hold' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.account_holds h
     WHERE h.user_id = (to_jsonb(NEW) ->> CASE WHEN TG_TABLE_NAME = 'offers' THEN 'sender_user_id' ELSE 'brand_user_id' END)::uuid
       AND h.released_at IS NULL
  ) THEN
    RAISE EXCEPTION 'trust_account_hold' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.collaboration_commitments c
     WHERE c.user_id = (to_jsonb(NEW) ->> CASE WHEN TG_TABLE_NAME = 'offers' THEN 'sender_user_id' ELSE 'brand_user_id' END)::uuid
  ) THEN
    RAISE EXCEPTION 'trust_commitment_required' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$f$;
REVOKE EXECUTE ON FUNCTION public.enforce_trust_rules() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER trg_offers_trust_rules BEFORE INSERT ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_trust_rules();
CREATE OR REPLACE TRIGGER trg_advert_projects_trust_rules BEFORE INSERT ON public.advert_projects
  FOR EACH ROW EXECUTE FUNCTION public.enforce_trust_rules();
CREATE OR REPLACE TRIGGER trg_advert_applications_trust_rules BEFORE INSERT ON public.advert_applications
  FOR EACH ROW EXECUTE FUNCTION public.enforce_trust_rules();

-- Kontrol: dort tablo icin rls = true; kova public = false; tetikleyiciler 3.
SELECT c.relname::text AS ad, c.relrowsecurity::text AS deger FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('collaboration_commitments', 'collaboration_reminders', 'collaboration_disputes', 'account_holds')
UNION ALL SELECT 'kova ' || id, public::text FROM storage.buckets WHERE id = 'payment-proofs'
UNION ALL SELECT 'tetikleyici', count(*)::text FROM pg_trigger WHERE tgname IN ('trg_offers_trust_rules', 'trg_advert_projects_trust_rules', 'trg_advert_applications_trust_rules')
UNION ALL SELECT 'odeme vadesi kolonu', count(*)::text FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'collaboration_agreements' AND column_name = 'payment_due_date';
