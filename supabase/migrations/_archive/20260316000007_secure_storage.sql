-- ==============================================================================
-- 9. STORAGE (DOSYA/RESİM DEPOLAMA) MULTI-TENANT ZAFİYETİ
-- AÇIK: Supabase Storage modülündeki "feedback-images" ve "advert-hero-images"
-- bucket'ları için yazılan RLS politikalarında, sadece kişilerin giriş yapmış (authenticated)
-- olmaları yetiyordu. "Dosyanın asıl sahibi o mu?" diye bir kimlik doğrulaması YOKTU!
-- Sonuç: Platforma üye olan herkes; başka bir markanın/influencer'ın 
-- yüklediği ilan resimlerini silebilir, değiştirebilir ve yerine uygunsuz içerik koyabilirdi.
-- ÇÖZÜM: Yalnızca dosyanın ilk yükleyicisi (owner) olan kişiler dosyalarını UPDATE veya DELETE edebilir.
-- ==============================================================================

-- ========================================
-- "feedback-images" Kova Güvenliği
-- ========================================

-- Eskilerini atıyoruz (Tamamen açık olanlar)
DROP POLICY IF EXISTS "Authenticated users can update feedback images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete feedback images" ON storage.objects;

-- SAHİP KONTROLÜ (UPDATE)
CREATE POLICY "Users can update their own feedback images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'feedback-images' AND
  auth.uid() = owner
);

-- SAHİP KONTROLÜ (DELETE)
CREATE POLICY "Users can delete their own feedback images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'feedback-images' AND
  auth.uid() = owner
);

-- ========================================
-- "advert-hero-images" Kova Güvenliği
-- ========================================

-- Eskilerini atıyoruz (Tamamen açık olanlar)
DROP POLICY IF EXISTS "Authenticated users can update hero images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete hero images" ON storage.objects;

-- SAHİP KONTROLÜ (UPDATE)
CREATE POLICY "Users can update their own hero images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'advert-hero-images' AND
  auth.uid() = owner
);

-- SAHİP KONTROLÜ (DELETE)
CREATE POLICY "Users can delete their own hero images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'advert-hero-images' AND
  auth.uid() = owner
);
