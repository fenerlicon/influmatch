-- ==============================================================================
-- GİZLİ KULLANICI VERİLERİ İÇİN HAZIRLIK (her an güvenle çalıştırılabilir)
--
-- 20260930000001_hide_private_user_columns.sql ile users tablosundaki hassas kolonlar
-- (email, phone, tax_id, tax_office, tax_office_city, admin_notes) istemci rollerinden gizlenecek.
-- Bu dosya o kilitten ÖNCE çalıştırılır ve şunları hazırlar:
--   - get_my_private_profile(): kullanıcının kendi gizli bilgileri
--   - get_offer_contact_email(): kabul edilmiş teklifte karşı tarafın e-postası
--   - users.email kolonuna bakan eski admin politikalarının is_admin() ile yeniden yazılması
--     (aksi halde kilitten sonra bu politikalar yetki hatası verir; ayrıca e-posta ile adminlik
--     açığını da kapatır).
-- ==============================================================================

-- Kullanıcının kendi gizli bilgileri. Kolon canlı şemada yoksa NULL döner.
CREATE OR REPLACE FUNCTION public.get_my_private_profile()
RETURNS TABLE (email text, phone text, tax_id text, tax_office text, tax_office_city text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT j ->> 'email', j ->> 'phone', j ->> 'tax_id', j ->> 'tax_office', j ->> 'tax_office_city'
  FROM (SELECT to_jsonb(u) AS j FROM public.users u WHERE u.id = auth.uid()) AS s;
$$;

REVOKE ALL ON FUNCTION public.get_my_private_profile() FROM public;
GRANT EXECUTE ON FUNCTION public.get_my_private_profile() TO authenticated;

-- Kabul edilmiş bir teklifte, çağıran tarafın karşısındaki kullanıcının e-postası.
CREATE OR REPLACE FUNCTION public.get_offer_contact_email(p_offer_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.email
  FROM public.offers o
  JOIN public.users u
    ON u.id = CASE
      WHEN o.receiver_user_id = auth.uid() THEN o.sender_user_id
      WHEN o.sender_user_id = auth.uid() THEN o.receiver_user_id
    END
  WHERE o.id = p_offer_id
    AND o.status = 'accepted';
$$;

REVOKE ALL ON FUNCTION public.get_offer_contact_email(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_offer_contact_email(uuid) TO authenticated;

-- Eski, e-postaya bakan admin politikaları
DROP POLICY IF EXISTS "Admins can view all support tickets" ON public.support_tickets;
CREATE POLICY "Admins can view all support tickets"
  ON public.support_tickets FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update support tickets" ON public.support_tickets;
CREATE POLICY "Admins can update support tickets"
  ON public.support_tickets FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert badges for any user" ON public.user_badges;
CREATE POLICY "Admins can insert badges for any user"
  ON public.user_badges FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
