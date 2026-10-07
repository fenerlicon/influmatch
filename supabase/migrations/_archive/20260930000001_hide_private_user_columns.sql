-- ==============================================================================
-- KİŞİSEL VERİLERİN GİZLENMESİ (users tablosu)
--
-- Açık: "Public profiles are viewable by everyone" politikası nedeniyle giriş yapmamış
-- herkes, anon key ile tüm kullanıcıların e-posta, telefon, vergi numarası, vergi dairesi
-- ve admin notlarını okuyabiliyordu.
--
-- Çözüm: Satırlar okunabilir kalır (public profiller çalışsın diye) ama hassas kolonlar
-- anon ve authenticated rollerinden kolon bazında gizlenir.
--   - Kullanıcı kendi hassas bilgilerini get_my_private_profile() ile okur.
--   - Kabul edilmiş teklifte karşı tarafın e-postası get_offer_contact_email() ile okunur.
--   - Admin ekranları bu kolonları sunucuda service role ile okur.
--
-- ÖNEMLİ: users tablosuna ileride yeni bir kolon eklenirse istemciden okunabilmesi için
-- bu dosyadaki GRANT bloğu tekrar çalıştırılmalıdır (yeni kolonlar varsayılan olarak gizlidir).
--
-- ÖN KOŞULLAR:
--   1. 20260930000000_private_user_access_helpers.sql çalıştırılmış olmalı.
--   2. Web ve mobil kodun hassas kolonları okumayı bırakan sürümü canlıda olmalı.
--   3. users.email kolonuna bakan başka politika kalmamalı (bkz. aşağıdaki kontrol sorgusu).
--
-- Kontrol (boş dönmeli):
--   SELECT schemaname, tablename, policyname FROM pg_policies
--   WHERE concat(qual, ' ', with_check) ~* '(email|phone|tax_id|tax_office|admin_notes)';
-- ==============================================================================

REVOKE SELECT ON public.users FROM anon, authenticated;

DO $$
BEGIN
  EXECUTE (
    SELECT 'GRANT SELECT (' || string_agg(quote_ident(column_name), ', ') || ') ON public.users TO anon, authenticated'
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name NOT IN ('email', 'phone', 'tax_id', 'tax_office', 'tax_office_city', 'admin_notes')
  );
END
$$;
