-- ==============================================================================
-- DEPOLAMA SINIRLARI VE SOHBET EKI POLITIKASI (5.1-S5, 7.5-S2, 8.9-N1)
--
-- 1. Herkese acik gorsel kovalari: en fazla 5 MB, yalnizca gorsel turleri
--    (canliya 7 Ekim 2026 tarihinde uygulandi).
-- 2. chat-attachments: yukleme yolu {oda}/{kullanici}/dosya. Eski politika giris yapmis
--    herkesin istedigi yola yuklemesine izin veriyordu; yeni politika yalnizca odanin
--    katilimcisinin kendi klasorune yuklemesine izin verir.
--
-- Supabase SQL Editor uyumu: yorumlarda tek tirnak yok, soru isareti yok.
-- ==============================================================================

UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png','image/jpeg','image/jpg','image/webp','image/gif','image/heic','image/heif']
WHERE id IN ('avatars', 'advert-hero-images', 'chat-attachments', 'feedback-images');

DROP POLICY IF EXISTS "Authenticated users can upload chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Room participants upload chat attachments" ON storage.objects;
CREATE POLICY "Room participants upload chat attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.rooms r
      WHERE r.id::text = (storage.foldername(name))[1]
        AND (r.brand_id = auth.uid() OR r.influencer_id = auth.uid())
    )
  );
