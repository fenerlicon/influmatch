-- ==============================================================================
-- 1. USERS TABLE SECURITY 
-- AÇIK: İsteyen API'den post atıp rolünü 'admin' yapabilir, verification_status = 'verified' verebilir.
-- ÇÖZÜM: Update işleminde auth = role() olanlar bu alanları güncellerse, eski verisini sabit bırakacak trigger eklendi.
-- ==============================================================================

-- Profil güncelleme politikasını siliyoruz ve orijinal halini tekrar ekliyoruz ki temiz olsun.
drop policy if exists "Users can update their own profile" on public.users;

CREATE OR REPLACE FUNCTION public.restrict_users_sensitive_columns()
RETURNS TRIGGER AS $$
BEGIN
    -- Sadece normal giriş yapmış 'authenticated' kullanıcılar için kilit koyuyoruz. Admin panelleri veya backend için de 'authenticated' olabilir.
    -- Bu sebeple backend yetkisiz müdahalesine karşı korur. Service_role bunu bypass eder.
    IF auth.role() = 'authenticated' THEN
        -- Kullanıcının kendi değerini ezmesine engel oluyoruz.
        NEW.role = OLD.role;
        NEW.verification_status = OLD.verification_status;
        NEW.spotlight_active = OLD.spotlight_active;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS restrict_users_trigger ON public.users;

CREATE TRIGGER restrict_users_trigger
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.restrict_users_sensitive_columns();

create policy "Users can update their own profile"
  on public.users
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ==============================================================================
-- 2. ADVERT APPLICATIONS SECURITY 
-- AÇIK 1: Influencerlar kendi status'lerini 'accepted' yapabiliyor. (Brand yerine kendisini onaylıyordu!)
-- AÇIK 2: Brandler, kendi ilanlarının applications status'lerini Update etme RLS iznine sahip değildi!! API'den yapılan onay işlemi DB tarafında geçersiz kalıyordu.
-- AÇIK 3: Onaylı olmayan (verified olmayan) Influencerlar ilanlara başvurabiliyordu.
-- ==============================================================================

DROP POLICY IF EXISTS "Influencers manage their applications" ON public.advert_applications;
DROP POLICY IF EXISTS "Brands view applications to their adverts" ON public.advert_applications;
DROP POLICY IF EXISTS "Influencers can apply to adverts" ON public.advert_applications;
DROP POLICY IF EXISTS "Influencers can view their own applications" ON public.advert_applications;
DROP POLICY IF EXISTS "Influencers can delete their own applications" ON public.advert_applications;
DROP POLICY IF EXISTS "Brands update applications to their adverts" ON public.advert_applications;

-- INFLUENCER: Sadece VERIFIED olanlar ilanlara başvurabilir
CREATE POLICY "Influencers can apply to adverts"
  ON public.advert_applications
  FOR INSERT
  WITH CHECK (
    (auth.uid() = influencer_user_id OR auth.uid() = influencer_id)
    AND EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role = 'influencer' AND u.verification_status = 'verified'
    )
  );

-- INFLUENCER: Kendi başvurularını görebilir ve silebilir (Update iznini kaldırdık, çünkü status veya diğer alanlara elle müdahale etmesinler)
CREATE POLICY "Influencers can view their own applications"
  ON public.advert_applications
  FOR SELECT
  USING (influencer_user_id = auth.uid() OR influencer_id = auth.uid());

CREATE POLICY "Influencers can delete their own applications"
  ON public.advert_applications
  FOR DELETE
  USING (influencer_user_id = auth.uid() OR influencer_id = auth.uid());

-- BRAND: Markalar kendi ilanlarına yapılan başvuruları hem GÖREBİLİR hem de GÜNCELLEYEBİLİR (Onaylamak için Update şarttı).
CREATE POLICY "Brands view applications to their adverts"
  ON public.advert_applications
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.advert_projects ap
    WHERE ap.id = advert_id AND ap.brand_user_id = auth.uid()
  ));

CREATE POLICY "Brands update applications to their adverts"
  ON public.advert_applications
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.advert_projects ap
    WHERE ap.id = advert_id AND ap.brand_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.advert_projects ap
    WHERE ap.id = advert_id AND ap.brand_user_id = auth.uid()
  ));


-- ==============================================================================
-- 3. OFFERS TABLE SECURITY
-- AÇIK 1: Marka teklif yolladıktan sonra, status'ü Influencer'ın kabul etmesini beklemeden kendisi 'accepted' yapabiliyordu.
-- AÇIK 2: Influencer, kendine gelen teklifin budget'ını Milyon dolara çekip sonra kabul edebiliyordu.
-- ==============================================================================

DROP POLICY IF EXISTS "Brands can insert offers they send" on public.offers;
DROP POLICY IF EXISTS "Brands can update their sent offers" on public.offers;
DROP POLICY IF EXISTS "Influencers can update offers addressed to them" on public.offers;

-- Trigger ile Update Kısıtlaması Getiriyoruz
CREATE OR REPLACE FUNCTION public.restrict_offers_columns()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.role() = 'authenticated' THEN
        -- SENDER (Marka) UPDATE ediyorsa durumu değiştiremez. (Sadece Influencer kabul/red etmeli)
        IF auth.uid() = OLD.sender_user_id THEN
            NEW.status = OLD.status; 
        END IF;

        -- RECEIVER (Influencer) UPDATE ediyorsa, budget veya message değiştiremez. (Sadece durumu kabul/red yapabilir)
        IF auth.uid() = OLD.receiver_user_id THEN
            NEW.budget = OLD.budget;
            NEW.message = OLD.message;
            NEW.campaign_name = OLD.campaign_name;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS restrict_offers_trigger ON public.offers;

CREATE TRIGGER restrict_offers_trigger
BEFORE UPDATE ON public.offers
FOR EACH ROW
EXECUTE FUNCTION public.restrict_offers_columns();

-- Brand Sadece Markayken Teklif Atar
CREATE POLICY "Brands can insert offers they send"
  ON public.offers
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_user_id
    AND EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'brand'
    )
  );

-- Güncelleme Hakları (Trigger zaten istenmeyen alanları ezecektir, bu yüzden Update verilebilir)
CREATE POLICY "Brands can update their sent offers"
  ON public.offers
  FOR UPDATE
  USING (auth.uid() = sender_user_id)
  WITH CHECK (auth.uid() = sender_user_id);

CREATE POLICY "Influencers can update offers addressed to them"
  ON public.offers
  FOR UPDATE
  USING (auth.uid() = receiver_user_id)
  WITH CHECK (auth.uid() = receiver_user_id);
