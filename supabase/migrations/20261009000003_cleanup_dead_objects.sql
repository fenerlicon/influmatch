-- ==============================================================================
-- 2026-10-09: Ölü ve çift veritabanı nesnelerinin temizliği (SYSTEM_MAP 7.4-S9)
--
-- Silme içerdiği için kullanıcı SQL Editorde çalıştırır. Silinmeden önce canlıda doğrulandı:
--   - protect_user_critical_data, restrict_users_sensitive_columns: hiçbir triggera bağlı değil
--     (users korumasını users_before_insert_guard / users_before_update_guard yapıyor).
--   - log_message: hiçbir kod ve fonksiyon çağırmıyor, istemcilere kapalı.
--   - message_logs: 0 satır, hiçbir kod okumuyor/yazmıyor, görünüm bağımlılığı yok.
--   - offers: restrict_offers_trigger ile secure_offers_trigger aynı işi yapıyordu. Tek fonksiyonda
--     birleştirilir (alıcının kampanya adını değiştirememesi dahil), çift trigger kaldırılır.
--   - messages: messages_integrity_trigger, restrict_messages_update_trigger ve
--     restrict_messages_delete_trigger ile aynı korumayı tekrarlıyordu (zaten hata verenler sonra çalışıyor).
--   - social_accounts: tr_protect_social_account_metrics, restrict_social_accounts_trigger kapsamında.
--
-- SQL Editor uyumu: fonksiyonlarda DECLARE yok, yorumlarda tek tırnak ve soru işareti yok.
-- ==============================================================================

-- 1) offers korumasını tek fonksiyonda birleştir
CREATE OR REPLACE FUNCTION public.secure_offers_final()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'authenticated' THEN
    -- Teklif kesinleştiyse (kabul / red) bütçe, içerik ve durum değişemez.
    IF OLD.status IN ('accepted', 'rejected') THEN
      NEW.budget = OLD.budget;
      NEW.message = OLD.message;
      NEW.campaign_name = OLD.campaign_name;
      NEW.status = OLD.status;
      RETURN NEW;
    END IF;

    -- Gönderen marka durumu değiştiremez; alıcı influencer teklifin içeriğini değiştiremez.
    IF auth.uid() = OLD.sender_user_id THEN
      NEW.status = OLD.status;
    END IF;
    IF auth.uid() = OLD.receiver_user_id THEN
      NEW.budget = OLD.budget;
      NEW.message = OLD.message;
      NEW.campaign_name = OLD.campaign_name;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS restrict_offers_trigger ON public.offers;
DROP FUNCTION IF EXISTS public.restrict_offers_columns();

-- 2) messages: tekrar eden koruma
DROP TRIGGER IF EXISTS messages_integrity_trigger ON public.messages;
DROP FUNCTION IF EXISTS public.restrict_messages_integrity();

-- 3) social_accounts: tekrar eden koruma
DROP TRIGGER IF EXISTS tr_protect_social_account_metrics ON public.social_accounts;
DROP FUNCTION IF EXISTS public.protect_social_account_metrics();

-- 4) Hiçbir yere bağlı olmayan fonksiyonlar
DROP FUNCTION IF EXISTS public.protect_user_critical_data();
DROP FUNCTION IF EXISTS public.restrict_users_sensitive_columns();
DROP FUNCTION IF EXISTS public.log_message(uuid, uuid, uuid, uuid, text, timestamptz);

-- 5) Kullanılmayan tablo (0 satır)
DROP TABLE IF EXISTS public.message_logs;
