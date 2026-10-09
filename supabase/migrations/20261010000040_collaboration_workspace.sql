-- Yol haritasi ozellik 2: is birligi takip alani + anlasma ozeti + odeme teyidi (SYSTEM_MAP 3.18).
-- Teslim kilidi (dosya yukleme, odeme teyidine kadar kilitli dosya) Cloudflare R2 ile gelecek; bunun icin
-- collaboration_submissions.file_key ve file_locked kolonlari simdiden bos duruyor.
-- Yazimlarin hepsi sunucu kodundan (lib/collaboration-workspace.ts, service role) taraf ve rol kontrolunden sonra yapilir;
-- istemcilere yalnizca taraflar icin SELECT acik. Eklemeli degisiklik: yeni tablolar, fonksiyonlar, indeksler, realtime.

-- 0) Yardimci: oturumdaki kullanici bu is birliginin tarafi mi (veya admin)
CREATE OR REPLACE FUNCTION public.is_collaboration_party(p_collaboration_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $f$
  SELECT EXISTS (
    SELECT 1 FROM public.collaborations c
    WHERE c.id = p_collaboration_id
      AND (c.brand_id = auth.uid() OR c.influencer_id = auth.uid())
  ) OR public.is_admin()
$f$;
REVOKE EXECUTE ON FUNCTION public.is_collaboration_party(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_collaboration_party(uuid) TO authenticated;

-- 1) Anlasma ozeti (is birligi basina bir satir)
CREATE TABLE IF NOT EXISTS public.collaboration_agreements (
  collaboration_id uuid PRIMARY KEY REFERENCES public.collaborations(id) ON DELETE CASCADE,
  fee_amount integer CHECK (fee_amount IS NULL OR fee_amount BETWEEN 0 AND 10000000),
  payment_type text NOT NULL DEFAULT 'cash' CHECK (payment_type IN ('cash', 'barter')),
  usage_rights text CHECK (usage_rights IS NULL OR char_length(usage_rights) <= 300),
  revision_limit integer NOT NULL DEFAULT 0 CHECK (revision_limit BETWEEN 0 AND 10),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  drafted_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  brand_confirmed_at timestamptz,
  influencer_confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_collaboration_agreements_drafted_by ON public.collaboration_agreements USING btree (drafted_by);
CREATE INDEX IF NOT EXISTS idx_collaboration_agreements_updated_by ON public.collaboration_agreements USING btree (updated_by);
ALTER TABLE public.collaboration_agreements ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.collaboration_agreements FROM anon, authenticated;
REVOKE SELECT ON public.collaboration_agreements FROM anon;
GRANT SELECT ON public.collaboration_agreements TO authenticated;

-- 2) Teslimatlar (anlasmanin parcasi + takip durumu)
CREATE TABLE IF NOT EXISTS public.collaboration_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaboration_id uuid NOT NULL REFERENCES public.collaborations(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0 CHECK (position BETWEEN 0 AND 100),
  kind text NOT NULL CHECK (kind IN ('story', 'reel', 'post', 'ugc_video', 'other')),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 50),
  note text CHECK (note IS NULL OR char_length(note) <= 200),
  due_date date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'draft_submitted', 'revision_requested', 'approved', 'published')),
  revisions_used integer NOT NULL DEFAULT 0 CHECK (revisions_used BETWEEN 0 AND 100),
  draft_url text CHECK (draft_url IS NULL OR char_length(draft_url) <= 500),
  draft_note text CHECK (draft_note IS NULL OR char_length(draft_note) <= 500),
  draft_submitted_at timestamptz,
  review_note text CHECK (review_note IS NULL OR char_length(review_note) <= 500),
  reviewed_at timestamptz,
  approved_at timestamptz,
  publish_url text CHECK (publish_url IS NULL OR char_length(publish_url) <= 500),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_collaboration_deliverables_collab ON public.collaboration_deliverables USING btree (collaboration_id, position);
ALTER TABLE public.collaboration_deliverables ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.collaboration_deliverables FROM anon, authenticated;
REVOKE SELECT ON public.collaboration_deliverables FROM anon;
GRANT SELECT ON public.collaboration_deliverables TO authenticated;

