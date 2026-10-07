-- avatars kovası politika temizliği (7.5-S1).
-- 20260317000005 canlıda hiç uygulanmamış (var olmayan storage.policies tablosuna DELETE yüzünden
-- dosya geri alınmış); oradaki politika adları canlıda yok.
--
-- "Tam Yetki 1oj01fe_*" politikaları hem `authenticated` rolüne verilmiş hem `auth.role() = 'anon'`
-- şartı taşıyor; hiçbir zaman sağlanamaz, yani ölüler. Silinmeleri davranışı değiştirmez.
DROP POLICY IF EXISTS "Tam Yetki 1oj01fe_0" ON storage.objects;
DROP POLICY IF EXISTS "Tam Yetki 1oj01fe_1" ON storage.objects;
DROP POLICY IF EXISTS "Tam Yetki 1oj01fe_2" ON storage.objects;
DROP POLICY IF EXISTS "Tam Yetki 1oj01fe_3" ON storage.objects;

-- NOT: "avatars insert" (giriş yapmış herkes kovanın her yoluna yükleyebilir) şimdilik bırakıldı:
-- yayındaki mobil sürüm marka profili ve onboarding avatarlarını public/<uid>/ yoluna yüklüyor.
-- Yeni mobil sürüm (PR #22, <uid>/ yolu) yayına çıkınca şu satır da çalıştırılmalı:
--   DROP POLICY IF EXISTS "avatars insert" ON storage.objects;
-- Kendi klasörüne yükleme "Users can manage their own avatar" ile zaten açık.
