-- ==============================================================================
-- 8. ROOMS (DM/MESAJLAŞMA) SPAM VE YETKİSİZ ERİŞİM ENGELİ
-- AÇIK: İsteyen bir influencer, hiçbir şekilde teklif almadığı, hiç başvurmadığı
-- hatta kendisinden nefret eden bir 'marka' ile API üzerinden doğrudan bir
-- mesajlaşma odası ("rooms" insert) başlatabiliyordu. 
-- Mevcut durumda "brand_id ve influencer_id giren herkes oda kurabilir" denmişti.
-- ÇÖZÜM: 'offer_id' veya 'advert_application_id' yoksa veya bu ID'ler sahteyse 
-- DB düzeyinde mesajlaşma başlatımı bloklandı!
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.restrict_rooms_insert()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.role() = 'authenticated' THEN
        -- Adminler (Destek sistemi) bu kuraldan muaftır
        IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
            
            -- KURAL 1: Ortada bir anlaşma yoksa (NULL ise) ODA AÇAMAZSIN.
            IF NEW.offer_id IS NULL AND NEW.advert_application_id IS NULL THEN
                RAISE EXCEPTION 'Güvenlik İhlali: Geçerli bir teklif veya proje başvurusu olmadan doğrudan sohbet başlatılamaz!';
            END IF;
            
            -- KURAL 2: Sahte Teklif ID ile başkasının teklifini çalamazsın.
            IF NEW.offer_id IS NOT NULL THEN
                IF NOT EXISTS (
                    SELECT 1 FROM public.offers 
                    WHERE id = NEW.offer_id 
                    AND sender_user_id IN (NEW.brand_id, NEW.influencer_id) 
                    AND receiver_user_id IN (NEW.brand_id, NEW.influencer_id)
                ) THEN
                    RAISE EXCEPTION 'Güvenlik İhlali: Belirtilen teklif (offer) ile kullanıcılar eşleşmiyor!';
                END IF;
            END IF;

            -- KURAL 3: Sahte İlan Başvurusu ile odaya sızamazsın.
            IF NEW.advert_application_id IS NOT NULL THEN
                IF NOT EXISTS (
                    SELECT 1 FROM public.advert_applications aa
                    JOIN public.advert_projects ap ON aa.advert_id = ap.id
                    WHERE aa.id = NEW.advert_application_id
                    AND aa.influencer_user_id = NEW.influencer_id
                    AND ap.brand_user_id = NEW.brand_id
                ) THEN
                    RAISE EXCEPTION 'Güvenlik İhlali: Belirtilen ilan başvurusu ile marka-influencer tarafı eşleşmiyor!';
                END IF;
            END IF;
            
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS restrict_rooms_insert_trigger ON public.rooms;

-- API ile ODA kurulumunu denetleyen güvenlik sistemi
CREATE TRIGGER restrict_rooms_insert_trigger
BEFORE INSERT ON public.rooms
FOR EACH ROW
EXECUTE FUNCTION public.restrict_rooms_insert();
