-- ==============================================================================
-- 12. MESSAGING SECURITY: USER BLOCK INTEGRATION
-- AÇIK: 'user_blocks' tablosu vardı ancak 'messages' tablosu RLS kuralları 
-- bu bloklamayı kontrol etmiyordu. Birini bloklasanız bile o kişi veritabanı 
-- üzerinden size mesaj göndermeye devam edebilirdi.
-- ÇÖZÜM: Mesaj gönderilmeden önce (INSERT), gönderen kişinin alıcı tarafından 
-- bloklanıp bloklanmadığı DB düzeyinde kontrol ediliyor.
-- ==============================================================================

-- Mesaj gönderiminde blok kontrolü yapan tetikleyici
CREATE OR REPLACE FUNCTION public.check_messaging_block()
RETURNS TRIGGER AS $$
DECLARE
    v_receiver_id uuid;
BEGIN
    -- 1. Mesajın alıcısını (oda içindeki diğer kişi) bul
    SELECT 
        CASE 
            WHEN brand_id = NEW.sender_id THEN influencer_id 
            ELSE brand_id 
        END INTO v_receiver_id
    FROM public.rooms
    WHERE id = NEW.room_id;

    -- 2. Eğer alıcı, gönderen kişiyi blokladıysa ENGELLE!
    IF EXISTS (
        SELECT 1 FROM public.user_blocks
        WHERE blocker_user_id = v_receiver_id 
        AND blocked_user_id = NEW.sender_id
    ) THEN
        RAISE EXCEPTION 'Bu kullanıcıya mesaj gönderemezsiniz çünkü sizi engellemiş.';
    END IF;

    -- 3. Eğer gönderen, alıcıyı blokladıysa da mesaj gitmesin (İsteğe bağlı, tutarlılık için)
    IF EXISTS (
        SELECT 1 FROM public.user_blocks
        WHERE blocker_user_id = NEW.sender_id 
        AND blocked_user_id = v_receiver_id
    ) THEN
        RAISE EXCEPTION 'Engellediğiniz kullanıcıya mesaj gönderemezsiniz. Önce engeli kaldırın.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Tetikleyiciyi messages tablosuna takıyoruz
DROP TRIGGER IF EXISTS tr_check_messaging_block ON public.messages;
CREATE TRIGGER tr_check_messaging_block
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.check_messaging_block();

-- Ek Analiz Güvenliği: analytics_events tablosu SELECT yetkisi 
-- Sadece adminler veya ilgili brand görebilir şeklinde mühürleniyor.
DROP POLICY IF EXISTS "Authenticated users can select analytics" ON public.analytics_events;
CREATE POLICY "Users can only view their own brand analytics" 
ON public.analytics_events
FOR SELECT
USING (
  brand_id = auth.uid() 
  OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
