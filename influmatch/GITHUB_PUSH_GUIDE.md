# GitHub'a Push Etme Rehberi

## ⚠️ Sorun
Vercel GitHub'dan kod çekiyor ama `package.json` GitHub'da yok çünkü push edilmemiş.

## ✅ Çözüm: GitHub'a Push Etme

### Yöntem 1: GitHub Desktop (Önerilen)

1. **GitHub Desktop'ı açın**
2. **Repository → Add → Add Existing Repository**
3. `C:\Users\Arda Furkan Aslanbaş\influmatch` klasörünü seçin
4. **Publish repository** butonuna tıklayın
5. GitHub'da yeni bir repository oluşturun:
   - Repository name: `influmatch` (veya istediğiniz isim)
   - Description: (opsiyonel)
   - Public veya Private seçin
   - ✅ **"Initialize this repository with a README"** seçeneğini **KALDIRIN** (zaten kod var)
6. **Publish Repository** butonuna tıklayın

### Yöntem 2: Terminal ile (GitHub CLI veya HTTPS)

#### Adım 1: GitHub'da Repository Oluşturun
1. [GitHub.com](https://github.com) → Giriş yapın
2. Sağ üstteki **"+"** → **"New repository"**
3. Repository name: `influmatch`
4. **Public** veya **Private** seçin
5. ✅ **"Initialize this repository with a README"** seçeneğini **KALDIRIN**
6. **"Create repository"** butonuna tıklayın

#### Adım 2: Local Repository'yi GitHub'a Bağlayın

Terminal'de şu komutları çalıştırın:

```powershell
# GitHub repository URL'inizi alın (örnek: https://github.com/KULLANICI_ADI/influmatch.git)
# Aşağıdaki komutta KULLANICI_ADI ve influmatch kısımlarını kendi bilgilerinizle değiştirin

git remote add origin https://github.com/KULLANICI_ADI/influmatch.git
git branch -M main
git push -u origin main
```

**Örnek:**
```powershell
git remote add origin https://github.com/ardafurkan/influmatch.git
git branch -M main
git push -u origin main
```

## 🔍 Push Sonrası Kontrol

1. GitHub'da repository'nize gidin
2. `package.json` dosyasının göründüğünü kontrol edin
3. Vercel'de yeni bir deployment yapın

## 📋 Vercel Ayarları (Push Sonrası)

GitHub'a push ettikten sonra Vercel'de:

1. **Settings → General**
2. **Root Directory:** Boş bırakın veya `.`
3. **Framework Preset:** Next.js
4. **Build Command:** `npm run build`
5. **Output Directory:** Boş
6. **Install Command:** `npm install`

## 🆘 Hata Alırsanız

### "remote origin already exists" hatası:
```powershell
git remote remove origin
git remote add origin https://github.com/KULLANICI_ADI/influmatch.git
```

### "Permission denied" hatası:
- GitHub'da Personal Access Token kullanmanız gerekebilir
- Veya SSH key kullanın

