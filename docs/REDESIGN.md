# Influmatch yeni görünüm — çizelge (2026-10-13, kullanıcıyla belirlendi)

> Tasarım OpenDesign'da hazırlanır, onaydan sonra koda geçer. Kararlar kullanıcıya ait; değişirse burayı güncelle.

## Kararlar

| Konu | Karar |
|---|---|
| Kapsam | Tanıtım sayfaları + kullanıcı paneli + admin paneli. Mobil uygulama ayrı yürür (aşağıda "Mobil uygulama"). |
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

## OpenDesign projesi

- Proje: **Influmatch Yeni Görünüm** (`influmatch-yeni-gorunum`, OpenDesign yerel çalışma alanı). Kopyası repoda `design/redesign/` (tarayıcıda `tasarim-sistemi.html` ile aç).
- Dosyalar: `styles.css` (tokenlar + bileşenler, koda taşınacak kaynak), `shell.js` (rol bazlı menü/kabuk), `tasarim-sistemi.html`
  (giriş + bileşen vitrini + tüm ekranlara bağlantı). Ekranlar: tanıtım ana sayfa, giriş/kayıt; influencer ana sayfa, ilanlar, mesajlar,
  ayarlar; marka ana sayfa, keşfet, profil (panel içinde), ilanlar (başvuru değerlendirme), işler; admin marka onayları.
  Hepsi masaüstü ve telefon (375 px) boyutunda tarayıcıda kontrol edildi (2026-10-13).
- Ekranlarda yalnızca var olan özellikler gösterilir: geçiş anahtarıyla giriş (kodda yok) çıkarıldı; admin kontrol satırları
  `lib/tax-certificate-match.ts` etiketleriyle aynı.
