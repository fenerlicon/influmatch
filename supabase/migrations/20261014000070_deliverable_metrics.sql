-- Sonuc raporu (SYSTEM_MAP 3.20): yayinlanan teslimatlarin herkese acik gonderi olcumleri.
-- Yayin linki girilen her teslimat icin takip satiri acilir; saatlik gorev Apify ile begeni / yorum / izlenme alir
-- (yayindan ~24 saat, 7 gun ve 30 gun sonra; sonra durur). Marka 6 saatte bir elle guncelleyebilir.
-- Yazimlarin hepsi sunucu kodundan (lib/post-metrics.ts, service role); istemcilere yalnizca is birliginin taraflari icin SELECT.
-- Eklemeli degisiklik: yeni iki tablo, indeksler, politikalar.

-- 1) Takip durumu (teslimat basina bir satir)
CREATE TABLE IF NOT EXISTS public.deliverable_metric_tracking (
  deliverable_id uuid PRIMARY KEY REFERENCES public.collaboration_deliverables(id) ON DELETE CASCADE,
  collaboration_id uuid NOT NULL REFERENCES public.collaborations(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'youtube', 'other')),
  post_url text NOT NULL CHECK (char_length(post_url) <= 500),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done', 'unavailable', 'unsupported')),
  next_stage text CHECK (next_stage IS NULL OR next_stage IN ('d1', 'd7', 'd30')),
  next_due_at timestamptz,
  published_at timestamptz NOT NULL,
  followers_at_publish bigint CHECK (followers_at_publish IS NULL OR followers_at_publish >= 0),
  fail_count integer NOT NULL DEFAULT 0 CHECK (fail_count BETWEEN 0 AND 100),
  last_error text CHECK (last_error IS NULL OR char_length(last_error) <= 200),
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_manual_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deliverable_metric_tracking_due ON public.deliverable_metric_tracking USING btree (next_due_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_deliverable_metric_tracking_collab ON public.deliverable_metric_tracking USING btree (collaboration_id);
ALTER TABLE public.deliverable_metric_tracking ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.deliverable_metric_tracking FROM anon, authenticated;
REVOKE SELECT ON public.deliverable_metric_tracking FROM anon;
GRANT SELECT ON public.deliverable_metric_tracking TO authenticated;

-- 2) Olcum kayitlari (her olcum bir satir)
CREATE TABLE IF NOT EXISTS public.deliverable_metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id uuid NOT NULL REFERENCES public.collaboration_deliverables(id) ON DELETE CASCADE,
  collaboration_id uuid NOT NULL REFERENCES public.collaborations(id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (stage IN ('d1', 'd7', 'd30', 'manual')),
  likes bigint CHECK (likes IS NULL OR likes >= 0),
  comments bigint CHECK (comments IS NULL OR comments >= 0),
  views bigint CHECK (views IS NULL OR views >= 0),
  shares bigint CHECK (shares IS NULL OR shares >= 0),
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deliverable_metric_snapshots_deliverable ON public.deliverable_metric_snapshots USING btree (deliverable_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliverable_metric_snapshots_collab ON public.deliverable_metric_snapshots USING btree (collaboration_id);
ALTER TABLE public.deliverable_metric_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.deliverable_metric_snapshots FROM anon, authenticated;
REVOKE SELECT ON public.deliverable_metric_snapshots FROM anon;
GRANT SELECT ON public.deliverable_metric_snapshots TO authenticated;

-- 3) Politikalar (yalnizca is birliginin taraflari ve admin okur). Canli DB de DROP POLICY kullanilmaz; varsa atlanir.
DO $d$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'deliverable_metric_tracking' AND policyname = 'deliverable_metric_tracking select parties') THEN
    CREATE POLICY "deliverable_metric_tracking select parties" ON public.deliverable_metric_tracking AS PERMISSIVE FOR SELECT TO authenticated
      USING ((SELECT public.is_collaboration_party(collaboration_id)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'deliverable_metric_snapshots' AND policyname = 'deliverable_metric_snapshots select parties') THEN
    CREATE POLICY "deliverable_metric_snapshots select parties" ON public.deliverable_metric_snapshots AS PERMISSIVE FOR SELECT TO authenticated
      USING ((SELECT public.is_collaboration_party(collaboration_id)));
  END IF;
END
$d$;