-- 3) Taslak gecmisi (her gonderim bir satir; R2 gelince dosya anahtari burada tutulur)
CREATE TABLE IF NOT EXISTS public.collaboration_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaboration_id uuid NOT NULL REFERENCES public.collaborations(id) ON DELETE CASCADE,
  deliverable_id uuid NOT NULL REFERENCES public.collaboration_deliverables(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  url text CHECK (url IS NULL OR char_length(url) <= 500),
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  -- R2 teslim kilidi icin ayrildi (bugun hep bos): dosya anahtari ve odeme teyidine kadar kilitli mi.
  file_key text CHECK (file_key IS NULL OR char_length(file_key) <= 500),
  file_locked boolean NOT NULL DEFAULT false,
  review text CHECK (review IS NULL OR review IN ('approved', 'revision_requested')),
  review_note text CHECK (review_note IS NULL OR char_length(review_note) <= 500),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collaboration_submissions_has_content CHECK (url IS NOT NULL OR file_key IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_collaboration_submissions_deliverable ON public.collaboration_submissions USING btree (deliverable_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collaboration_submissions_collab ON public.collaboration_submissions USING btree (collaboration_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_submissions_submitted_by ON public.collaboration_submissions USING btree (submitted_by);
ALTER TABLE public.collaboration_submissions ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.collaboration_submissions FROM anon, authenticated;
REVOKE SELECT ON public.collaboration_submissions FROM anon;
GRANT SELECT ON public.collaboration_submissions TO authenticated;

-- 4) Odeme teyidi (is birligi basina bir satir)
CREATE TABLE IF NOT EXISTS public.collaboration_payments (
  collaboration_id uuid PRIMARY KEY REFERENCES public.collaborations(id) ON DELETE CASCADE,
  brand_paid_at timestamptz,
  brand_paid_date date,
  brand_note text CHECK (brand_note IS NULL OR char_length(brand_note) <= 300),
  influencer_received_at timestamptz,
  influencer_received_date date,
  influencer_note text CHECK (influencer_note IS NULL OR char_length(influencer_note) <= 300),
  nonpayment_reported_at timestamptz,
  nonpayment_ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_collaboration_payments_ticket ON public.collaboration_payments USING btree (nonpayment_ticket_id);
ALTER TABLE public.collaboration_payments ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.collaboration_payments FROM anon, authenticated;
REVOKE SELECT ON public.collaboration_payments FROM anon;
GRANT SELECT ON public.collaboration_payments TO authenticated;

-- 5) Politikalar (yalnizca taraflar ve admin okur). Canli DB de DROP POLICY kullanilmaz; varsa atlanir.
DO $d$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'collaboration_agreements' AND policyname = 'collaboration_agreements select parties') THEN
    CREATE POLICY "collaboration_agreements select parties" ON public.collaboration_agreements AS PERMISSIVE FOR SELECT TO authenticated
      USING ((SELECT public.is_collaboration_party(collaboration_id)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'collaboration_deliverables' AND policyname = 'collaboration_deliverables select parties') THEN
    CREATE POLICY "collaboration_deliverables select parties" ON public.collaboration_deliverables AS PERMISSIVE FOR SELECT TO authenticated
      USING ((SELECT public.is_collaboration_party(collaboration_id)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'collaboration_submissions' AND policyname = 'collaboration_submissions select parties') THEN
    CREATE POLICY "collaboration_submissions select parties" ON public.collaboration_submissions AS PERMISSIVE FOR SELECT TO authenticated
      USING ((SELECT public.is_collaboration_party(collaboration_id)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'collaboration_payments' AND policyname = 'collaboration_payments select parties') THEN
    CREATE POLICY "collaboration_payments select parties" ON public.collaboration_payments AS PERMISSIVE FOR SELECT TO authenticated
      USING ((SELECT public.is_collaboration_party(collaboration_id)));
  END IF;
END
$d$;

-- 6) Marka guvenilirligi: tamamlanan is birligi sayisi ve bunlardan influencer in odemeyi teyit ettigi sayi.
-- Giris yapmis herkes gorebilir; satirlarin kendisi gorunmez.
CREATE OR REPLACE FUNCTION public.brand_collaboration_reliability(p_brand_ids uuid[])
RETURNS TABLE (brand_id uuid, completed_count integer, payment_confirmed_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $f$
  SELECT c.brand_id,
         count(*)::integer,
         count(p.influencer_received_at)::integer
  FROM public.collaborations c
  LEFT JOIN public.collaboration_payments p ON p.collaboration_id = c.id
  WHERE c.status = 'completed'
    AND c.brand_id = ANY (p_brand_ids[1:500])
  GROUP BY c.brand_id
$f$;
REVOKE EXECUTE ON FUNCTION public.brand_collaboration_reliability(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.brand_collaboration_reliability(uuid[]) TO authenticated;

-- 7) Realtime: detay sayfasi karsi tarafin islemlerinde yenilenir (RLS e gore yalnizca taraflara olay gider).
DO $d$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['collaboration_agreements', 'collaboration_deliverables', 'collaboration_payments'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END
$d$;
