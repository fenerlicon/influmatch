-- 3.10-S1: vergi levhasi kovasina istemciden dogrudan yuklemeyi kapatir.
-- claude/map-cleanup-cookies dali main e birlesip Vercel yayini READY olduktan SONRA SQL Editor de calistirin
-- (web ve mobil artik sunucunun verdigi imzali adresle yukluyor). Once calistirilirsa eski kodla yukleme basarisiz olur.

ALTER POLICY "Brands upload their own tax documents" ON storage.objects WITH CHECK (false);

-- Kontrol: with_check sutunu false olmali.
SELECT policyname, cmd, with_check FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Brands upload their own tax documents';

-- Geri almak gerekirse:
-- ALTER POLICY "Brands upload their own tax documents" ON storage.objects
--   WITH CHECK ((bucket_id = 'tax-documents') AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text));
