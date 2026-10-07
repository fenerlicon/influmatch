-- ==============================================================================
-- VERGİ NUMARASI DOĞRULAMA VE ROZET BÜTÜNLÜĞÜ
--
-- 1. public.is_valid_tax_number(): 10 haneli VKN (GİB kontrol hanesi algoritması) veya
--    11 haneli TCKN (şahıs şirketleri) kontrolü. Uygulamadaki lib/tax-id.ts ile aynı kural.
--    İstemci vergi numarasını sadece geçerli bir numaraya değiştirebilir; mevcut kayıtlar
--    dokunulmadıkça hata vermez.
-- 2. Açık: Onay düşürme kuralı sadece hesabı onaylı (verification_status = verified) markalarda
--    çalışıyordu. Hesabı beklemede olup vergi numarası onaylanmış bir marka numarasını
--    değiştirdiğinde tax_id_verified true kalıyordu. Artık ikisinden biri onaylıysa onay düşer.
-- 3. Açık: Onay düşünce Resmi İşletme (official-business) rozeti silinmiyordu. Artık rozet hem
--    user_badges tablosundan hem de vitrinden (displayed_badges) kaldırılır.
-- 4. Açık: public.award_user_badge() yetki kontrolü yapmadan anon ve authenticated rollerine
--    açıktı. Herkes tarayıcı konsolundan kendine mavi tik veya sarı tik verebiliyordu.
--    Artık sadece admin, service role ve doğrudan veritabanı bağlantısı çağırabilir.
--
-- Supabase SQL Editor uyumu: fonksiyonlarda DECLARE yok, yorumlarda tek tırnak yok,
-- jsonb soru işareti operatörü yok.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Vergi numarası algoritma kontrolü
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_valid_tax_number(p_value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_value ~ '^[0-9]{10}$' THEN (
      SELECT (10 - (sum(
               CASE
                 WHEN x.t = 0 THEN 0
                 WHEN (x.t * power(2, 9 - x.i)::int) % 9 = 0 THEN 9
                 ELSE (x.t * power(2, 9 - x.i)::int) % 9
               END) % 10)) % 10 = ascii(substr(p_value, 10, 1)) - 48
      FROM (
        SELECT g AS i, (ascii(substr(p_value, g + 1, 1)) - 48 + 9 - g) % 10 AS t
        FROM generate_series(0, 8) AS g
      ) AS x
    )
    WHEN p_value ~ '^[1-9][0-9]{10}$' THEN (
      SELECT ((((d[1] + d[3] + d[5] + d[7] + d[9]) * 7 - (d[2] + d[4] + d[6] + d[8])) % 10 + 10) % 10 = d[10])
         AND ((d[1] + d[2] + d[3] + d[4] + d[5] + d[6] + d[7] + d[8] + d[9] + d[10]) % 10 = d[11])
      FROM (
        SELECT array_agg(ascii(substr(p_value, g, 1)) - 48 ORDER BY g) AS d
        FROM generate_series(1, 11) AS g
      ) AS y
    )
    ELSE false
  END
$$;

-- ------------------------------------------------------------------------------
-- 1b. Web sitesi adresinden alan adı ("https://www.Marka.com.tr/x" -> "marka.com.tr").
-- Not: SQL Editor uyumu için soru işareti karakteri kullanılmıyor (chr(63)).
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.website_host(p_url text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT nullif(
    split_part(split_part(split_part(split_part(
      regexp_replace(regexp_replace(lower(trim(coalesce(p_url, ''))), '^[a-z]+://', ''), '^www[.]', ''),
    '/', 1), chr(63), 1), '#', 1), ':', 1),
  '')
$$;

-- ------------------------------------------------------------------------------
-- 2. USERS: INSERT kilidi (20260929000000_security_hardening.sql ile aynı + vergi no kontrolü;
--    blue_tick_override ve corporate_email kolonları sonraki migrationlarla eklenir, yoksa yok sayılır)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.users_before_insert_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'authenticated' AND NOT public.is_admin() THEN
    IF NEW.role IS NULL OR NEW.role NOT IN ('influencer', 'brand') THEN
      NEW.role := 'influencer';
    END IF;

    -- jsonb_populate_record tabloda olmayan anahtarları yok sayar;
    -- böylece canlı şemada eksik kolon olsa bile trigger patlamaz.
    NEW := jsonb_populate_record(NEW, jsonb_build_object(
      'email', auth.email(),
      'verification_status', 'pending',
      'spotlight_active', false,
      'spotlight_plan', NULL,
      'spotlight_expires_at', NULL,
      'tax_id_verified', false,
      'phone_verified', false,
      'email_verified_at', NULL,
      'admin_notes', NULL,
      'is_verified', false,
      'displayed_badges', '{}'::text[],
      'blue_tick_override', NULL,
      'corporate_email', NULL,
      'corporate_email_verified_at', NULL
    ));

    IF NEW.tax_id IS NOT NULL AND NOT public.is_valid_tax_number(NEW.tax_id) THEN
      RAISE EXCEPTION 'Geçersiz vergi numarası. Şirketler 10 haneli vergi numarasını, şahıs şirketleri 11 haneli T.C. kimlik numarasını girmelidir.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. USERS: UPDATE kilidi (beyaz liste)
-- 20260929000000_security_hardening.sql ile aynı; vergi no kontrolü ve genişletilmiş
-- onay düşürme kuralı eklendi.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.users_before_update_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      'tax_id', 'tax_office', 'tax_office_city', 'company_legal_name', 'phone',
      'creator_type', 'is_showcase_visible', 'email_notifications',
      'push_notifications_enabled', 'portfolio_urls', 'website', 'updated_at'
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
$$;

-- ------------------------------------------------------------------------------
-- 4. ROZET VERME: sadece admin, service role veya doğrudan veritabanı bağlantısı
-- (PostgREST üzerinden gelen anon ve authenticated çağrılar admin değilse reddedilir.)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_user_badge(
  target_user_id uuid,
  badge_id_to_award text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated') AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Bu işlem için yetkiniz yok.';
  END IF;

  INSERT INTO public.user_badges (user_id, badge_id)
  VALUES (target_user_id, badge_id_to_award)
  ON CONFLICT (user_id, badge_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.award_user_badge(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.award_user_badge(uuid, text) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- Not: Eski otomatik kural (hesap onayı = sarı tik) veya elle verilmiş sarı tikler silinmedi.
-- Vergi numarası onaylanmamış ama official-business rozeti olan markaları admin panelinden
-- kontrol edebilirsiniz.
-- ------------------------------------------------------------------------------
