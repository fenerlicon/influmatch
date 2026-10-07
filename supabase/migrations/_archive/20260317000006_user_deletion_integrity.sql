-- ==============================================================================
-- 15. PENTAGON SECURITY: USER DELETION & DATA INTEGRITY
-- AÇIK: Aktif bir anlaşması (accepted offer veya accepted application) olan bir 
-- kullanıcı, hesabını silerek sistemi ve partnerini mağdur edebilirdi.
-- ÇÖZÜM: Aktif bir ticari süreci olan kullanıcıların hesap silmesi engellendi.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.check_user_deletion_integrity()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Kabul edilmiş ve aktif olan Proje Başvurularını kontrol et
    IF EXISTS (
        SELECT 1 FROM public.advert_applications 
        WHERE (influencer_user_id = OLD.id) 
        AND status = 'accepted'
    ) THEN
        RAISE EXCEPTION 'Hesabınızı silemezsiniz: Henüz tamamlanmamış (Kabul edilmiş) bir proje başvurunuz bulunuyor. Lütfen önce projeyi tamamlayın veya iptal edin.';
    END IF;

    -- 2. Marka tarafı için: İlanı olan ve kabul edilmiş başvurusu olan markaları kontrol et
    IF EXISTS (
        SELECT 1 FROM public.advert_applications aa
        JOIN public.advert_projects ap ON aa.advert_id = ap.id
        WHERE ap.brand_user_id = OLD.id 
        AND aa.status = 'accepted'
    ) THEN
        RAISE EXCEPTION 'Hesabınızı silemezsiniz: Aktif bir projenizde kabul edilmiş influencerlar bulunuyor.';
    END IF;

    -- 3. Kabul edilmiş Teklifleri (Offers) kontrol et
    IF EXISTS (
        SELECT 1 FROM public.offers
        WHERE (sender_user_id = OLD.id OR receiver_user_id = OLD.id)
        AND status = 'accepted'
    ) THEN
        RAISE EXCEPTION 'Hesabınızı silemezsiniz: Henüz tamamlanmamış (Kabul edilmiş) bir iş teklifiniz bulunuyor.';
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_check_user_deletion_integrity ON public.users;
CREATE TRIGGER tr_check_user_deletion_integrity
BEFORE DELETE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.check_user_deletion_integrity();
