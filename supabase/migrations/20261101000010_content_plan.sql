-- Icerik plani (/toplanti, 2026-11-01): Instagram Reels serileri, bolumleri, paylasim/cekim tarihleri, metinler ve fikirler.
-- Eklemeli degisiklik: iki yeni tablo. Istemci rollerine tamamen kapali; okuma ve yazma yalnizca sunucu / service role (lib/content-plan.ts).
-- Kullanici silinince plani da silinir (ON DELETE CASCADE). Seri silinince bolumler seriden cikar, silinmez (ON DELETE SET NULL). DROP yok, veri degisikligi yok.

-- 1) Seriler
CREATE TABLE IF NOT EXISTS public.content_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  description text CHECK (description IS NULL OR char_length(description) <= 2000),
  planned_count integer CHECK (planned_count IS NULL OR planned_count BETWEEN 1 AND 365),
  start_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.content_series ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.content_series FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_content_series_owner ON public.content_series USING btree (owner_id, created_at DESC);

-- 2) Icerikler (fikir de bir icerik: status = 'idea')
CREATE TABLE IF NOT EXISTS public.content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  series_id uuid REFERENCES public.content_series(id) ON DELETE SET NULL,
  episode_no integer CHECK (episode_no IS NULL OR episode_no BETWEEN 1 AND 365),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  status text NOT NULL DEFAULT 'idea' CHECK (status IN ('idea', 'planned', 'shooting', 'editing', 'ready', 'published')),
  publish_date date,
  publish_time time,
  shoot_date date,
  script text CHECK (script IS NULL OR char_length(script) <= 10000),
  caption text CHECK (caption IS NULL OR char_length(caption) <= 2200),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 2000),
  video_url text CHECK (video_url IS NULL OR (char_length(video_url) <= 500 AND video_url ~* '^https?://')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.content_items FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_content_items_owner_publish ON public.content_items USING btree (owner_id, publish_date);
CREATE INDEX IF NOT EXISTS idx_content_items_series ON public.content_items USING btree (series_id, episode_no);
