# Influmatch yeni görünüm — çizelge (2026-10-13, kullanıcıyla belirlendi)

> Tasarım OpenDesign'da hazırlanır, onaydan sonra koda geçer. Kararlar kullanıcıya ait; değişirse burayı güncelle.

## Kararlar

| Konu | Karar |
|---|---|
| Kapsam | Tanıtım sayfaları + kullanıcı paneli + admin paneli. Mobil uygulama bu turda yok. |
| Hava | **Sakin premium**: aynı renkler (koyu zemin + soft gold + champagne). Düz yüzeyler; altın yalnızca ana eylem ve vurguda. Glow, blur ve radial gradient neredeyse yok. |
| İş akışı | **Teklifler + İş Birlikleri tek sayfa** (teklif → anlaşıldı → içerik → yayın → tamamlandı/iptal). Mesajlar ayrı sayfa olarak kalır. |
| Influencer "Vitrin" | **"Keşfet"** adıyla kalır. "Vitrin" sözcüğü yalnızca Spotlight/görünürlük için kullanılır. |
| Terim | **İlan.** Brief / Proje / Kampanya arayüzden kalkar (koddaki `Project` adları ayrı iş). |
| Influencer ana sayfa | Doluluk %, İlk adımlar, Güven skoru, Mavi tik ve eksik profil bandı **tek "Hesap durumu" kartında** toplanır; kart sıradaki tek adımı gösterir. |
| Bantlar | Panelin üstündeki 4 bant **tek bildirim alanı** olur (öncelik sırasıyla). MVP bandı kalır, bu alanın içine girer. |
| Rozetler | Menüden çıkar, profil sayfasında sekme olur. |
| Profil | Giriş yapmış kullanıcı için `/profile/*` panel kabuğunun içinde açılır (giriş zorunluluğu aynen, kural 2). |
| Ana sayfa başlığı | "Ücretsiz" iddiası yerine "ücretsiz başla" yaklaşımı; kesin metin kullanıcı onayıyla (kural 7). |

## Tespit edilen sorunlar (analiz özeti)

- Ortak tasarım sistemi yok: 3 tanımlı renk, 20+ elle yazılmış koyu ton, 15 Tailwind renk ailesi; 32 altın butonda 27 farklı class;
  12 ayrı modal; rastgele köşe değerleri; lucide + 29 elle SVG + emoji karışık.
- Influencer ana sayfasında doğrulanmış kullanıcıya Instagram/TikTok bağlama kartları (panel zaten doğrulanmayanı almıyor).
- Ölü arayüz: influencer keşif sayfasındaki "Vitrinde görünmüyorsun" uyarısı hiç görünemez.
- Rota tutarsızlığı: influencer teklifleri `/dashboard/offers`, marka `/dashboard/brand/offers`; Spotlight seçim sayfası rol bilinirken iki paketi gösterip birini kilitliyor.
- `/dashboard/brand/ai` menüde yok, ayrı mavi tema; marka favorileri menüde yok.
- Kullanıcı adı hem kenar çubuğunda hem başlıkta; menü 10 düz madde, mobilde 10 kayan hap.
- Ayarlar sekmeleri emoji ikonlu; "💬 Markayla görüş" butonu emoji ile.

## Yeni menü (öneri, OpenDesign'da kesinleşir)

**Influencer:** Ana Sayfa · İşler (teklif + iş birliği) · Mesajlar · İlanlar · Keşfet · İstatistikler · Profilim (Rozetler sekmesi)
— altta: Spotlight · Ayarlar · Çıkış

**Marka:** Ana Sayfa · Keşfet (sekmeler: Tümü / Önerilenler / Favoriler ve Listeler) · İlanlar · İşler · Mesajlar · Profilim
— altta: Spotlight · Ayarlar · Çıkış

**Admin:** mevcut bölümler, yeni bileşenlerle; `AdminPanel.tsx` (100 KB) parçalara ayrılır.

Spotlight menüsü doğrudan kullanıcının rolüne ait paket sayfasını açar (ara seçim sayfası kalkar).

## Tasarım sistemi taslağı (OpenDesign'da kesinleşir)

- Zemin `#0C0D10`; yüzey 1 / 2 (iki ton, elle yazılmış koyu tonların hepsinin yerine); kenarlık `white/8`.
- Metin: birincil, ikincil, sönük (üç ton). Vurgu: soft gold `#D4AF37` (+ hover tonu), champagne `#F7E7CE` yumuşak vurgu.
- Durum renkleri yalnızca anlam için: başarı, uyarı, hata, bilgi. Platform renkleri (TikTok, Instagram) yalnızca platform ikonlarında.
- Köşe: 8 / 12 / 16 + tam yuvarlak. Gölge: tek, hafif. İkon: yalnızca lucide.
- Ortak bileşenler: Button, Card, Badge/Chip, Input/Select/Textarea, Modal, Tabs, PageHeader, EmptyState, Notice (bant), StatCard, Avatar, Table.

## Aşamalar

0. **OpenDesign:** tasarım sistemi + ana ekranlar (ana sayfa, giriş/kayıt, iki rol ana sayfası, İşler, keşif, profil, mesajlar, ayarlar, bir admin ekranı). Kullanıcı onayı.
1. **Temel:** Tailwind tokenları + `components/ui/*` ortak bileşenler.
2. **Kabuk:** kenar çubuğu, üst çubuk, mobil gezinme, tek bildirim alanı; profil panel içinde.
3. **Panel sayfaları** (rol rol), İşler birleşmesi, terim temizliği, ölü arayüz temizliği.
4. **Tanıtım sayfaları** + giriş/kayıt/onboarding.
5. **Admin paneli.**

Her aşama mevcut akışla: dal → PR → Vercel önizlemesi READY → birleştir.