- Kayıt: rol seçimi formun içinde (ayrı `/signup-role` sayfası kalkar).
- Yazı tipi (2026-10-13, kullanıcı serbest bıraktı): başlıklar **Instrument Serif**, arayüz **Geist** (ikisi de `next/font/google`'da var).
- Altın buton kuralı: ana eylem; sayfa başlığında en fazla bir, listelerde satırın kendi ana eylemi.
- Ana sayfa önerisi: "Doğru influencer'ı bul. Aracısız çalış." + "Ücretsiz başla". "Komisyonsuz anlaşma" satırı mevcut sitedeki
  "komisyon yok" iddiasından alındı; kullanıcı 2026-10-13'te onayladı ("Komisyonsuz kalsın").

## Aşamalar

0. ✅ **OpenDesign** (2026-10-13, kullanıcı yönü onayladı): tasarım sistemi + ana ekranlar (ana sayfa, giriş/kayıt, iki rol ana sayfası, İşler, keşif, profil, mesajlar, ayarlar, bir admin ekranı). Kullanıcı onayı.
1. ✅ **Temel** (2026-10-13): Tailwind tokenları + `components/ui/*` ortak bileşenler.
   - Tokenlar `tailwind.config.ts`: `bg-surface-1/2/3`, `border-line` / `border-line-strong`, `text-ink` / `text-ink-muted` / `text-ink-faint`,
     `bg-gold` / `hover:bg-gold-hover` / `text-gold-ink`, `success` / `warning` / `danger` / `info`, `font-display`. Köşeler Tailwind'in
     `rounded-lg` (8) / `rounded-xl` (12) / `rounded-2xl` (16) değerleri. Eski adlar (`soft-gold`, `background`, `shadow-glow`) taşınma bitene kadar duruyor.
   - Yazı: arayüz Geist (`geist` paketi 1.5.1, next/font/local; Next 14.2'nin Google listesinde yok), başlık Instrument Serif. Geist'ta `₺` yok,
     sistem fontundan gelir.
   - Bileşenler (`@/components/ui`): `Button`, `ButtonLink`, `Card` + `CardHeader` + `CardBody` + `ListRow`, `Chip`, `Field` + `Input` / `Select` /
     `Textarea` (Field istemci bileşeni, render-prop), `Notice`, `Tabs`, `Segmented`, `Avatar`, `PageHeader`, `Eyebrow`, `StatCard`, `EmptyState`,
     `Progress`, `VerifiedTick`, `Modal`, `ConfirmDialog`, `Switch`. `DeleteConfirmationModal` artık `ConfirmDialog` kullanıyor (API aynı).
   - Modal: portal, Esc, dışarı tıklama, odak tuzağı, kaydırma kilidi, kapanınca odak geri döner; geri alınamaz onayda odak "Vazgeç"te.
     Yerel önizlemede elle denendi.
   - Kural: taşınan/yeni sayfada elle renk (`bg-[#...]`), elle köşe ve emoji ikon yazılmaz; yalnızca bu bileşenler ve tokenlar.
2. ✅ **Kabuk** (2026-10-13): `components/shell/AppShell.tsx` (kenar çubuğu, üst çubuk, mobil alt sekme çubuğu + "Menü" çekmecesi),
   menü tanımı `components/shell/nav-config.ts` (rol bazlı, gruplu), kullanıcı bilgisi `lib/shell-user.ts`.
   - Tek bildirim alanı `components/shell/ShellNotices.tsx`: e-posta doğrulama → sosyal hesap eksik → onay bekleniyor; en önemlisi görünür,
     diğerleri "+N bildirim". MVP notu kenar çubuğunun altında (bildirim alanını meşgul etmesin diye).
   - Profil (`/profile/*`) `app/profile/layout.tsx` ile panel kabuğunda açılıyor; giriş zorunluluğu aynı.
   - Spotlight menüsü doğrudan rolün paket sayfasına gider; `/dashboard/spotlight` influencer/markayı yönlendirir, admin iki paketi görür.
   - Menü şimdilik mevcut sayfalara gider: Teklifler ve İş Birlikleri ayrı (3. aşamada "İşler"), Rozetler menüde (3. aşamada profile).
     Marka menüsüne Favoriler eklendi (önceden menüde yoktu); `/dashboard/brand/ai` Keşfet altında etkin görünür.
   - Kaldırılan eski dosyalar: DashboardSidebar, DashboardHeader, SidebarLink, SettingsButton, EmailVerificationBanner,
     IncompleteProfileBanner, MVPBanner, PageTransition. Arama kutusu eklenmedi (arkasında çalışan arama yok).
   - Panel sayfaları giriş gerektirdiği ve yerel sunucu canlı veritabanına bağlı olduğu için kabuk, sahte kullanıcılı geçici bir
     yerel sayfada (commit edilmedi) masaüstü ve 375 px'te denendi.
3. **Panel sayfaları** (rol rol), İşler birleşmesi, terim temizliği, ölü arayüz temizliği.
   - ✅ **İşler** (2026-10-14): `/dashboard/works` (`app/dashboard/works/page.tsx` veri, `components/dashboard/WorksView.tsx` görünüm,
     `lib/works.ts` teklif yükleme + sayılar). Aşama kartları Teklif → Anlaşıldı → İçerik → Yayında → Tamamlandı (`?stage=`).
     Teklif aşamasında influencer `OffersManager`, marka `BrandOffersList`; diğer aşamalarda `CollaborationsManager` (`stage` prop).
     Üçü yeni bileşenlere geçti; `confirm`/`alert` yerine onay penceresi ve toast; teklif reddi artık onay istiyor; iş iptali pencerede.
     Eski adresler (`/dashboard/offers`, `/dashboard/brand/offers`, `/dashboard/influencer/offers`, `/dashboard/collaborations`) İşler'e
     yönlenir (gönderilmiş e-posta/bildirim bağlantıları bozulmaz); yeni bildirimler `/dashboard/works?stage=offers`'a gider.
     İş detayı `/dashboard/collaborations/[id]` yerinde (görünümü sonraki adımda). Marka kilidi İşler'de ayrıca uygulanır.
     Menüde Teklifler + İş Birlikleri yerine tek "İşler". Sahte veriyle yerel önizlemede masaüstü/375 px denendi.
4. **Tanıtım sayfaları** + giriş/kayıt/onboarding.
5. **Admin paneli.**

Her aşama mevcut akışla: dal → PR → Vercel önizlemesi READY → birleştir.

## Mobil uygulama (2026-10-13, kullanıcıyla belirlendi)

| Konu | Karar |
|---|---|
| Görünüm | Web ile **aynı** tasarım sistemi (yukarıdaki tokenlar, Instrument Serif + Geist, Lucide); mobil kalıplara uyarlanır (dokunma hedefi ≥44px, bottom sheet). |
| Gezinme | Web menüsüne göre. Influencer alt sekmeleri: Ana Sayfa · İşler · İlanlar · Mesajlar · Profil. Marka: Ana Sayfa · Keşfet · İlanlar · İşler · Mesajlar (profil/ayarlar üst sağdaki avatardan). İstatistikler, Spotlight, Ayarlar, Rozetler profilin içinde. |
| İlk tur | Giriş/kayıt/onboarding, influencer ana ekranları, marka ana ekranları, ortak ekranlar (mesajlar, iş birliği detayı, bildirimler, ayarlar) — hepsi. |
| Simülatör | `cd mobile-app; npm.cmd run simulator` → tarayıcıda telefon görünümü (`docs/SETUP.md`). |

- OpenDesign projesi: **Influmatch Mobil** (`influmatch-mobil`). Web tokenları `referans/web-tokens.css` olarak içinde.
  Dosyalar: `index.html` (mobil bileşen vitrini), `giris.html`, `influencer.html`, `marka.html`, `ortak.html`,
  `mobil.css` (mobil kalıplar), `mobil.js` (durum ve sekme çubukları). Kopyası repoda `design/mobile/` (tarayıcıda `index.html`).
- Kullanıcı onayı bekleyen metin/iş kararları tasarımda not olarak işaretli: giriş başlığı ("aracısız"), Spotlight fiyat ve içeriği.
- Açık soru: influencer'ın web'deki "Keşfet" (vitrin) sayfası mobilde 5 sekmeye sığmıyor; şimdilik sekme değil.

