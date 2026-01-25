# Supabase Setup Checklist

Migration'ları çalıştırdıktan sonra Supabase Dashboard'da yapmanız gereken manuel işlemler:

## ✅ 1. Storage Buckets Kontrolü

**Önce kontrol edin - belki zaten var!**

1. Supabase Dashboard → **Storage** sekmesine gidin
2. Şu bucket'ların var olup olmadığını kontrol edin:
   - `advert-hero-images`
   - `feedback-images`

### Eğer YOKSA oluşturun:
77
#### Advert Hero Images Bucket
1. **"New bucket"** butonuna tıklayın
2. Ayarlar:
   - **Name:** `advert-hero-images`
   - **Public bucket:** ✅ **Açık** (herkes okuyabilsin)
   - **File size limit:** 5 MB (veya istediğiniz limit)
   - **Allowed MIME types:** `image/jpeg, image/png, image/webp`
3. **"Create bucket"** butonuna tıklayın

#### Feedback Images Bucket
1. **"New bucket"** butonuna tekrar tıklayın
2. Ayarlar:
   - **Name:** `feedback-images`
   - **Public bucket:** ✅ **Açık** (herkes okuyabilsin)
   - **File size limit:** 5 MB
   - **Allowed MIME types:** `image/jpeg, image/png, image/webp`
3. **"Create bucket"** butonuna tıklayın

**Not:** RLS policies migration'larda zaten oluşturuldu. Bucket'lar varsa, policies otomatik çalışıyor demektir.

---

## ✅ 2. Auth Trigger Oluşturma (ÖNEMLİ!)

**Eğer `on_auth_user_created` trigger'ı yoksa:**

Bu trigger, yeni kullanıcı kaydı olduğunda `auth.users` tablosundan `public.users` tablosuna otomatik kopyalama yapar.

**Oluşturmak için:**

1. Supabase Dashboard → **SQL Editor** sekmesine gidin
2. Şu SQL'i çalıştırın:

```sql
-- Create function to sync auth.users to public.users
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, role, full_name, username, created_at)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'influencer'),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'username',
    timezone('utc', now())
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_auth_user();
```

**Veya migration dosyasını çalıştırın:**
- `supabase/migrations/create_auth_user_trigger.sql` dosyasını SQL Editor'da çalıştırın

**Kontrol için:**
1. **Database** → **Triggers** sekmesine gidin
2. `on_auth_user_created` trigger'ının aktif olduğunu kontrol edin ✅
3. **Database** → **Functions** sekmesine gidin
4. `handle_new_auth_user` fonksiyonunun var olduğunu kontrol edin ✅

---

## ✅ 3. Site URL Ayarları (ÖNEMLİ - Mutlaka Kontrol Edin!)

1. Supabase Dashboard → **Authentication** → **URL Configuration** sekmesine gidin
2. **Site URL** alanına Vercel domain'inizi yazın:
   - Örnek: `https://your-project.vercel.app`
3. **Redirect URLs** alanına ekleyin:
   - `https://your-project.vercel.app/**`
   - `http://localhost:3000/**` (development için)
4. **"Save"** butonuna tıklayın

**Bu çok önemli!** Auth redirect'ler çalışması için gerekli.

---

## ✅ 4. Email Templates (Opsiyonel - Varsayılanlar Çalışır)

1. Supabase Dashboard → **Authentication** → **Email Templates** sekmesine gidin
2. Email template'lerini Türkçe'ye çevirebilirsiniz (opsiyonel)
3. Varsayılan template'ler çalışır, ama özelleştirebilirsiniz

---

## ✅ 5. Database Bağlantı Testi (Kontrol İçin)

1. Supabase Dashboard → **SQL Editor** sekmesine gidin
2. Şu sorguyu çalıştırın:
```sql
-- Tüm tabloları kontrol et
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Beklenen tablolar:
- `users`
- `offers`
- `advert_projects`
- `advert_applications`
- `rooms`
- `messages`
- `message_reads`
- `message_reports`
- `user_blocks`
- `user_badges`
- `dismissed_offers`
- `feedback_submissions`
- `support_tickets`

---

## ✅ 6. RLS Policies Kontrolü (Migration'larda Zaten Oluşturuldu)

Migration'lar tüm RLS policies'leri oluşturdu.

**Kontrol için:**
1. Supabase Dashboard → **Database** → **Tables** sekmesine gidin
2. Her tabloda **RLS enabled** olduğunu kontrol edin ✅
3. Policies sekmesinden policy'lerin oluşturulduğunu kontrol edin ✅

**Eğer policies varsa:** Hiçbir şey yapmanıza gerek yok! ✅

---

## ✅ 7. Admin Kullanıcı Oluşturma (Opsiyonel)

Eğer admin panelini kullanacaksanız:

1. Normal bir kullanıcı oluşturun (signup ile)
2. Supabase Dashboard → **Database** → **Table Editor** → **users** tablosuna gidin
3. Kullanıcının `role` sütununu `admin` olarak değiştirin
4. Veya email'i `admin@influmatch.net` olarak ayarlayın

**Not:** Admin kontrolü kodda `admin@influmatch.net` email'i veya `role = 'admin'` ile yapılıyor.

---

## ✅ 8. Environment Variables Kontrolü

Vercel'de environment variables'ların doğru olduğundan emin olun:
- `NEXT_PUBLIC_SUPABASE_URL` ✅
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✅
- `SUPABASE_SERVICE_ROLE_KEY` (opsiyonel) ✅

---

## 📋 Özet: Gerçekten Yapmanız Gerekenler

Migration'ları çalıştırdıysanız, çoğu şey zaten hazır! Sadece şunları kontrol/ayarlayın:

1. ✅ **Storage Buckets** - Varsa hiçbir şey yapmayın, yoksa oluşturun
2. ✅ **Site URL** - **MUTLAKA** Vercel domain'inizi ekleyin (auth redirect için)
3. ✅ **Auth Trigger** - ✅ **TAMAMLANDI!** `on_auth_user_created` trigger'ı oluşturuldu
4. ✅ **Admin Kullanıcı** - İsterseniz oluşturun (opsiyonel)

Diğer her şey (tables, policies, triggers, functions) migration'larda zaten oluşturuldu! 🎉

---

## 🎉 Tamamlandı!

Tüm adımları tamamladıktan sonra:
1. Vercel'de deploy'u kontrol edin
2. Siteyi test edin
3. User registration flow'unu test edin
4. Admin panelini test edin (eğer admin kullanıcısı oluşturduysanız)

---

## 🐛 Sorun Giderme

### Storage bucket hatası alırsanız:
- Bucket'ların oluşturulduğundan emin olun
- Bucket isimlerinin tam olarak `advert-hero-images` ve `feedback-images` olduğunu kontrol edin

### Auth redirect hatası alırsanız:
- Site URL'in doğru ayarlandığından emin olun
- Redirect URLs'in eklendiğinden emin olun

### RLS policy hatası alırsanız:
- Migration'ların tamamının çalıştığından emin olun
- Policies sekmesinden policy'lerin var olduğunu kontrol edin

