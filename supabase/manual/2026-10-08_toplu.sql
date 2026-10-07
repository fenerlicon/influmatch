-- ==============================================================================
-- 2026-10-08 TOPLU SQL — Supabase Dashboard > SQL Editor'de TEK SEFERDE çalıştırın.
-- İçerik (sırasıyla): 20261008000001, 20261008000002, 20261008000003.
-- Tekrar çalıştırılabilir. Bittiğinde web PR'ı birleştirilebilir (kod bu değişikliklere dayanıyor).
-- ==============================================================================

-- >>> 20261008000001_rls_initplan_and_access_hardening.sql
-- ==============================================================================
-- 2026-10-08: RLS performansı + erişim sıkılaştırma (risksiz kısım, canlıya uygulandı)
--
-- 1) Güvenlik daraltmaları (ALTER POLICY / REVOKE):
--    - messages: "User can send messages to their rooms" gönderen kontrolü ve engel kontrolü olmadan
--      yazmaya izin veriyordu (permissive kurallar OR'lanır). Katı kuralla aynı koşula daraltıldı.
--    - rooms: "System can create rooms" WITH CHECK (true) idi; taraf kontrolüne daraltıldı
--      (restrict_rooms_insert trigger'ı ayrıca teklif/başvuru bağını kontrol ediyor).
--    - users: "Public profiles are viewable by everyone" anon dahil herkese açıktı. Kural gereği profiller
--      giriş yapmadan görünmez: kural authenticated'a daraltıldı, anon'un users okuma yetkisi kaldırıldı.
--      push_token hiçbir istemciye okunmaz.
--    - analytics_events: tabloya doğrudan yazım kapatıldı (herkes istediği markanın sayısını şişirebiliyordu);
--      yazım yalnızca track_analytics_event ile. Fonksiyondaki "RETURNING id" hedefsiz olduğu için her çağrı
--      hata veriyordu, düzeltildi.
--    - message_logs: istemci yazımı kapatıldı (log_message artık çağrılmıyor).
-- 2) users güncelleme beyaz listesi: olmayan kolonlar (phone, push_notifications_enabled, portfolio_urls,
--    website, updated_at) çıkarıldı, mobil push için push_token eklendi (SYSTEM_MAP 7.3-S1).
-- 3) Tüm politikalarda auth.uid() / auth.role() / is_admin() (SELECT ...) ile sarıldı: satır başına değil
--    sorgu başına bir kez değerlendirilir (Supabase performans uyarısı auth_rls_initplan, SYSTEM_MAP 7.4).
--    Tekrar çalıştırılabilir: zaten sarılmış ifadeler değişmez.
--
-- Silinmesi gereken kopya/ölü politikalar DROP POLICY gerektirdiği için ayrı toplu SQL'de
-- (supabase/manual/2026-10-08_toplu.sql).
-- ==============================================================================

-- 1) Güvenlik daraltmaları -----------------------------------------------------

ALTER POLICY "User can send messages to their rooms" ON public.messages
  WITH CHECK (
    ((SELECT auth.uid()) = sender_id) AND (EXISTS ( SELECT 1
       FROM rooms
      WHERE ((rooms.id = messages.room_id)
        AND ((rooms.brand_id = (SELECT auth.uid())) OR (rooms.influencer_id = (SELECT auth.uid())))
        AND (NOT (EXISTS ( SELECT 1 FROM user_blocks
              WHERE (((rooms.brand_id = user_blocks.blocker_user_id) AND ((SELECT auth.uid()) = user_blocks.blocked_user_id))
                  OR ((rooms.influencer_id = user_blocks.blocker_user_id) AND ((SELECT auth.uid()) = user_blocks.blocked_user_id))))))
        AND (NOT (EXISTS ( SELECT 1 FROM user_blocks
              WHERE ((((SELECT auth.uid()) = user_blocks.blocker_user_id) AND (rooms.brand_id = user_blocks.blocked_user_id))
                  OR (((SELECT auth.uid()) = user_blocks.blocker_user_id) AND (rooms.influencer_id = user_blocks.blocked_user_id)))))))))
  );

ALTER POLICY "System can create rooms" ON public.rooms
  WITH CHECK ((((SELECT auth.uid()) = brand_id) OR ((SELECT auth.uid()) = influencer_id)));

ALTER POLICY "Public profiles are viewable by everyone" ON public.users TO authenticated;
REVOKE SELECT ON public.users FROM anon;
REVOKE SELECT (push_token) ON public.users FROM authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.analytics_events FROM anon, authenticated;
REVOKE SELECT ON public.analytics_events FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.message_logs FROM anon, authenticated;
REVOKE SELECT ON public.message_logs FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.rooms FROM anon;

