-- 5.1-S5: chat-attachments yükleme kuralı oda katılımcısıyla sınırlandı.
-- Canlıda 20261007000007'deki yeni politika oluşturulamadığı için (storage.objects sahibi
-- olmadığımızdan) mevcut politika yerinde daraltıldı; adı eski kaldı.
-- Yol biçimi: {room_id}/{user_id}/{dosya}
ALTER POLICY "Authenticated users can upload chat attachments" ON storage.objects
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.rooms r
      WHERE r.id::text = (storage.foldername(name))[1]
        AND (r.brand_id = auth.uid() OR r.influencer_id = auth.uid())
    )
  );
