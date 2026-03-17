-- ==============================================================================
-- 10. MESSAGE & CHAT MANIPULATION (MESAJ DEĞİŞTİRME) AÇIĞI
-- AÇIK: Odalar tablosunun (rooms) RLS dosyalarında sadece mesajların 
-- "Kimin okuyabileceği" ve "Kimin ekleyebileceği" yazılı. Fakat herhangi bir Update
-- (Güncelleme) ya da Delete (Silme) RLS politikası veya kısıtlaması konmamış! 
-- Sonuç: Varsayılan (default) PostgreSQL mantığında eğer bir update politikası 
-- yazılmazsa, bazen tablo izinlerine göre kullanıcılar bir API PUT isteği 
-- atarak eskiden yazdığı sözleri SİLEBİLİR veya DEĞİŞTİREBİLİR!
-- ÇÖZÜM: Gönderilen bir mesajın içeriği (content) ve kendisi asla güncellenemez
-- ve geri silinemez. (Kanıt ve log olarak kalması gerektiği için WhatsApp mantığıyla kilitlendi).
-- ==============================================================================

-- 1. MESSAGE UPDATE BLOĞU (İçerik Değiştirememe)
CREATE OR REPLACE FUNCTION public.restrict_messages_update()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.role() = 'authenticated' THEN
        -- Adminler hariç hiç kimse kendi mesajını değiştiremez.
        IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
            RAISE EXCEPTION 'Güvenlik İhlali: Gönderilmiş mesajlar değiştirilemez veya güncellenemez (Hukuki kayıt sebebiyle).';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS restrict_messages_update_trigger ON public.messages;

CREATE TRIGGER restrict_messages_update_trigger
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.restrict_messages_update();

-- 2. MESSAGE DELETE BLOĞU (Mesaj Silememe)
CREATE OR REPLACE FUNCTION public.restrict_messages_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.role() = 'authenticated' THEN
        -- Adminler hariç hiç kimse kendi mesajını silemez.
        IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
            RAISE EXCEPTION 'Güvenlik İhlali: Gönderilmiş mesajlar platform üzerinden silinemez.';
        END IF;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS restrict_messages_delete_trigger ON public.messages;

CREATE TRIGGER restrict_messages_delete_trigger
BEFORE DELETE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.restrict_messages_delete();
