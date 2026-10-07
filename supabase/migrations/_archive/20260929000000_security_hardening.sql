-- ==============================================================================
-- SECURITY HARDENING (Paket A)
--
-- Kapatılan açıklar:
--  1. Kullanıcı kendi satırını silip role="admin" ile yeniden ekleyerek admin olabiliyordu
--     (BEFORE INSERT kilidi yoktu + DELETE politikası açıktı).
--  2. "Admins can update any user" politikası public.users.email alanına bakıyordu;
--     bu alan kullanıcı tarafından değiştirilebildiği için herkes tüm profilleri düzenleyebiliyordu.
--  3. users tablosunda kara liste mantığı vardı; tax_id_verified, phone_verified,
--     email_verified_at, admin_notes, email gibi alanlar kullanıcı tarafından değiştirilebiliyordu.
--     Artık BEYAZ LİSTE: sadece izin verilen kolonlar güncellenebilir, yeni eklenen kolonlar varsayılan olarak kilitlidir.
--  4. social_accounts: username ve verification_code kullanıcı tarafından değiştirilebildiği için
--     Instagram/TikTok doğrulaması atlatılabiliyordu. Artık bu tabloya sadece sunucu (service_role) yazar.
--  5. social_accounts içindeki Meta/TikTok access/refresh tokenları herkese açıktı. Temizlendi.
--
-- ÇALIŞTIRMADAN ÖNCE: Admin hesabınızın role alanının "admin" olduğundan emin olun.
-- Uygulama artık e-posta ile adminlik tanımıyor (users tablosunda role alanı admin olan satırı kontrol edin).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. Yardımcı: is_admin()
-- SECURITY DEFINER olduğu için RLS kurallarına takılmaz ve politikalarda özyinelemeye yol açmaz.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin');
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 1. USERS: INSERT kilidi
-- İstemci kendi satırını eklerken (onboarding / dashboard fallback) kritik alanlar
-- zorla güvenli değerlere çekilir. Sadece "influencer" ve "brand" rolleri seçilebilir.
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
      'displayed_badges', '{}'::text[]
    ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_users_before_insert_guard ON public.users;
CREATE TRIGGER tr_users_before_insert_guard
BEFORE INSERT ON public.users
FOR EACH ROW EXECUTE FUNCTION public.users_before_insert_guard();

-- ------------------------------------------------------------------------------
-- 2. USERS: UPDATE kilidi (beyaz liste)
-- Önceki iki trigger (restrict_users_trigger, tr_protect_user_critical_data)
-- kara liste mantığıyla çalışıyordu; tek bir beyaz liste triggerı ile değiştiriliyor.
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

  -- Onaylı marka yasal bilgilerini değiştirirse onayı düşer.
  IF OLD.role = 'brand' AND OLD.verification_status = 'verified' AND (
       NEW.tax_id IS DISTINCT FROM OLD.tax_id
    OR NEW.company_legal_name IS DISTINCT FROM OLD.company_legal_name
    OR NEW.tax_office IS DISTINCT FROM OLD.tax_office
    OR NEW.tax_office_city IS DISTINCT FROM OLD.tax_office_city
  ) THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object(
      'verification_status', 'pending',
      'tax_id_verified', false
    ));
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

DROP TRIGGER IF EXISTS restrict_users_trigger ON public.users;
DROP TRIGGER IF EXISTS tr_protect_user_critical_data ON public.users;
DROP TRIGGER IF EXISTS tr_users_before_update_guard ON public.users;
CREATE TRIGGER tr_users_before_update_guard
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.users_before_update_guard();

-- ------------------------------------------------------------------------------
-- 3. USERS: politikalar
-- - İstemci tarafı DELETE kapatıldı (hesap silme sunucuda service_role ile yapılıyor).
-- - Admin güncelleme politikası artık e-postaya değil role alanına bakıyor.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can update any user" ON public.users;

CREATE POLICY "Admins can update any user"
  ON public.users
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 4. SOCIAL ACCOUNTS: istemci yazması tamamen kapatıldı
-- Doğrulama kodu, kullanıcı adı ve istatistikler sadece sunucu tarafından yazılır.
-- (service_role RLS ve GRANT kısıtlamalarından etkilenmez.)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update their own social accounts" ON public.social_accounts;
DROP POLICY IF EXISTS "Users can insert their own social accounts" ON public.social_accounts;
DROP POLICY IF EXISTS "Users can delete their own social accounts" ON public.social_accounts;

REVOKE INSERT, UPDATE, DELETE ON public.social_accounts FROM anon, authenticated;

-- Tokenlar hiçbir yerde okunmuyordu ve herkese açıktı: temizle.
-- Kolonlar canlı şemada yoksa hata vermemesi için dinamik (sadece var olan kolonlar temizlenir).
DO $$
BEGIN
  EXECUTE coalesce((
    SELECT 'UPDATE public.social_accounts SET '
      || string_agg(format('%I = NULL', column_name), ', ')
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'social_accounts'
      AND column_name IN ('access_token', 'refresh_token', 'token_expires_at')
  ), 'SELECT 1');
END
$$;

-- ------------------------------------------------------------------------------
-- 5. SOCIAL ACCOUNT HISTORY: sadece sunucu yazar
-- ------------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON public.social_account_history FROM anon, authenticated;
