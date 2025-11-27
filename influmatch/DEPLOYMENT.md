# Deployment Guide - Influmatch

Bu doküman, Influmatch projesini production'a deploy etmek için gerekli adımları içerir.

## 🚀 Hızlı Başlangıç (Vercel)

### 1. Vercel'e Proje Ekleme

1. [Vercel](https://vercel.com) hesabınıza giriş yapın
2. "Add New Project" butonuna tıklayın
3. GitHub repository'nizi seçin veya import edin
4. Vercel otomatik olarak Next.js projesini algılayacaktır

### 2. Environment Variables Ayarlama

Vercel dashboard'da projenizin **Settings > Environment Variables** bölümüne gidin ve şu değişkenleri ekleyin:

#### Adım Adım (Görsel Rehber):

1. **Vercel Dashboard'a gidin**
   - [vercel.com](https://vercel.com) → Giriş yapın

2. **Projenizi seçin**
   - Dashboard'dan deploy ettiğiniz projeye tıklayın

3. **Settings'e gidin**
   - Üst menüden **"Settings"** sekmesine tıklayın
   - (Proje sayfasında üstteki menü çubuğunda)

4. **Environment Variables'a gidin**
   - Sol menüden **"Environment Variables"** seçeneğine tıklayın
   - (Settings sayfasının sol tarafındaki menüden)

5. **Yeni değişken ekleyin**
   - **"Add New"** veya **"Add"** butonuna tıklayın
   - (Sayfanın sağ üst köşesinde veya ortada bir buton olacak)

6. **Her bir değişken için formu doldurun:**
   - **Key** (Anahtar): Değişken adını yazın (örn: `NEXT_PUBLIC_SUPABASE_URL`)
   - **Value** (Değer): Değerini yazın (Supabase'den alacağınız URL/key)
   - **Environment**: 
     - ✅ **Production** - Canlı site için (mutlaka seçin)
     - ✅ **Preview** - Pull Request'ler için test (önerilir)
     - ✅ **Development** - Local development için (opsiyonel)
     - 💡 **Öneri:** En azından **Production** ve **Preview** seçin
   - **"Save"** butonuna tıklayın

7. **Her değişkeni tekrar ekleyin**
   - `NEXT_PUBLIC_SUPABASE_URL` için tekrar "Add New" → doldur → Save
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` için tekrar "Add New" → doldur → Save
   - `SUPABASE_SERVICE_ROLE_KEY` için tekrar "Add New" → doldur → Save (opsiyonel)

**⚠️ ÖNEMLİ:** Vercel'de `.env` dosyası import etme özelliği yok! Her değişkeni manuel olarak tek tek eklemeniz gerekiyor.

#### Zorunlu Değişkenler:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
```

**Bu değerleri nereden bulacaksınız?**
1. [Supabase Dashboard](https://app.supabase.com) → Projenize gidin
2. Sol menüden **"Settings"** → **"API"** sekmesine gidin
3. **"Project URL"** → `NEXT_PUBLIC_SUPABASE_URL` değeri
4. **"anon public"** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY` değeri

#### Opsiyonel Değişkenler (Admin işlemleri için):
```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Bu değeri nereden bulacaksınız?**
1. Supabase Dashboard → **"Settings"** → **"API"** sekmesi
2. **"service_role"** key → `SUPABASE_SERVICE_ROLE_KEY` değeri
3. ⚠️ **DİKKAT:** Bu key çok hassas! Tüm RLS'i bypass eder. Sadece güvenilir server-side kodda kullanın.

**Not:** `SUPABASE_SERVICE_ROLE_KEY` sadece admin işlemleri (rozet verme vb.) için gereklidir. Güvenlik nedeniyle production'da kullanmadan önce dikkatli olun.

### 3. Supabase Migrations'ları Çalıştırma

**✅ Migration'ları çalıştırdıysanız, şimdi manuel işlemler var!**

Detaylı kontrol listesi için [SUPABASE_SETUP_CHECKLIST.md](./SUPABASE_SETUP_CHECKLIST.md) dosyasına bakın.

**Hızlı Özet:**
1. ✅ Storage buckets oluşturun (`advert-hero-images`, `feedback-images`)
2. ✅ Site URL ayarlayın (Vercel domain'inizi ekleyin)
3. ✅ Auth trigger'ların çalıştığını kontrol edin
4. ✅ Admin kullanıcı oluşturun (opsiyonel)

### 3.1. Supabase Migrations'ları Çalıştırma (Detaylı)

Production database'ine migrations'ları uygulamanız gerekiyor:

#### Yöntem 1: Supabase Dashboard'dan
1. Supabase Dashboard > SQL Editor'a gidin
2. `supabase/migrations/` klasöründeki tüm SQL dosyalarını sırayla çalıştırın
3. Önemli: Migration dosyalarını tarih sırasına göre çalıştırın
4. ⚠️ **Hata alırsanız:** "already exists" hatası alırsanız, o policy/table zaten var demektir. Migration dosyaları `DROP IF EXISTS` kullanıyor, bu yüzden güvenle çalıştırabilirsiniz. Eğer hata devam ederse, o satırı atlayıp devam edin.

#### Yöntem 2: Supabase CLI ile
```bash
# Supabase CLI'yi yükleyin
npm install -g supabase

# Production database'e bağlanın
supabase link --project-ref your-project-ref

# Migrations'ları uygulayın
supabase db push
```

### 4. Build ve Deploy

Vercel otomatik olarak build edecektir. Eğer manuel deploy isterseniz:

```bash
vercel --prod
```

## 📋 Pre-Deployment Checklist

Deploy etmeden önce kontrol edin:

- [ ] Tüm environment variables ayarlandı
- [ ] Supabase migrations production'a uygulandı
- [ ] Database schema güncel
- [ ] RLS (Row Level Security) policies doğru çalışıyor
- [ ] Storage buckets oluşturuldu (eğer dosya yükleme varsa)
- [ ] Email templates ayarlandı (eğer email gönderimi varsa)
- [ ] Domain ayarlandı (opsiyonel)

## 🔧 Diğer Platformlar

### Netlify

1. Netlify dashboard'dan projeyi import edin
2. Build command: `npm run build`
3. Publish directory: `.next`
4. Environment variables'ları ekleyin

### Railway

1. Railway dashboard'dan yeni proje oluşturun
2. GitHub repository'nizi bağlayın
3. Environment variables'ları ekleyin
4. Build command: `npm run build`
5. Start command: `npm start`

### Docker ile

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 🐛 Troubleshooting

### Build Hataları

- **Module not found**: `node_modules` klasörünü silip `npm install` çalıştırın
- **Environment variable missing**: Tüm gerekli env variables'ların ayarlandığından emin olun

### Runtime Hataları

- **Supabase connection error**: URL ve key'lerin doğru olduğundan emin olun
- **RLS policy error**: Migration'ların uygulandığından emin olun

### Database Hataları

- **Table doesn't exist**: Migrations'ları kontrol edin
- **Permission denied**: RLS policies'leri kontrol edin

## 📞 Destek

Sorun yaşarsanız:
1. Vercel build logs'ları kontrol edin
2. Supabase dashboard'dan database ve auth logs'ları kontrol edin
3. Browser console'dan client-side hataları kontrol edin

## 🔐 Güvenlik Notları

1. **SUPABASE_SERVICE_ROLE_KEY**: Bu key tüm RLS'i bypass eder. Sadece güvenilir server-side kodda kullanın.
2. **Environment Variables**: Production environment variables'ları asla commit etmeyin
3. **RLS Policies**: Tüm tablolar için uygun RLS policies'leri ayarlandığından emin olun

## 📈 Post-Deployment

1. Siteyi test edin
2. Admin panelini kontrol edin
3. User registration flow'unu test edin
4. Database queries'lerin performansını kontrol edin
5. Error monitoring (Sentry vb.) kurun (opsiyonel)

