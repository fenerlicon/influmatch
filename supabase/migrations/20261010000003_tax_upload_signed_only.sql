-- 3.10-S1: vergi levhasi kovaya (tax-documents) istemciden dogrudan yuklenemez.
-- Yukleme yalnizca sunucunun gunluk sinir kontrolunden sonra verdigi imzali adresle yapilir
-- (createSignedUploadUrl / uploadToSignedUrl; imzali yukleme depolama politikasina takilmaz).
-- Politika silinmiyor (storage.objects uzerinde DROP yetkisi yok), WITH CHECK ile kapatiliyor.
-- SIRA: bu dosya web kodu (imzali yukleme) yayina girdikten SONRA calistirilmali; once calisirsa
-- eski kodla vergi levhasi yuklemesi basarisiz olur. Ayni SQL supabase/manual/2026-10-10_vergi_yukleme.sql icinde.

ALTER POLICY "Brands upload their own tax documents" ON storage.objects WITH CHECK (false);