-- Fonksiyon dönüşü OUT parametresine taşındı (SQL Editor uyumu: DECLARE yok); bu yüzden önce düşürülüyor.
DROP FUNCTION IF EXISTS public.track_analytics_event(text, uuid, uuid, jsonb);
CREATE FUNCTION public.track_analytics_event(p_event_type text, p_target_id uuid, p_brand_id uuid, p_meta jsonb DEFAULT '{}'::jsonb, OUT event_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Erişim Engellendi: oturum gerekli.';
  END IF;

  -- İlan görüntülemesinde brand_id ilanın gerçek sahibi olmalı; diğer olaylarda gerçek bir marka olmalı.
  IF NOT (CASE
            WHEN p_event_type = 'view_advert' THEN
              EXISTS (SELECT 1 FROM public.advert_projects WHERE id = p_target_id AND brand_user_id = p_brand_id)
            ELSE
              EXISTS (SELECT 1 FROM public.users WHERE id = p_brand_id AND role = 'brand')
          END) THEN
    RAISE EXCEPTION 'Erişim Engellendi: Geçersiz analiz verisi.';
  END IF;

  INSERT INTO public.analytics_events (event_type, target_id, actor_id, brand_id, meta)
  VALUES (p_event_type, p_target_id, auth.uid(), p_brand_id, coalesce(p_meta, '{}'::jsonb))
  RETURNING id INTO event_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.track_analytics_event(text, uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.track_analytics_event(text, uuid, uuid, jsonb) TO authenticated;

-- 2) users güncelleme beyaz listesi ---------------------------------------------

CREATE OR REPLACE FUNCTION public.users_before_update_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(auth.role(), '') <> 'authenticated' OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Beyaz liste: satırın eski hali alınır, üzerine sadece izin verilen kolonların yeni değerleri yazılır.
  -- Not: Supabase SQL Editor ile uyum için fonksiyonda yerel değişken tanımlanmıyor.
  NEW := jsonb_populate_record(NEW, to_jsonb(OLD) || (
    SELECT coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
    FROM jsonb_each(to_jsonb(NEW)) AS e
    WHERE e.key = ANY (ARRAY[
      'full_name', 'username', 'avatar_url', 'bio', 'category', 'city',
      'social_links', 'social_links_last_updated', 'displayed_badges',
      'tax_id', 'tax_office', 'tax_office_city', 'company_legal_name',
      'creator_type', 'is_showcase_visible', 'email_notifications', 'push_token'
    ])
  ));

  -- Vergi numarası sadece geçerli bir numaraya değiştirilebilir.
  IF NEW.tax_id IS DISTINCT FROM OLD.tax_id
     AND NEW.tax_id IS NOT NULL
     AND NOT public.is_valid_tax_number(NEW.tax_id) THEN
    RAISE EXCEPTION 'Geçersiz vergi numarası. Şirketler 10 haneli vergi numarasını, şahıs şirketleri 11 haneli T.C. kimlik numarasını girmelidir.';
  END IF;

  -- Onaylı marka (hesap onayı veya vergi numarası onayı) yasal bilgilerini değiştirirse
  -- onay düşer ve Resmi İşletme rozeti hem rozetlerden hem vitrinden kaldırılır.
  IF OLD.role = 'brand'
     AND (OLD.verification_status = 'verified' OR OLD.tax_id_verified IS TRUE)
     AND (
          NEW.tax_id IS DISTINCT FROM OLD.tax_id
       OR NEW.company_legal_name IS DISTINCT FROM OLD.company_legal_name
       OR NEW.tax_office IS DISTINCT FROM OLD.tax_office
       OR NEW.tax_office_city IS DISTINCT FROM OLD.tax_office_city
     ) THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object(
      'verification_status', CASE WHEN OLD.verification_status = 'verified' THEN 'pending' ELSE OLD.verification_status END,
      'tax_id_verified', false,
      'displayed_badges', array_remove(coalesce(NEW.displayed_badges, '{}'::text[]), 'official-business')
    ));
    DELETE FROM public.user_badges WHERE user_id = NEW.id AND badge_id = 'official-business';
  END IF;

  -- Marka web sitesini değiştirirse kurumsal e-postanın alan adı kontrolü geçersiz kalır:
  -- kurumsal e-posta doğrulaması ve Resmi İşletme rozeti düşer.
  IF OLD.role = 'brand'
     AND public.website_host(NEW.social_links ->> 'website') IS DISTINCT FROM public.website_host(OLD.social_links ->> 'website') THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object(
      'corporate_email_verified_at', NULL,
      'displayed_badges', array_remove(coalesce(NEW.displayed_badges, '{}'::text[]), 'official-business')
    ));
    DELETE FROM public.user_badges WHERE user_id = NEW.id AND badge_id = 'official-business';
  END IF;

  -- Kullanıcı sahip olmadığı rozeti vitrinde gösteremez.
  IF NEW.displayed_badges IS DISTINCT FROM OLD.displayed_badges
     AND coalesce(array_length(NEW.displayed_badges, 1), 0) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM unnest(NEW.displayed_badges) AS b
      WHERE b NOT IN (SELECT badge_id FROM public.user_badges WHERE user_id = NEW.id)
    ) THEN
      RAISE EXCEPTION 'Sahip olmadığınız bir rozeti profilinizde sergileyemezsiniz.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 3) auth.uid() / auth.role() / is_admin() sarmalama ------------------------------

