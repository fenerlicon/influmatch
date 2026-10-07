-- ==============================================================================
-- FONKSIYON SERTLESTIRME (4.6-S1, 5.6-S1, 7.4-S1, 7.4-S2)
--
-- 1. track_analytics_event: anon (giris yapmamis) cagiramaz; search_path sabit.
-- 2. log_message: mesaj iceriginin ilk 200 karakterini Postgres loglarina yaziyordu (gizlilik).
--    Uygulama artik cagirmiyor; istemci rollerinden yetki kaldirildi.
-- 3. public semasindaki tum SECURITY DEFINER fonksiyonlarinda search_path = public.
--
-- Canliya 7 Ekim 2026 tarihinde uygulandi. Tekrar calistirmak zararsizdir.
-- Supabase SQL Editor uyumu: yorumlarda tek tirnak yok, soru isareti yok.
-- ==============================================================================

REVOKE EXECUTE ON FUNCTION public.track_analytics_event(text, uuid, uuid, jsonb) FROM anon, public;
ALTER FUNCTION public.track_analytics_event(text, uuid, uuid, jsonb) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.log_message(uuid, uuid, uuid, uuid, text, timestamptz) FROM anon, authenticated, public;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure::text AS sig
           FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.prosecdef AND p.proconfig IS NULL LOOP
    EXECUTE format('ALTER FUNCTION public.%s SET search_path = public', r.sig);
  END LOOP;
END $$;
