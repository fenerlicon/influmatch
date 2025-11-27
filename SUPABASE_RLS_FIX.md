# Supabase RLS Policy Fix - Profil Güncelleme Sorunu

## Sorun
Profil güncelleme işlemi başarılı görünüyor ama veriler Supabase'e kaydedilmiyor.

## Çözüm Adımları

### 1. Supabase SQL Editor'de Çalıştırın

```sql
-- Mevcut politikayı kontrol et
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'users' AND policyname = 'Users can update their own profile';

-- Eğer politika yoksa veya yanlışsa, düzelt
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

CREATE POLICY "Users can update their own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Politikayı doğrula
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'users' AND policyname = 'Users can update their own profile';
```

### 2. Test Query

Kendi kullanıcı ID'nizle test edin:

```sql
-- Önce mevcut veriyi görün
SELECT id, full_name, username, city, bio, category 
FROM users 
WHERE id = auth.uid();

-- Test update (kendi ID'nizi kullanın)
UPDATE users 
SET full_name = 'Test Name'
WHERE id = auth.uid();

-- Tekrar kontrol edin
SELECT id, full_name, username, city, bio, category 
FROM users 
WHERE id = auth.uid();
```

### 3. Console Loglarını Kontrol Edin

Profil kaydettikten sonra tarayıcı console'unda (F12) şu logları kontrol edin:
- `[updateProfile] Attempting update for user: ...`
- `[updateProfile] Updates: ...`
- `[updateProfile] Update successful` veya hata mesajları

### 4. Supabase Dashboard'da Kontrol Edin

1. Supabase Dashboard → Table Editor → users
2. Kendi kullanıcı ID'nizi bulun
3. Profil kaydettikten sonra verilerin güncellenip güncellenmediğini kontrol edin

## Olası Sorunlar

1. **RLS Politikası Eksik**: Yukarıdaki SQL'i çalıştırın
2. **Auth Token Sorunu**: Tarayıcıda çıkış yapıp tekrar giriş yapın
3. **Cache Sorunu**: Next.js cache'i temizleyin veya hard refresh yapın (Ctrl+Shift+R)

