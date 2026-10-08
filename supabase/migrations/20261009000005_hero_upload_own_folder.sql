-- Ilan kapak gorselleri: yukleme yalnizca kullanicinin kendi klasorune (uid/...) yapilabilir.
-- ONCE PR birlestirilip yayina cikmali: eski kod dosyalari kok dizine yaziyordu.
ALTER POLICY "Authenticated users can upload hero images" ON storage.objects
  WITH CHECK (
    bucket_id = 'advert-hero-images'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- Dogrulama
SELECT policyname, with_check FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can upload hero images';
