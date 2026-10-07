-- Supabase güvenlik denetimi bulguları (2026-10-07, canlıda uygulandı).
--
-- 1) SECURITY DEFINER tetikleyici fonksiyonları /rest/v1/rpc üzerinden çağrılabilir görünüyordu.
--    PostgreSQL EXECUTE iznini yalnızca CREATE TRIGGER sırasında kontrol eder; tetikleyiciler
--    çalışmaya devam eder (kullanıcı oturumuyla users UPDATE denenerek doğrulandı).
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
           WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;

-- 2) Oturum gerektiren RPC'ler anon'a kapatılır (authenticated izni ayrıca tanımlı, korunur).
--    is_admin() RLS politikalarında kullanıldığı için anon'a açık kalır.
REVOKE EXECUTE ON FUNCTION public.get_my_private_profile() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_offer_contact_email(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_private_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_offer_contact_email(uuid) TO authenticated;

-- 3) search_path sabitlenir.
ALTER FUNCTION public.website_host(text) SET search_path = public, pg_temp;
