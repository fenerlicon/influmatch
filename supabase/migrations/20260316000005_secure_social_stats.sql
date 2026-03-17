-- ==============================================================================
-- 7. SOCIAL ACCOUNTS (INSTAGRAM STATS) HACK PREVENTION
-- AÇIK: Kullanıcılar API (REST) üzerinden kendi 'social_accounts' verilerini
-- güncelleyebiliyorlardı. Bu, doğrulama olmaksızın "1 milyon takipçi" (follower_count) 
-- ve "Doğrulanmış Hesap" (is_verified = true) statüsü basabilmeleri demekti!
-- Sistemin kalbi olan güveni tamamen bitiren bir zafiyettir.
-- ÇÖZÜM: Sadece uygulamanın Backend Sunucu Anahtarı (Service Role) bu değerleri
-- değiştirebilir, client'tan gelen sahte rakamlar engellendi!
-- ==============================================================================

-- 1. UPDATE KONTROLÜ
CREATE OR REPLACE FUNCTION public.restrict_social_accounts_columns()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.role() = 'authenticated' THEN
        -- Eğer değişikliği yapan kişi sistem admini değilse
        IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
            -- Kritik istatistik ve onay değerleri ASLA müdahale edilemez, eskiye zorlanır!
            NEW.is_verified = OLD.is_verified;
            NEW.follower_count = OLD.follower_count;
            NEW.following_count = OLD.following_count;
            NEW.engagement_rate = OLD.engagement_rate;
            NEW.has_stats = OLD.has_stats;
            NEW.stats_payload = OLD.stats_payload;
            NEW.verified_at = OLD.verified_at;
            NEW.platform_user_id = OLD.platform_user_id; 
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS restrict_social_accounts_trigger ON public.social_accounts;

CREATE TRIGGER restrict_social_accounts_trigger
BEFORE UPDATE ON public.social_accounts
FOR EACH ROW
EXECUTE FUNCTION public.restrict_social_accounts_columns();

-- 2. INSERT KONTROLÜ (Yeni hesap bağlandığı saniyede onaylı gösterilmemesi için)
CREATE OR REPLACE FUNCTION public.restrict_social_accounts_insert_columns()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.role() = 'authenticated' THEN
        -- Eğer hesabı bağlayan kişi sistem admini değilse
        IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
            -- Kayıt esnasında mecburen doğrulanmamış ve 0 rakamlarıyla başlar
            NEW.is_verified = false;
            NEW.follower_count = 0;
            NEW.engagement_rate = 0;
            NEW.has_stats = false;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS restrict_social_accounts_insert_trigger ON public.social_accounts;

CREATE TRIGGER restrict_social_accounts_insert_trigger
BEFORE INSERT ON public.social_accounts
FOR EACH ROW
EXECUTE FUNCTION public.restrict_social_accounts_insert_columns();
