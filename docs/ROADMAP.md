# Influmatch yol haritası (2026-10-10, kullanıcıyla belirlendi)

> Kararlar kullanıcıya ait; tarih/fiyat/kampanya metinleri kullanıcı onayı olmadan arayüze yazılmaz (CLAUDE.md kural 7).
> Bu belge strateji ve takvimin tek kaynağıdır; değişiklik olursa burayı güncelle.

## Hedef

- **Aralık son haftasına kadar** web, mobil ve **Akademi** tam hazır; bu sürede kitle yavaş yavaş toplanır.
- **Aralık son hafta:** "Her şey 0₺" yılbaşı kampanyası (Akademi hariç). Ayrıntılar henüz netleşmedi (kullanıcıda).
- **Şirket 1 Ocak'ta açılır** (şahıs şirketi; vergi dönemi avantajı için daha önce açılmayacak — kesin karar).
  POS başvurusu şirketle birlikte → **satış Ocak ortası–sonu**. Öneri: 0₺ kampanyası POS açılana kadar uzatılır, ücretsiz
  dönem bitişi = satış başlangıcı (bitişten önce "üyeliğin bitiyor" bildirimi + e-postası kurulmalı).
- Sonra gelir ve büyüme. Süreç ileride **InfluAct**'e varacak (acelesi yok).

## Takvim

| Dönem | Kod (Claude) | Kullanıcı |
|---|---|---|
| Ekim sonu | Açık liste biter; çok hesaplı toplu test | Eğitim yüzü, Akademi metinleri |
| Kasım | **Akademi** (kurs, video, ilerleme, sınav, sertifika) + **R2 "Drive"** (videolar ve görseller) | Video çekimi/kurgu, Cloudflare hesabı, **bireysel** Apple/Google geliştirici hesapları, `eas init` + FCM |
| Aralık 1–2. hafta | Mağazaya gönderim, kampanya altyapısı, üyelik bitiş hatırlatmaları | Kampanya ayrıntıları, POS sağlayıcı seçimi ve evrak hazırlığı, **Resend ücretli plan** (ücretsiz plan günde 100 e-posta; kampanya bunu aşar) |
| Aralık son hafta | 0₺ kampanyası yayında | |
| 1 Ocak | | Şirket kuruluşu, POS başvurusu, D-U-N-S başvurusu |
| Ocak ortası–sonu | POS entegrasyonu canlı (test ortamında önceden hazırlanır), satış başlar | Avukattan yasal metinler (mesafeli satış, ön bilgilendirme, iptal/iade, KVKK) şirket bilgisiyle |
| Şirket + D-U-N-S sonrası | Uygulamalar bireysel hesaptan şirket hesabına taşınır (Apple ve Google destekliyor, kullanıcı/yorum korunur) | Şirket geliştirici hesapları |

## Akademi (kararlar)

- **Kime:** yalnızca **hesabını doğrulamış influencer/UGC'ler** satın alabilir.
- **İçerik:** temel taktik ve eğitim videoları; ayrıca işinde iyi UGC/influencer'larla kısa görüşmeler (tanıtım/vitrin içeriği
  olarak ücretsiz kullanılabilir). Metinleri kullanıcı yazar, bir eğitmen anlatır, kurguyu kullanıcı yapar.
- **Satış:** **tek seferlik, ömür boyu** erişim (abonelik yok). Fiyatı kullanıcı belirler. 0₺ kampanyasına dahil değil.
- **İzleme:** **sıralı** — bir video bitmeden ve bölüm sonu testi geçilmeden sonraki açılmaz.
- **Final sınavı:** geçme notu **%80**, **sınırsız hak**, denemeler arası **24 saat**; sorular havuzdan karışık gelir.
  Değerler admin panelinden değiştirilebilir olsun.
- **Mezuniyet:** profilde "Influmatch Akademi Mezunu" rozeti + indirilebilir sertifika. InfluAct seçiminde kullanılacak.
- **Admin:** kurs/bölüm/video ekleme, video yükleme, soru havuzu, sonuçlar.
- **Video barındırma:** Cloudflare R2 (çıkış trafiği ücretsiz). Yalnızca satın almış ve giriş yapmış kullanıcıya kısa süreli
  imzalı bağlantı. Not: ekran kaydı hiçbir sistemle tamamen engellenemez; rastgele paylaşım ve doğrudan indirme engellenir.
  Google Drive kullanılmaz (görüntüleme kotası, kolay indirme/paylaşım).

## R2 "Drive" (8.9-N1 ile birleşik)

- Akademi videoları + görseller (avatar, logo, ilan kapağı, sohbet ekleri) Cloudflare R2'ye taşınır; görseller yüklemede
  küçültülür (ör. WebP, en fazla 1080 px). Gizli dosyalar imzalı bağlantıyla. Supabase Storage trafik sınırı aşılmaz.
- Vergi belgeleri kural 1 gereği kendi altyapımızda kalır (R2 de bizim depomuz; üçüncü taraf işleme yok).

## InfluAct (ileride)

- Influmatch "buluşturma platformu"; InfluAct "parayı verin, sürecinizi biz yönetelim" yönetilen hizmet (ajanslardan farklı).
- Elit Influmatch üyeleri alınır, özellikle Akademi mezunları. Seçim verisi: Akademi mezuniyeti/sınav puanı, tamamlanan iş
  birlikleri, (yayından sonra gelecek) 5 Yıldız puanları. Acelesi yok.
