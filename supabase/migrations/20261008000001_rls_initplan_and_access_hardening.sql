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