-- Tek bir EXECUTE ile: pg_policies okunur, sarılmamış çağrılar sarılır, ALTER POLICY komutları birlikte çalışır.
-- (SQL Editor uyumu: DECLARE yok; düzenli ifadedeki soru işareti chr(63) ile yazılıyor.)
DO $migration$
BEGIN
  EXECUTE coalesce((
    SELECT string_agg(
      format('ALTER POLICY %I ON %I.%I', w.policyname, w.schemaname, w.tablename)
        || CASE WHEN w.qual IS NOT NULL THEN ' USING (' || w.nq || ')' ELSE '' END
        || CASE WHEN w.with_check IS NOT NULL THEN ' WITH CHECK (' || w.nw || ')' ELSE '' END,
      '; ')
    FROM (
      SELECT p.schemaname, p.tablename, p.policyname, p.qual, p.with_check,
        regexp_replace(regexp_replace(regexp_replace(p.qual,
          '(' || chr(63) || '<!SELECT )auth\.uid\(\)', '(SELECT auth.uid())', 'g'),
          '(' || chr(63) || '<!SELECT )auth\.role\(\)', '(SELECT auth.role())', 'g'),
          '(' || chr(63) || '<!SELECT |\.)is_admin\(\)', '(SELECT public.is_admin())', 'g') AS nq,
        regexp_replace(regexp_replace(regexp_replace(p.with_check,
          '(' || chr(63) || '<!SELECT )auth\.uid\(\)', '(SELECT auth.uid())', 'g'),
          '(' || chr(63) || '<!SELECT )auth\.role\(\)', '(SELECT auth.role())', 'g'),
          '(' || chr(63) || '<!SELECT |\.)is_admin\(\)', '(SELECT public.is_admin())', 'g') AS nw
      FROM pg_policies p
      WHERE p.schemaname IN ('public', 'storage')
    ) w
    WHERE w.nq IS DISTINCT FROM w.qual OR w.nw IS DISTINCT FROM w.with_check
  ), 'SELECT 1');
END
$migration$;

-- >>> 20261008000002_profile_views_and_presence.sql
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

-- >>> 20261008000003_drop_duplicate_policies.sql
-- ==============================================================================
-- 2026-10-08: Kopya ve ölü politikaların silinmesi (DROP POLICY: kullanıcı SQL Editor'de çalıştırır)
--
-- 20261008000001'den SONRA çalıştırılmalıdır. Her biri aynı işlem için ikinci kez tanımlanmış (permissive
-- kurallar OR'landığı için her sorguda iki kez değerlendiriliyordu) ya da artık hiçbir yazım yolu olmayan
-- kurallardır. Silinmeleri erişimi değiştirmez; kalan kural aynı ya da daha geniş koşulu zaten taşıyor.
-- (Supabase performans uyarısı multiple_permissive_policies, SYSTEM_MAP 7.4)
-- ==============================================================================

-- Birebir kopyalar (kalan kural aynı koşulu taşıyor)
DROP POLICY IF EXISTS "Users can manage their own favorite lists" ON public.favorite_lists;          -- = "Brands can manage their own favorite lists"
DROP POLICY IF EXISTS "User can see messages in their rooms" ON public.messages;                    -- = "Users can view messages in their rooms"
DROP POLICY IF EXISTS "User can send messages to their rooms" ON public.messages;                   -- 20261008000001 ile "Users can send messages in their rooms" ile aynı
DROP POLICY IF EXISTS "User can see their own rooms" ON public.rooms;                                -- = "Users can view their rooms"
DROP POLICY IF EXISTS "System can create rooms" ON public.rooms;                                     -- 20261008000001 ile "Users can insert rooms they are part of" ile aynı
DROP POLICY IF EXISTS "Users can insert their own badges" ON public.user_badges;                     -- adı yanıltıcı; "Admins can insert badges for any user" ile aynı (yalnızca admin)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.users;                    -- 20261008000001 ile "Authenticated users can view profiles" ile aynı
DROP POLICY IF EXISTS "Brands can view own analytics" ON public.analytics_events;                    -- "Users can only view their own brand analytics" kapsıyor

-- Ölü kurallar (istemci rollerinin bu işlem için tablo yetkisi yok ya da kova yok)
DROP POLICY IF EXISTS "Users can insert their own history" ON public.social_account_history;         -- istemcide INSERT yetkisi yok; yazım service role
DROP POLICY IF EXISTS "Admins can insert history" ON public.social_account_history;                  -- admin işlemleri service role ile
DROP POLICY IF EXISTS "Authenticated users can insert events" ON public.analytics_events;            -- yazım yalnızca track_analytics_event
DROP POLICY IF EXISTS "Function can insert message logs" ON public.message_logs;                     -- log_message istemcilere kapalı
DROP POLICY IF EXISTS "Kullanıcılar sadece kendi belgelerini yükleyebilir" ON storage.objects;       -- verification-documents kovası yok

-- 7.4-S3: boş taslak fonksiyon (canlıda zaten yok; repo ile eşitlemek için)
DROP FUNCTION IF EXISTS public.handle_delete_auth_user();
