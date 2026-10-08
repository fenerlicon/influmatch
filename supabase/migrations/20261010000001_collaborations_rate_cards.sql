-- Yol haritasi ozellik 1: tek is birligi akisi (collaborations) + fiyat karti (rate_cards).
-- Yazimlarin hepsi sunucu kodundan (service role) yetki kontrolunden sonra yapilir; istemcilere yalnizca SELECT acik.
-- Eklemeli degisiklik: yeni tablolar, politikalar, indeksler, realtime ve bir kerelik geriye donuk doldurma.

-- 1) Is birlikleri -------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.collaborations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  influencer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('offer', 'application')),
  -- Kaynak silinirse (ornegin hesap silinince teklif CASCADE ile gider) is birligi de gider.
  offer_id uuid UNIQUE REFERENCES public.offers(id) ON DELETE CASCADE,
  application_id uuid UNIQUE REFERENCES public.advert_applications(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '' CHECK (char_length(title) <= 200),
  status text NOT NULL DEFAULT 'agreed' CHECK (status IN ('agreed', 'in_progress', 'published', 'completed', 'cancelled')),
  publish_url text CHECK (publish_url IS NULL OR char_length(publish_url) <= 500),
  published_at timestamptz,
  completed_at timestamptz,
  auto_completed boolean NOT NULL DEFAULT false,
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  cancel_reason text CHECK (cancel_reason IS NULL OR char_length(cancel_reason) <= 500),
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collaborations_one_source CHECK (
    (source = 'offer' AND offer_id IS NOT NULL AND application_id IS NULL)
    OR (source = 'application' AND application_id IS NOT NULL AND offer_id IS NULL)
  ),
  CONSTRAINT collaborations_distinct_parties CHECK (brand_id <> influencer_id)
);

CREATE INDEX IF NOT EXISTS idx_collaborations_brand_id ON public.collaborations USING btree (brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collaborations_influencer_id ON public.collaborations USING btree (influencer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collaborations_published ON public.collaborations USING btree (published_at) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_collaborations_room_id ON public.collaborations USING btree (room_id);
CREATE INDEX IF NOT EXISTS idx_collaborations_cancelled_by ON public.collaborations USING btree (cancelled_by);

ALTER TABLE public.collaborations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.collaborations FROM anon, authenticated;
GRANT SELECT ON public.collaborations TO authenticated;

DROP POLICY IF EXISTS "collaborations select participants" ON public.collaborations;
CREATE POLICY "collaborations select participants" ON public.collaborations AS PERMISSIVE FOR SELECT TO authenticated
  USING (brand_id = (SELECT auth.uid()) OR influencer_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

-- Tamamlanan is birligi sayisi profilde herkese (giris yapmis) gorunur; satirlarin kendisi gorunmez.
CREATE OR REPLACE FUNCTION public.completed_collaboration_counts(p_user_ids uuid[])
RETURNS TABLE (user_id uuid, completed_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $f$
  SELECT c.influencer_id, count(*)::integer
  FROM public.collaborations c
  WHERE c.status = 'completed'
    AND c.influencer_id = ANY (p_user_ids[1:500])
  GROUP BY c.influencer_id
$f$;
REVOKE EXECUTE ON FUNCTION public.completed_collaboration_counts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.completed_collaboration_counts(uuid[]) TO authenticated;

-- Realtime: tabloda gizli kolon yok; RLS e gore yalnizca taraflara olay gider.
DO $d$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'collaborations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.collaborations;
  END IF;
END
$d$;

-- Bir kerelik doldurma: kabul edilmis teklifler ve basvurular "agreed" olarak.
INSERT INTO public.collaborations (brand_id, influencer_id, source, offer_id, title, status, room_id, created_at)
SELECT o.sender_user_id, o.receiver_user_id, 'offer', o.id, left(COALESCE(NULLIF(trim(o.campaign_name), ''), 'Teklif'), 200), 'agreed',
       (SELECT r.id FROM public.rooms r WHERE r.offer_id = o.id ORDER BY r.created_at LIMIT 1), o.created_at
FROM public.offers o
WHERE o.status = 'accepted' AND o.sender_user_id <> o.receiver_user_id
ON CONFLICT (offer_id) DO NOTHING;

INSERT INTO public.collaborations (brand_id, influencer_id, source, application_id, title, status, room_id, created_at)
SELECT ap.brand_user_id, COALESCE(aa.influencer_user_id, aa.influencer_id), 'application', aa.id,
       left(COALESCE(NULLIF(trim(ap.title), ''), 'Ilan'), 200), 'agreed',
       (SELECT r.id FROM public.rooms r WHERE r.advert_application_id = aa.id ORDER BY r.created_at LIMIT 1),
       COALESCE(aa.responded_at, aa.created_at, now())
FROM public.advert_applications aa
JOIN public.advert_projects ap ON ap.id = aa.advert_id
WHERE aa.status = 'accepted' AND ap.brand_user_id IS NOT NULL AND ap.brand_user_id <> COALESCE(aa.influencer_user_id, aa.influencer_id)
ON CONFLICT (application_id) DO NOTHING;

-- 2) Fiyat karti ---------------------------------------------------------------------------------
-- Influencer basina bir satir; her teslimat turu icin TL X ten baslayan tam sayi fiyat (bos = belirtilmedi).

CREATE TABLE IF NOT EXISTS public.rate_cards (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  story_price integer CHECK (story_price IS NULL OR story_price BETWEEN 1 AND 10000000),
  reel_price integer CHECK (reel_price IS NULL OR reel_price BETWEEN 1 AND 10000000),
  post_price integer CHECK (post_price IS NULL OR post_price BETWEEN 1 AND 10000000),
  ugc_video_price integer CHECK (ugc_video_price IS NULL OR ugc_video_price BETWEEN 1 AND 10000000),
  package_price integer CHECK (package_price IS NULL OR package_price BETWEEN 1 AND 10000000),
  negotiable boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rate_cards_has_price CHECK (COALESCE(story_price, reel_price, post_price, ugc_video_price, package_price) IS NOT NULL)
);

-- Fiyat kartini kim gorebilir: dogrulanmis marka veya admin (sahibi politikada ayrica).
CREATE OR REPLACE FUNCTION public.can_view_rate_cards()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $f$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND ((u.role = 'brand' AND u.verification_status = 'verified') OR u.role = 'admin')
  )
$f$;
REVOKE EXECUTE ON FUNCTION public.can_view_rate_cards() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_rate_cards() TO authenticated;

ALTER TABLE public.rate_cards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_cards FROM anon, authenticated;
GRANT SELECT ON public.rate_cards TO authenticated;

DROP POLICY IF EXISTS "rate_cards select owner or verified brand" ON public.rate_cards;
CREATE POLICY "rate_cards select owner or verified brand" ON public.rate_cards AS PERMISSIVE FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.can_view_rate_cards()));

-- Dogrulama
SELECT (SELECT count(*) FROM public.collaborations) AS collaborations, (SELECT count(*) FROM public.rate_cards) AS rate_cards;
