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
