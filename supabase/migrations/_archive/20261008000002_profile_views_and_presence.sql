-- ==============================================================================
-- 2026-10-08: Profil görüntülenmeleri + çevrimiçi / son görülme
--
-- profile_views: giriş yapmış bir kullanıcı bir influencer/UGC profilini açtığında kaydedilir.
--   Aynı kişi aynı profili aynı gün (Türkiye saati) bir kez sayılır; kendi profilini açması sayılmaz.
--   İstemci tabloya doğrudan erişemez; yazım record_profile_view ile, okuma sunucuda (service role)
--   yalnızca Spotlight üyesi profil sahibine yapılır (kullanıcı kararı, 2026-10-08).
-- user_activity: oturum açık sayfalar dakikada bir touch_last_seen çağırır. Admin paneli çevrimiçi
--   durumunu ve son görülme zamanını buradan okur. İstemci tabloya doğrudan erişemez.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.profile_views (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  viewer_role text,
  viewed_on date NOT NULL DEFAULT ((now() AT TIME ZONE 'Europe/Istanbul')::date),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_views_once_per_day UNIQUE (profile_id, viewer_id, viewed_on)
);

CREATE INDEX IF NOT EXISTS profile_views_profile_day_idx ON public.profile_views (profile_id, viewed_on);
CREATE INDEX IF NOT EXISTS profile_views_viewer_idx ON public.profile_views (viewer_id);

ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profile_views FROM anon, authenticated;

-- SQL Editor uyumu: fonksiyonlarda DECLARE yok.
CREATE OR REPLACE FUNCTION public.record_profile_view(p_profile_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR p_profile_id IS NULL OR auth.uid() = p_profile_id THEN
    RETURN;
  END IF;

  -- Yalnızca influencer/UGC profilleri sayılır; görüntüleyenin rolü kayda yazılır.
  INSERT INTO public.profile_views (profile_id, viewer_id, viewer_role)
  SELECT p_profile_id, viewer.id, viewer.role
  FROM public.users viewer
  WHERE viewer.id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.users target WHERE target.id = p_profile_id AND target.role = 'influencer')
  ON CONFLICT ON CONSTRAINT profile_views_once_per_day DO NOTHING;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.record_profile_view(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_profile_view(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.user_activity (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_activity_last_seen_idx ON public.user_activity (last_seen_at DESC);

ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_activity FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.touch_last_seen()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Oturum yoksa ya da profil satırı yoksa hiçbir şey yazılmaz. Sık çağrılsa da en fazla 45 saniyede bir yazılır.
  INSERT INTO public.user_activity (user_id, last_seen_at)
  SELECT u.id, now() FROM public.users u WHERE u.id = auth.uid()
  ON CONFLICT (user_id) DO UPDATE
    SET last_seen_at = EXCLUDED.last_seen_at
    WHERE public.user_activity.last_seen_at < now() - interval '45 seconds';
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.touch_last_seen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_last_seen() TO authenticated;
