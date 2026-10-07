-- ==============================================================================
-- 2026-10-08: Sohbet ekleri gizli kovaya (SYSTEM_MAP 7.5-S2)
--
-- chat-attachments kovası herkese açıktı: adresi bilen herkes görseli açabiliyordu. Kova gizli yapılır,
-- okuma yalnızca odanın iki tarafına açılır. Web sohbeti görselleri 1 saatlik imzalı bağlantıyla gösterir;
-- mesajlarda saklı eski "public" adresler yol bilgisi olarak kullanılmaya devam eder.
-- Yükleme kuralı 20261007000017 ile zaten oda katılımcısına sınırlı.
-- ==============================================================================

ALTER POLICY "Anyone can view chat attachments" ON storage.objects
  TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND EXISTS (
      SELECT 1 FROM public.rooms r
      WHERE (r.id)::text = (storage.foldername(objects.name))[1]
        AND (r.brand_id = (SELECT auth.uid()) OR r.influencer_id = (SELECT auth.uid()))
    )
  );

UPDATE storage.buckets SET public = false WHERE id = 'chat-attachments';
