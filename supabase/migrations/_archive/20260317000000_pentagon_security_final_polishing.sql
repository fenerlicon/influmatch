-- ==============================================================================
-- 10. PENTAGON SECURITY: FINAL POLISHING & LOGICAL INTEGRITY
-- AÇIKLAR:
-- 1. Onaylanmamış (verified olmayan) markalar hala 'Offers' (Teklifler) gönderebiliyor.
-- 2. Influencerlar kendilerini 'Favorite' (Favori) tablosuna kendileri ekleyebiliyor (Marka gibi davranarak).
-- 3. Kullanıcılar 'Message Reads' (Okundu Bilgisi) tablosunda başka odaların mesajlarını okundu yapabiliyor.
-- 4. Kullanıcılar kendi kazandıkları 'Mavi Tik' veya 'Verified' rozetlerini SİLEBİLİYOR (Hileli bir durum yaratmamalı, admin kararıdır).
-- 5. Sosyal medya geçmişine (History) kullanıcılar dışarıdan sahte satırlar ekleyebiliyor.
-- 6. Bir Teklif 'Kabul Edildi' (Accepted) olduktan sonra Marka bütçeyi hala değiştirebiliyor (Bait-and-Switch dolandırıcılığı).
-- ==============================================================================

-- 1. OFFERS (TEKLİFLER) GÜNCELLEMESİ: SADECE VERIFIED MARKALAR TEKLİF ATABİLİR
DROP POLICY IF EXISTS "Brands can insert offers they send" ON public.offers;
CREATE POLICY "Brands can insert offers they send"
  ON public.offers
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_user_id
    AND EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'brand' 
      AND u.verification_status = 'verified'
    )
  );

-- OFFERS TRIGGER GÜNCELLEME: KABUL EDİLEN TEKLİFİN BÜTÇESİYLE OYNANAMAZ
CREATE OR REPLACE FUNCTION public.restrict_offers_columns()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.role() = 'authenticated' THEN
        -- Eğer teklif zaten kabul edildiyse veya reddedildiyse, bütçe ve mesaj ASLA değişemez!
        IF OLD.status IN ('accepted', 'rejected') THEN
             NEW.budget = OLD.budget;
             NEW.message = OLD.message;
             NEW.campaign_name = OLD.campaign_name;
             NEW.status = OLD.status; -- Statü de kilitlenir (Reddettiğine sonradan dönmesin, yeni teklif açmalı)
             RETURN NEW;
        END IF;

        -- SENDER (Marka) UPDATE ediyorsa durumu 'accepted' yapamaz (Influencer yapmalı)
        IF auth.uid() = OLD.sender_user_id THEN
            NEW.status = OLD.status; 
        END IF;

        -- RECEIVER (Influencer) UPDATE ediyorsa, bütçe veya mesaj değiştiremez
        IF auth.uid() = OLD.receiver_user_id THEN
            NEW.budget = OLD.budget;
            NEW.message = OLD.message;
            NEW.campaign_name = OLD.campaign_name;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. FAVORITES: SADECE VERIFIED MARKALAR FAVORİYE EKLEYEBİLİR
DROP POLICY IF EXISTS "Brands can add favorites" ON public.favorites;
CREATE POLICY "Brands can add favorites"
ON public.favorites FOR INSERT
WITH CHECK (
  auth.uid() = brand_id
  AND EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'brand' AND u.verification_status = 'verified'
  )
);

-- 3. SOCIAL ACCOUNT HISTORY: SADECE ADMİNLER (VE SİSTEM) GEÇMİŞ YARATABİLİR
DROP POLICY IF EXISTS "Users can insert their own history" ON public.social_account_history;
CREATE POLICY "Users can insert their own history" 
ON public.social_account_history
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 4. MESSAGE READS: SADECE ODA KATILIMCISI OKUNDU BİLGİSİ GÖNDEREBİLİR
DROP POLICY IF EXISTS "Users can insert their own read receipts" ON public.message_reads;
CREATE POLICY "Users can insert their own read receipts"
ON public.message_reads
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.rooms r ON m.room_id = r.id
    WHERE m.id = message_id
    AND (r.brand_id = auth.uid() OR r.influencer_id = auth.uid())
  )
);

-- 5. USER BADGES: SİLME YETKİSİ SADECE ADMİNE VERİLDİ (Kullanıcı rozetini çöpe atamaz)
DROP POLICY IF EXISTS "Users can delete their own badges" ON public.user_badges;
CREATE POLICY "Users can delete their own badges"
ON public.user_badges
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 6. ANALYTICS EVENTS: DİREKT INSERT KAPATILDI, SADECE SECURITY DEFINER FONKSİYON KULLANILABİLİR
DROP POLICY IF EXISTS "Authenticated users can insert events" ON public.analytics_events;
-- Not: track_analytics_event fonksiyonu zaten 'security definer' olduğu için çalışmaya devam edecektir.
