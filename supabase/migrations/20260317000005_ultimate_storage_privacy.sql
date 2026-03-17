-- ==============================================================================
-- 14. PENTAGON SECURITY: PRIVACY & STORAGE SHIELD
-- AÇIKLAR:
-- 1. 'avatars' bucket'ı için RLS politikaları eksik veya çok gevşekti.
-- 2. 'track_analytics_event' RPC fonksiyonu, doğrulama yapmadan her brandId için sahte olay ekleyebiliyordu.
-- 3. 'users' tablosundaki 'tax_id' ve 'email' gibi kritik bilgiler anonim kullanıcılarca görülebiliyordu.
-- ==============================================================================

-- 1. STORAGE: AVATARS BUCKET GÜVENLİĞİ
-- Not: Bucket'ın var olduğunu varsayıyoruz (Onboarding'de kullanılıyor).
DELETE FROM storage.policies WHERE bucket_id = 'avatars'; -- Temizlik

CREATE POLICY "Avatar Images are publicly viewable"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);


-- 2. ANALYTICS: RPC GÜVENLİK DOĞRULAMASI (SPAM ENGELLEYİCİ)
CREATE OR REPLACE FUNCTION public.track_analytics_event(
  p_event_type text,
  p_target_id uuid,
  p_brand_id uuid,
  p_meta jsonb default '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
  v_is_valid boolean := false;
BEGIN
    -- DoĞRULAMA: p_brand_id gerçekten p_target_id'nin sahibi mi?
    -- Eğer event 'view_advert' ise, bran_id o ilanın sahibi olmalı.
    IF p_event_type = 'view_advert' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.advert_projects 
            WHERE id = p_target_id AND brand_user_id = p_brand_id
        ) INTO v_is_valid;
    -- Eğer event 'view_profile' ise, target_id ile brand_id uyuşmalı (Marka profilini görüyorsa)
    ELSIF p_event_type = 'view_profile' THEN
        IF p_target_id = p_brand_id THEN
            v_is_valid := true;
        END IF;
    ELSE
        -- Diğer olaylar için (click_profile vb) şimdilik p_brand_id'nin varlığını kontrol et
        SELECT EXISTS (
            SELECT 1 FROM public.users WHERE id = p_brand_id AND role = 'brand'
        ) INTO v_is_valid;
    END IF;

    IF NOT v_is_valid THEN
        RAISE EXCEPTION 'Geçersiz analiz verisi: Hedef ve Marka eşleşmiyor.';
    END IF;

    INSERT INTO public.analytics_events (event_type, target_id, actor_id, brand_id, meta)
    VALUES (p_event_type, p_target_id, auth.uid(), p_brand_id, p_meta)
    RETURNING id INTO v_id;
  
    RETURN v_id;
END;
$$;


-- 3. USERS: SENSITIVE DATA PRIVACY (GİZLİLİK KALPANI)
-- 'anon' (giriş yapmamış) kişilerin SELECT yetkisini kısıtlıyoruz.
-- Artık sadece isim, kullanıcı adı ve sosyal linkler gibi 'kamuya açık' alanları görecekler.
-- Supabase RLS row-level olduğu için, email ve tax_id gibi alanları tamamen gizlemek için 
-- en iyi yol SELECT yetkisini 'authenticated' kullanıcılarla kısıtlamaktır.

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.users;

-- Herkes (anon dahil) sadece TEMEL bilgileri görmeli diye bir politika Postgres'te zordur (column level yoksa).
-- Bu yüzden anonim kişilere profil listeleme yetkisini kapatıp, sadece 'authenticated' olanlara izin veriyoruz.
-- Eğer landing page'de influencer listesi gerekiyorsa, bunu server-side (service_role) ile yapmalısınız.

CREATE POLICY "Authenticated users can view profiles"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (true);

-- Not: Anonim kullanıcılar hala auth login yapabilir çünkü auth.users tablosu Supabase tarafından yönetilir.
-- Ancak public.users tablosunu API üzerinden anonim olarak sorgulayamazlar.
