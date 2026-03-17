-- ==============================================================================
-- 13. PENTAGON SECURITY: AGREEMENT INTEGRITY & SYNC (FINAL PART)
-- AÇIKLAR:
-- 1. Influencer'lar 'Accepted' olmuş başvurularını silebilir (RLS DELETE politikası yüzünden).
-- 2. Markalar 'Accepted' olmuş başvurusu olan ilanlarını silebilir (ON DELETE CASCADE ile veriyi yok eder).
-- 3. Kullanıcıların email adresleri auth.users'ta değişse bile public.users'ta eski kalabiliyor.
-- 4. Favori listeleri (favorite_lists) yetkisiz kişilerce silinebiliyor olabilir.
-- ==============================================================================

-- 1. ADVERT APPLICATIONS: SİLME VE GÜNCELLEME KISITI
-- Eğer başvuru kabul edildiyse, influencer bunu kafasına göre silemez.
DROP POLICY IF EXISTS "Influencers manage their applications" ON public.advert_applications;

CREATE POLICY "Influencers view their own applications"
ON public.advert_applications FOR SELECT
USING (auth.uid() = influencer_user_id);

CREATE POLICY "Influencers insert their own applications"
ON public.advert_applications FOR INSERT
WITH CHECK (auth.uid() = influencer_user_id);

CREATE POLICY "Influencers delete their own applications"
ON public.advert_applications FOR DELETE
USING (
    auth.uid() = influencer_user_id 
    AND status NOT IN ('accepted', 'shortlisted') -- Kabul edilen veya listeye alınan kaçamaz!
);

-- 2. ADVERT PROJECTS: SİLME KISITI
-- Eğer ilanda kabul edilmiş bir başvuru varsa, marka bu ilanı silemez (Arşivlemeli).
-- Aksi takdirde tüm başvuru geçmişi ve anlaşmalar silinir.
CREATE OR REPLACE FUNCTION public.check_advert_project_deletion()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.advert_applications 
        WHERE advert_id = OLD.id AND status = 'accepted'
    ) THEN
        RAISE EXCEPTION 'Kabul edilmiş başvurusu olan bir ilanı silemezsiniz. Lütfen ilan durumunu "closed" yapın veya admin ile iletişime geçin.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_check_advert_project_deletion ON public.advert_projects;
CREATE TRIGGER tr_check_advert_project_deletion
BEFORE DELETE ON public.advert_projects
FOR EACH ROW EXECUTE FUNCTION public.check_advert_project_deletion();


-- 3. EMAIL SYNC: AUTH.USERS -> PUBLIC.USERS (EMERGENCY BACKUP)
-- Kullanıcı emailini auth tarafından güncellerse public.users her zaman güncel kalmalı.
CREATE OR REPLACE FUNCTION public.sync_user_email_from_auth()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.email IS DISTINCT FROM OLD.email THEN
        UPDATE public.users 
        SET email = NEW.email 
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_sync_user_email_from_auth ON auth.users;
CREATE TRIGGER tr_sync_user_email_from_auth
AFTER UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_user_email_from_auth();


-- 4. FAVORITE LISTS: GÜVENLİK
ALTER TABLE public.favorite_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own favorite lists" ON public.favorite_lists;
CREATE POLICY "Users can manage their own favorite lists"
ON public.favorite_lists FOR ALL
USING (auth.uid() = brand_id)
WITH CHECK (auth.uid() = brand_id);

DROP POLICY IF EXISTS "Users can view their own favorite list items" ON public.favorite_list_items;
-- Not: favorite_list_items tablosu için de RLS aktif olmalı
ALTER TABLE public.favorite_list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own favorite list items"
ON public.favorite_list_items FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.favorite_lists 
        WHERE id = list_id AND brand_id = auth.uid()
    )
);
