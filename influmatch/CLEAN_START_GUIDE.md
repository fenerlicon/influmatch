# 🧹 Temiz Başlangıç Rehberi - GitHub & Vercel

Bu rehber, GitHub ve Vercel'i sıfırlayıp temiz bir başlangıç yapmanızı sağlar.

## 📋 Adım 1: Vercel'deki Projeyi Silme

### 1.1 Vercel Dashboard'a Gidin
1. [vercel.com](https://vercel.com) → Giriş yapın
2. Dashboard'dan projenizi bulun

### 1.2 Projeyi Silin
1. Projenize tıklayın
2. **Settings** sekmesine gidin
3. En alta kaydırın
4. **"Delete Project"** veya **"Remove Project"** butonunu bulun
5. Proje adını yazarak onaylayın
6. **"Delete"** butonuna tıklayın

✅ **Vercel projesi silindi**

---

## 📋 Adım 2: GitHub Repository'yi Temizleme

### Seçenek A: Mevcut Repository'yi Temizleme (Önerilen)

1. [GitHub.com](https://github.com) → Giriş yapın
2. `fenerlicon/influ` repository'sine gidin
3. **Settings** sekmesine gidin
4. En alta kaydırın
5. **"Delete this repository"** bölümünü bulun
6. Repository adını yazarak onaylayın
7. **"I understand the consequences, delete this repository"** butonuna tıklayın

✅ **GitHub repository silindi**

### Seçenek B: Yeni Repository Oluşturma (Alternatif)

Eğer mevcut repository'yi silmek istemiyorsanız:
1. Yeni bir repository oluşturun: `influmatch` (veya istediğiniz isim)
2. Eski repository'yi ignore edin

---

## 📋 Adım 3: Local Git'i Temizleme

### 3.1 Remote'u Kaldırın

Terminal'de şu komutu çalıştırın:
```powershell
git remote remove origin
```

### 3.2 Kontrol Edin
```powershell
git remote -v
```
(Hiçbir şey çıkmamalı)

✅ **Local git temizlendi**

---

## 📋 Adım 4: Yeni GitHub Repository Oluşturma

### 4.1 GitHub'da Yeni Repository
1. [GitHub.com](https://github.com) → Giriş yapın
2. Sağ üstteki **"+"** → **"New repository"**
3. **Repository name:** `influmatch` (veya istediğiniz isim)
4. **Description:** (opsiyonel) "Influmatch - Influencer & Brand Collaboration Platform"
5. **Public** veya **Private** seçin
6. ⚠️ **ÖNEMLİ:** **"Initialize this repository with a README"** seçeneğini **KALDIRIN**
7. **"Create repository"** butonuna tıklayın

### 4.2 Repository URL'ini Kopyalayın
Oluşturduktan sonra GitHub size URL gösterecek, örneğin:
```
https://github.com/fenerlicon/influmatch.git
```

✅ **Yeni GitHub repository oluşturuldu**

---

## 📋 Adım 5: Local Kodları GitHub'a Push Etme

### 5.1 Remote'u Ekleyin

Terminal'de (kendi repository URL'inizi kullanın):
```powershell
git remote add origin https://github.com/fenerlicon/influmatch.git
```

### 5.2 Kontrol Edin
```powershell
git remote -v
```
(Repository URL'inizi görmelisiniz)

### 5.3 Tüm Dosyaları Kontrol Edin
```powershell
git status
```

### 5.4 Eksik Dosyaları Ekleyin (Varsa)
```powershell
git add .
git commit -m "Initial commit: Complete Influmatch platform"
```

### 5.5 GitHub'a Push Edin

**Yöntem 1: Terminal (GitHub CLI veya Personal Access Token gerekebilir)**
```powershell
git push -u origin main
```

**Yöntem 2: GitHub Desktop (Önerilen)**
1. GitHub Desktop'ı açın
2. **File → Add Local Repository**
3. `C:\Users\Arda Furkan Aslanbaş\influmatch` klasörünü seçin
4. **Publish repository** butonuna tıklayın
5. Repository'yi seçin ve **Publish** yapın

✅ **Kodlar GitHub'a push edildi**

---

## 📋 Adım 6: Vercel'de Yeni Proje Oluşturma

### 6.1 Vercel Dashboard'a Gidin
1. [vercel.com](https://vercel.com) → Giriş yapın
2. **"Add New Project"** veya **"New Project"** butonuna tıklayın

### 6.2 GitHub Repository'yi Seçin
1. GitHub hesabınızı bağlayın (eğer bağlı değilse)
2. `influmatch` repository'sini seçin
3. **"Import"** butonuna tıklayın

### 6.3 Proje Ayarlarını Yapın

**Framework Preset:**
- ✅ **Next.js** (otomatik algılanmalı)

**Root Directory:**
- ✅ **Boş bırakın** veya **"."** yazın
- ❌ Başka bir şey yazmayın

**Build Command:**
- ✅ `npm run build` (otomatik olmalı)

**Output Directory:**
- ✅ **Boş bırakın** (Next.js otomatik ayarlar)

**Install Command:**
- ✅ `npm install` (otomatik olmalı)

### 6.4 Environment Variables Ekleyin

**Settings → Environment Variables** bölümüne gidin ve şunları ekleyin:

1. **NEXT_PUBLIC_SUPABASE_URL**
   - Value: Supabase Project URL'iniz
   - Environment: ✅ Production, ✅ Preview

2. **NEXT_PUBLIC_SUPABASE_ANON_KEY**
   - Value: Supabase anon key'iniz
   - Environment: ✅ Production, ✅ Preview

3. **SUPABASE_SERVICE_ROLE_KEY** (Opsiyonel)
   - Value: Supabase service_role key'iniz
   - Environment: ✅ Production, ✅ Preview

**Bu değerleri nereden bulacaksınız?**
- [Supabase Dashboard](https://app.supabase.com) → Projeniz → Settings → API

### 6.5 Deploy Edin
1. **"Deploy"** butonuna tıklayın
2. İlk deployment 2-3 dakika sürebilir
3. Deployment tamamlandığında URL alacaksınız

✅ **Vercel deployment başarılı**

---

## 📋 Adım 7: Kontrol ve Test

### 7.1 GitHub Kontrolü
1. GitHub'da repository'nize gidin
2. `package.json` dosyasının göründüğünü kontrol edin
3. Tüm dosyaların push edildiğini kontrol edin

### 7.2 Vercel Kontrolü
1. Vercel Dashboard'da projenize gidin
2. **Deployments** sekmesinde başarılı deployment görmelisiniz
3. **Settings → General**'de ayarları kontrol edin:
   - Root Directory: Boş
   - Framework: Next.js

### 7.3 Site Testi
1. Vercel'den aldığınız URL'yi açın
2. Site çalışıyor mu kontrol edin
3. Hata varsa Vercel logs'a bakın

---

## 🆘 Sorun Giderme

### "No Next.js version detected" hatası
- ✅ Root Directory boş olmalı
- ✅ package.json GitHub'da olmalı
- ✅ Framework Preset: Next.js olmalı

### "Build failed" hatası
- ✅ Environment Variables eklenmiş mi kontrol edin
- ✅ Vercel logs'a bakın (Deployments → Logs)

### "Repository not found" hatası
- ✅ GitHub'da repository var mı kontrol edin
- ✅ Vercel'de GitHub bağlantısı doğru mu kontrol edin

---

## ✅ Tamamlandı!

Artık temiz bir başlangıç yaptınız:
- ✅ GitHub'da temiz repository
- ✅ Vercel'de yeni proje
- ✅ Tüm ayarlar doğru
- ✅ Site çalışıyor

Herhangi bir sorun olursa haber verin!

