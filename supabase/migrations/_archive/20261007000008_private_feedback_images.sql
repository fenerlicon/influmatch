-- ==============================================================================
-- GERI BILDIRIM VE DESTEK EKLERI OZEL (1.10-S1)
--
-- feedback-images kovasindaki ekran goruntuleri kisisel bilgi icerebilir; herkese acik
-- URL ile servis ediliyordu ve herkese acik okuma politikasi ile listelenebiliyordu.
-- Kova ozel yapilir, herkese acik okuma politikasi kaldirilir. Admin ekranlari dosyayi
-- kisa sureli imzali baglanti ile acar (app/admin/attachments/actions.ts). Kullanicilar
-- yuklemeye devam eder (INSERT politikasi degismez).
--
-- Supabase SQL Editor uyumu: yorumlarda tek tirnak yok, soru isareti yok.
-- ==============================================================================

UPDATE storage.buckets SET public = false WHERE id = 'feedback-images';

DROP POLICY IF EXISTS "Everyone can read feedback images" ON storage.objects;
