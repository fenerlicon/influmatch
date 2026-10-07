-- ==============================================================================
-- 2026-10-09 TOPLU SQL — Supabase Dashboard > SQL Editor'de TEK SEFERDE çalıştırın.
-- İçerik: 20261009000001 (etkinlik rozetleri verisi). Tekrar çalıştırılabilir.
-- PR birleşmeden önce ya da sonra çalıştırılabilir; çalışmadıysa Hızlı Dönüş ve Jet Onay atlanır, diğerleri çalışır.
-- ==============================================================================

-- ==============================================================================
-- 2026-10-09: Etkinlik rozetleri için veri (Hızlı Dönüş, Jet Onay)
--
-- advert_applications.responded_at: başvuru ilk kez "pending" durumundan çıktığında (ön liste, kabul, red)
--   trigger ile yazılır. Jet Onay rozeti markanın ortalama yanıt süresini buradan hesaplar.
--   Eski başvurularda boş kalır (o güne kadar yanıt anı kaydedilmiyordu).
-- message_reply_stats(p_since): her kullanıcı için, karşı tarafın mesajından sonra yazdığı ilk yanıtın
--   gecikmesini toplar (yanıt sayısı, ortalama dakika). Yalnızca service role çağırabilir.
--
-- SQL Editor uyumu: fonksiyonlarda DECLARE yok, yorumlarda tek tırnak ve soru işareti yok.
-- ==============================================================================

ALTER TABLE public.advert_applications ADD COLUMN IF NOT EXISTS responded_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_application_responded_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.responded_at IS NULL
     AND OLD.status = 'pending'
     AND NEW.status IS DISTINCT FROM 'pending' THEN
    NEW.responded_at := now();
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.set_application_responded_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS advert_applications_set_responded_at ON public.advert_applications;
CREATE TRIGGER advert_applications_set_responded_at
  BEFORE UPDATE OF status ON public.advert_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_application_responded_at();

CREATE OR REPLACE FUNCTION public.message_reply_stats(p_since timestamptz)
 RETURNS TABLE (user_id uuid, replies bigint, avg_minutes numeric)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH ordered AS (
    SELECT m.room_id, m.sender_id, m.created_at,
           lag(m.sender_id) OVER (PARTITION BY m.room_id ORDER BY m.created_at) AS prev_sender,
           lag(m.created_at) OVER (PARTITION BY m.room_id ORDER BY m.created_at) AS prev_at
    FROM public.messages m
    WHERE m.created_at >= p_since
  )
  SELECT o.sender_id AS user_id,
         count(*) AS replies,
         round(avg(extract(epoch FROM (o.created_at - o.prev_at)) / 60.0), 1) AS avg_minutes
  FROM ordered o
  WHERE o.prev_sender IS NOT NULL AND o.prev_sender <> o.sender_id
  GROUP BY o.sender_id;
$function$;

REVOKE EXECUTE ON FUNCTION public.message_reply_stats(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.message_reply_stats(timestamptz) TO service_role;
