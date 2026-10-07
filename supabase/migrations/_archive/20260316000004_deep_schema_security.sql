-- ==============================================================================
-- 6. DEEP SCHEMA SECURITY FIXES: THE FINAL FORTRESS
-- AÇIK: 
-- 1. "message_reports" (Mesaj Raporlama) tablosunu kullanarak şikayet oluşturan kullanıcı, 
-- işlemi gerçekleştirirken adminin vereceği "action_taken" statüsünü, kimin incelediğini (reviewed_by/at)
-- kendi verisiymiş gibi kaydedebiliyordu.
-- 2. "displayed_badges" array'ine (vitrinde gösterilen rozetler) kullanıcılar hiç hak etmedikleri halde, 
-- user_badges tablosunu atlayıp API'den direkt ["verified_brand", "millionaire"] ekleyip herkesi kandırabiliyordu!
-- 3. Markalar, kimlik doğrulayıp ('verified' olup) vergisini ve firma adını değiştirdiğinde sistem onların 'verified' 
-- statüsünü DÜŞÜRMÜYORDU. Vergi levhası satan dolandırıcılar markasını onaylatıp sonra adını ve vergisini siliyordu!
-- ==============================================================================

-- ====================
-- 1. YENİLENMİŞ KULLANICI GÜVENLİK TETİKLEYİCİSİ (Vergi & Rozet Açıkları İçin)
-- ====================
CREATE OR REPLACE FUNCTION public.restrict_users_sensitive_columns()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.role() = 'authenticated' THEN
        
        -- ASLA DEĞİŞTİRİLEMEYECEK ALANLAR
        NEW.role = OLD.role;
        NEW.spotlight_active = OLD.spotlight_active;
        
        -- EĞER MARKA İSE VE ONAYLIYSA; VERGİ NO VEYA FİRMA ADI DEĞİŞİRSE ONAYI DÜŞÜR (Pending'e at)
        IF OLD.role = 'brand' AND OLD.verification_status = 'verified' AND (NEW.tax_id IS DISTINCT FROM OLD.tax_id OR NEW.company_legal_name IS DISTINCT FROM OLD.company_legal_name) THEN
            NEW.verification_status = 'pending';
        ELSE
            -- Yoksa manipüle etmesini engelle, eski durum neyse o kalsın.
            NEW.verification_status = OLD.verification_status;
        END IF;

        -- SAHTE ROZET ENGELLENMESİ: Kullanıcı kendine ait olmayan bir rozeti sergileyemez!
        IF NEW.displayed_badges IS DISTINCT FROM OLD.displayed_badges AND ARRAY_LENGTH(NEW.displayed_badges, 1) > 0 THEN
            -- Eklediği her rozet user_badges tablosunda bulunuyor mu diye say
            IF (
                SELECT COUNT(*) 
                FROM unnest(NEW.displayed_badges) AS b 
                WHERE b IN (SELECT badge_id FROM public.user_badges WHERE user_id = NEW.id)
            ) <> ARRAY_LENGTH(NEW.displayed_badges, 1) THEN
                RAISE EXCEPTION 'Güvenlik İhlali: Sahip olmadığınız bir rozeti profilinizde sergileyemezsiniz!';
            END IF;
        END IF;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- (Trigger bir önceki dosyada 'restrict_users_trigger' adıyla oluşturulduğu için fonksiyona yansır)


-- ====================
-- 2. MESAJ ŞİKAYETLERİ (MESSAGE REPORTS) AÇIĞI
-- ====================
CREATE OR REPLACE FUNCTION public.restrict_message_reports_insert_columns()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.role() = 'authenticated' THEN
        IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
            NEW.status = 'pending';
            NEW.reviewed_by = NULL;
            NEW.reviewed_at = NULL;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS restrict_message_reports_insert_trigger ON public.message_reports;

CREATE TRIGGER restrict_message_reports_insert_trigger
BEFORE INSERT ON public.message_reports
FOR EACH ROW
EXECUTE FUNCTION public.restrict_message_reports_insert_columns();

-- Update işlemi de yapamasınlar diye ekliyoruz:
CREATE OR REPLACE FUNCTION public.restrict_message_reports_update_columns()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.role() = 'authenticated' THEN
        IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
            NEW.status = OLD.status;
            NEW.reviewed_by = OLD.reviewed_by;
            NEW.reviewed_at = OLD.reviewed_at;
            NEW.reason = OLD.reason;
            NEW.description = OLD.description;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS restrict_message_reports_update_trigger ON public.message_reports;

CREATE TRIGGER restrict_message_reports_update_trigger
BEFORE UPDATE ON public.message_reports
FOR EACH ROW
EXECUTE FUNCTION public.restrict_message_reports_update_columns();
