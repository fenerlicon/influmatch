-- ==============================================================================
-- 11. PENTAGON SECURITY: THE ULTIMATE LOCK (PART 2)
-- AÇIKLAR:
-- 1. Kullanıcılar kendi rollerini (role) 'admin' olarak güncelleyebiliyor (KRİTİK!).
-- 2. Influencer'lar kendi takipçi ve etkileşim sayılarını API üzerinden manipüle edebiliyor.
-- 3. Influencer'lar ilan başvurularını (status) kendi kendilerine 'accepted' yapabiliyor.
-- 4. Aynı sosyal medya hesabı birden fazla kullanıcı tarafından sisteme eklenebiliyor (Account Squatting).
-- ==============================================================================

-- 1. USERS TABLOSU GÜVENLİK TETİKLEYİCİSİ: ROL VE ONAY KİLİDİ
-- Kullanıcı kendi ismini değiştirebilir ama rolünü veya onay durumunu ASLA değiştiremez.
CREATE OR REPLACE FUNCTION public.protect_user_critical_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Eğer işlemi yapan bir admin değilse (service_role veya admin yetkili biri değilse)
    IF (auth.jwt()->>'role' = 'authenticated') THEN
        -- Admin kontrolü (jwt içinden role bakmak bazen yeterli olmayabilir, DB'den de check edilebilir)
        IF NOT EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        ) THEN
            -- Kritik alanların eski değerlerini koruyoruz, üzerine yazılamaz!
            NEW.role = OLD.role;
            NEW.verification_status = OLD.verification_status;
            NEW.spotlight_active = OLD.spotlight_active;
            NEW.spotlight_plan = OLD.spotlight_plan;
            NEW.spotlight_expires_at = OLD.spotlight_expires_at;
            NEW.is_verified = OLD.is_verified; -- Eğer analytics tablolarında varsa
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_protect_user_critical_data ON public.users;
CREATE TRIGGER tr_protect_user_critical_data
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.protect_user_critical_data();


-- 2. SOCIAL ACCOUNTS: METRİK MANİPÜLASYON ENGELİ
-- Etkileşim oranları, takipçi sayısı gibi veriler API ile elle değil, sadece sistem tarafından güncellenmeli.
CREATE OR REPLACE FUNCTION public.protect_social_account_metrics()
RETURNS TRIGGER AS $$
BEGIN
    IF (auth.jwt()->>'role' = 'authenticated') THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        ) THEN
            -- Kullanıcı sadece tokenlarını ve username'ini (belki) güncelleyebilir.
            -- Ama sayısal veriler KİLİTLİDİR.
            NEW.follower_count = OLD.follower_count;
            NEW.engagement_rate = OLD.engagement_rate;
            NEW.avg_likes = OLD.avg_likes;
            NEW.avg_comments = OLD.avg_comments;
            NEW.is_verified = OLD.is_verified;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_protect_social_account_metrics ON public.social_accounts;
CREATE TRIGGER tr_protect_social_account_metrics
BEFORE UPDATE ON public.social_accounts
FOR EACH ROW EXECUTE FUNCTION public.protect_social_account_metrics();

-- 3. SOCIAL ACCOUNTS: BENZERSİZ HESAP KONTROLÜ
-- Bir Instagram ID'si sadece BİR kişi tarafından eklenebilir. Başkası ekleyemez.
-- Not: username değişebilir ama platform_user_id (Instagram ID) sabittir.
ALTER TABLE public.social_accounts DROP CONSTRAINT IF EXISTS social_accounts_platform_platform_user_id_key;
ALTER TABLE public.social_accounts 
ADD CONSTRAINT social_accounts_platform_platform_user_id_key UNIQUE (platform, platform_user_id);


-- 4. ADVERT APPLICATIONS: DURUM (STATUS) KİLİDİ
-- Influencer başvuru yapabilir, mesaj yazabilir ama durumunu kendi kendine 'accepted' YAPAMAZ.
CREATE OR REPLACE FUNCTION public.protect_application_status()
RETURNS TRIGGER AS $$
BEGIN
    IF (auth.jwt()->>'role' = 'authenticated') THEN
        -- Eğer brand bu ilanın sahibi değilse ve admin değilse status değiştiremez
        IF NOT EXISTS (
            SELECT 1 FROM public.advert_projects ap
            WHERE ap.id = OLD.advert_id AND ap.brand_user_id = auth.uid()
        ) AND NOT EXISTS (
            SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
        ) THEN
            -- Influencer kendi başvurusunu update ederken status'u değiştiremez!
            NEW.status = OLD.status;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_protect_application_status ON public.advert_applications;
CREATE TRIGGER tr_protect_application_status
BEFORE UPDATE ON public.advert_applications
FOR EACH ROW EXECUTE FUNCTION public.protect_application_status();
