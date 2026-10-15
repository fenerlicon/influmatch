# Influmatch yeni görünüm — çizelge (2026-10-13, kullanıcıyla belirlendi)

> Tasarım OpenDesign'da hazırlanır, onaydan sonra koda geçer. Kararlar kullanıcıya ait; değişirse burayı güncelle.

## Paralel oturumlar: önce burayı oku (2026-10-14)

Arda bu işi aynı anda birden fazla Claude oturumunda (ve farklı hesaplarda) yürütüyor. Çizelgenin **tek kaynağı bu dosya** (`main`'deki hâli).
Yeni hesapta / yeni oturumda iş buradan devam eder; kullanıcıya "nerede kaldık" diye sorma.

1. **Başlamadan kilitle:** bir alana ya da sayfaya başlamadan önce aşağıdaki tabloda o satırı "🔒 sürüyor (dal adı)" yap ve bunu küçük bir
   PR ile hemen `main`'e birleştir. Tabloda başka oturumun kilitlediği işe girme; boşta olan bir işi almak istersen önce kilitle.
2. **Bitirince yaz:** iş birleşince "Aşamalar" listesine ayrıntıyı (dosyalar, kararlar, bilinçli eksikler) ekle, tablodaki "Sıradaki" sütununu güncelle.
   Bulgular `docs/SYSTEM_MAP.md`'ye; ürün/metin kararları kullanıcıya sorulur ve "Kararlar"a yazılır.
3. **Kendi alanında kal:** her oturum yalnızca tablodaki kendi dosyalarına dokunur. Ortak dosya (`components/ui/*`, `components/shell/*`,
   `tailwind.config.ts`, `lib/*`, `app/api/mobile/*`, `app/layout.tsx`) değişecekse yalnızca **ekleme** yap (mevcut API'yi bozma), PR açıklamasına
   "ortak dosya" yaz. Başka alanın bileşenini yeniden yazma; gerekirse tabloya not düş.
4. **Dal ve klasör:** her işe `git fetch` + güncel `origin/main`'den yeni dalla başla. Dal önekleri: web panel `claude/redesign-phase3-*`,
   tanıtım `claude/redesign-phase4-*`, admin `claude/redesign-admin*`, mobil `claude/mobile-*`. Ana klon `C:\projeler\influmatch`; iki oturum aynı
   klasörde çalışmaz. Web panel oturumu `C:\projeler\influmatch-web` worktree'sini kullanıyor; yeni oturum kendi worktree'sini açar
   (`git worktree add ../influmatch-<alan> -b <dal> origin/main`).
5. **Birleştirme:** dal → PR → kontroller (Vercel READY) → birleştir. Çakışma olursa `main`'i dala alıp yalnızca kendi alanındaki çakışmayı çöz;
   başka alanın dosyasında çakışma varsa o tarafın değişikliğini koru.

| Alan | Dosyalar | Durum | Sıradaki |
|---|---|---|---|
| **Web panel** (3. aşama) | `app/dashboard/**`, `app/profile/**`, `app/spotlight/**`, `app/badges/**`; `components/{adverts,discover,messages,dashboard,profile,settings,badges,spotlight,showcase,brand,influencer}/**` | 🔒 devralındı (2026-10-15; `claude/redesign-phase3-*`, `C:\projeler\influmatch-admin`). Bitti: İşler, ana sayfalar, İlanlar, Keşfet, Mesajlar, Profil (sayfa + düzenleme), Rozetler | Ayarlar → iş birliği detayı (`/dashboard/collaborations/[id]`) → İstatistikler (`InfluencerStats` dahil) → Spotlight sayfaları → terim ve ölü arayüz temizliği |
| **Admin** (5. aşama) | `app/admin/**`, `components/admin/**` | ✅ kabuk, destek/sistem panelleri, kullanıcılar, içerik (`/admin/adverts`, `/admin/notifications`) | Kalan yok. |
| **Tanıtım + giriş** (4. aşama) | `app/page.tsx`, `app/{login,signup,signup-role,forgot-password,onboarding,legal,feedback}/**`, `components/{landing,onboarding,consent}/**` | ✅ bitti (2026-10-15): ana sayfa, giriş/kayıt/şifre, onboarding, yasal, geri bildirim, çerez bandı | Kalan yok (Instagram/TikTok bağlama kutuları web panel Profil işiyle). |
| **Mobil** | `mobile-app/**`, `design/mobile/**` | ✅ yeni görünüm bitti (#68–#77). Mobil özellik işleri ayrı oturumlarda (`claude/open-*`) | Aşağıdaki "Mobil uygulama" bölümü |

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
   - ✅ **İşler** (2026-10-14, PR #71): `/dashboard/works` (`app/dashboard/works/page.tsx` veri, `components/dashboard/WorksView.tsx` görünüm,
     `lib/works.ts` teklif yükleme + sayılar). Aşama kartları Teklif → Anlaşıldı → İçerik → Yayında → Tamamlandı (`?stage=`).
     Teklif aşamasında influencer `OffersManager`, marka `BrandOffersList`; diğer aşamalarda `CollaborationsManager` (`stage` prop).
     Üçü yeni bileşenlere geçti; `confirm`/`alert` yerine onay penceresi ve toast; teklif reddi artık onay istiyor; iş iptali pencerede.
     Eski adresler (`/dashboard/offers`, `/dashboard/brand/offers`, `/dashboard/influencer/offers`, `/dashboard/collaborations`) İşler'e
     yönlenir (gönderilmiş e-posta/bildirim bağlantıları bozulmaz); yeni bildirimler `/dashboard/works?stage=offers`'a gider.
     İş detayı `/dashboard/collaborations/[id]` yerinde (görünümü sonraki adımda). Marka kilidi İşler'de ayrıca uygulanır.
     Menüde Teklifler + İş Birlikleri yerine tek "İşler". Sahte veriyle yerel önizlemede masaüstü/375 px denendi.
   - ✅ **Ana sayfalar** (2026-10-14, PR #73): influencer ve marka ana sayfası yeniden yazıldı. Ortak `components/dashboard/AccountStatusCard.tsx`
     ("Hesap durumu": ilk adımlar + sıradaki adım + güven skoru + mavi tik koşulları penceresi + vitrin anahtarı; isteğe bağlı adım yüzdeye
     katılmaz). Influencer: bekleyen teklifler (satırdan yanıt), süren işler, yeni ilanlar (kategori eşleşmesi yok, 3.7-S5), Spotlight yoksa
     görüntülenme kartı Spotlight'a yönlendirir. Marka: "Senden bekleyenler" (yayın onayı, anlaşma özeti, yeni başvurular), öneriler (Spotlight),
     güvenilirlik. İstatistik grafikleri ana sayfadan çıktı (İstatistikler sayfasında). Instagram/TikTok bağlama kartları profil düzenleme
     sayfasında "Bağlı hesaplar" (`#hesaplar`) bölümüne taşındı. Kullanılmayan 10 eski kart silindi (OfferActivityCard, ProfileCompletionCard,
     TrustScoreCard, BlueTickProgressCard, FirstStepsCard, ProfileViewsCard, SpotlightToggleCard, VerificationWarningCard, BrandPipelineCard,
     BrandVerificationCard); "İlk adımları gizle" çerezi kalktı (kart tamamlanınca kendiliğinden kısalır).
   - ✅ İlanlar (2026-10-14, PR #75): `components/adverts/*`. Influencer: liste + sağ panel (telefonda alttan pencere), başvuru formu panelde,
     sekmeler `?tab=open|saved|applications|alerts`. Marka: ilan kartları + seçili ilanın başvuruları (Yeni / Ön liste / Değerlendirilen),
     "Kabul et" ve "Ön liste" web'e eklendi; ilan formu pencerede (`?new=1` doğrudan açar), diğer markaların ilanları ayrı sekmede.
   - ✅ Keşfet (2026-10-14, PR #78): `components/discover/*`. Marka Keşfet sekmeleri Tümü (`/brand/discover`) · Önerilenler (`/brand/ai`, Spotlight
     değilse açıklama, yönlendirme yok) · Favoriler ve Listeler (`/brand/favorites`); menüdeki ayrı "Favoriler" maddesi kalktı. Yeni profil
     kartı (takipçi / etkileşim / tamamlanan, başlangıç fiyatı, Profil + Teklif); "Teklif" profili teklif penceresi açık getirir (`?teklif=1`).
     Uyum puanı yalnızca Önerilenler'de. Güven skoru çubuk yerine kartın alt bilgi satırında ("Güven 82/100", yalnızca marka). Influencer Keşfet aynı kartla;
     ölü "Vitrinde görünmüyorsun" uyarısı kaldırıldı. Telefonda filtreler "Filtreler" düğmesinin arkasında.
   - ✅ Mesajlar (2026-10-14, PR #80): `components/messages/*`. Liste (arama, Tümü / Okunmamış / Süren işler) + sohbet; her sohbetin üstünde
     bağlı olduğu iş satırı (iş birliği > teklif > ilan başvurusu, `lib/conversation-jobs.ts`) ve "İşe git". Mesajlar günlere ayrılmış;
     rapor / engelle ve profil penceresi ortak Modal ile, tarayıcı `alert` / `confirm` kalktı. Aynı kişiyle olan odalar yine tek sohbet.
     Telefonda liste ve sohbet ayrı ekran (geri düğmesi). Tasarımdaki sistem satırları ("Teklif kabul edildi") veride olmadığı için eklenmedi.
   - ✅ Profil sayfası (2026-10-15): `app/profile/[username]/page.tsx` tasarımdaki düzen: başlık kartı (avatar, rol/kategori/Spotlight çipleri,
     ad + tik, @kullanıcı adı · şehir · tamamlanan iş / marka güvenilirliği, müsaitlik, bio, "Teklif gönder"), sekmeler `?tab=` Genel bakış ·
     İstatistikler · Rozetler · İş geçmişi (içeriği olan sekmeler görünür), sağda fiyat kartı, güvenilirlik, hesap bağlantıları. Erişim kuralları,
     görüntülenme kaydı ve sorgular aynı. `OfferModal` ortak Modal'a geçti (şablon, son teklifi kopyala, kampanya, kota/dolu uyarısı aynı;
     alan adları "Teklif başlığı", "İçerik türü"). `RateCardView`, `PortfolioResults`, `BadgeDetailList` yeni bileşenlerde.
     İstatistikler sekmesindeki `InfluencerStats` henüz eski görünümde (İstatistikler işiyle).
   - ✅ Profil düzenleme (2026-10-15, #100, #101): influencer (`ProfileForm`, `RateCardForm`, `BadgeSelector`, Instagram/TikTok bağlama kutuları;
     çalışmayan "Meta API / OAuth ile bağla (Çok Yakında)" düğmeleri kalktı; `updateProfile` hatayı mesaj olarak döndürüyor) ve marka
     (`BrandProfileForm` dört kart, kurumsal e-posta, vergi levhası; "daha çok tercih edilir" iddiası kalktı).
   - ✅ Rozetler (2026-10-15): menüden çıktı ("Profilim" rozet sayfasında etkin). `/dashboard/*/badges` ortak `BadgesOverview`
     (rozet durumun + `BadgeCatalog`); herkese açık `/badges` de `BadgeCatalog` ile. Bağlantılar: profil düzenleme başlığı ve kendi profilinin
     Rozetler sekmesi. Eski `BadgeCard` / `BadgeToggle` silindi; "her rozet ayrıcalık kazandırır" iddiası kalktı.
   - Kalanlar ve sıra: yukarıdaki "Paralel oturumlar" tablosunda (Web panel satırı).
4. **Tanıtım sayfaları** + giriş/kayıt/onboarding. ✅ Bitti (2026-10-15).
   - ✅ Ana sayfa (2026-10-14): `app/page.tsx` + `components/landing/{LandingHeader,LandingFooter,HowItWorks,Faq,FeaturedProfiles}`.
     Başlık kararı (kullanıcı, 2026-10-14): "Doğru influencer'ı bul. Aracısız çalış." + üstteki etikette "Instagram ve TikTok için
     influencer ve UGC bulma platformu"; sayfa `<title>`/açıklama (SEO) aynı. Bölümler: hero + ürün önizlemesi, Nasıl çalışır
     (marka/üretici), Doğrulama, öne çıkan profiller (canlı Spotlight verisi; yoksa gizli), Spotlight (maddeler `lib/spotlight-plans.ts`'ten),
     S.S.S., son çağrı. S.S.S.: TikTok "yakında" ve Spotlight maddeleri koddaki gerçeğe göre düzeltildi; "kampanya" → "ilan".
     Kayıt bağlantıları `/signup` (rol formda). Eski 10 tanıtım bileşeni silindi.
   - ✅ Giriş / kayıt / şifre (2026-10-14): ortak `components/auth/AuthShell.tsx` (solda tanıtım paneli, sağda form) +
     `PasswordInput`. Kayıtta hesap türü formun içinde: Marka · Influencer · UGC (UGC = influencer rolü, `creator_type: 'ugc'`;
     onboarding ön seçili getirir). `/signup-role` → `/signup`'a yönlenir (rol ve creator_type korunur). Şifre tekrarı kayıttan kalktı
     (göster/gizle var), yeni şifre ekranında duruyor. Koşullar için açık onay kutusu kaldı (tasarımdaki örtük kabul uygulanmadı).
     Kod ekranında aynı anda iki doğrulama isteği gitmesi engellendi.
   - ✅ Onboarding (2026-10-14): `components/onboarding/OnboardingShell.tsx` (logo, adım çubuğu: Profil → Hesap doğrulama; marka tek adım).
     Profil formu (influencer/marka), fotoğraf yükleyici ve hesap doğrulama adımı yeni bileşenlerde; form mantığı, taslak saklama ve
     kayıt aynı. Açık iş: `components/dashboard/InstagramConnect` / `TikTokConnect` hâlâ eski görünümde (profil "Bağlı hesaplar"da da
     kullanılıyor; profil sayfasıyla birlikte taşınacak).
   - ✅ Yasal, geri bildirim, çerez bandı (2026-10-14): `/legal` ve `/feedback` (+ teşekkür) tanıtım üst çubuğuyla, sekmeler/kart yeni
     bileşenlerde; yasal metinlerin ve çerez bandı metninin **içeriğine dokunulmadı** (yalnızca renk sınıfları tokenlara çevrildi).
     Kullanıcı kararı (2026-10-15, CLAUDE.md): komisyon yok, ödeme taraflar arasında, platform yalnızca bir araya getirir ve süreçlerden /
     içeriklerden sorumlu değildir. Kullanıcı Sözleşmesi md. 4–5 ve S.S.S. ödeme cevabı buna göre güncellendi; Gizlilik metnindeki ödeme
     hizmeti satırları avukat metniyle düzelecek.
5. **Admin paneli.**
   - ✅ Kabuk ve alt paneller (2026-10-14): `app/admin/layout.tsx` admin sayfalarını `AppShell`'de açar; menü (`nav-config` ADMIN):
     Kullanıcılar · Destek (talepler, geri bildirimler, raporlanan mesajlar, mesajlar) · Sistem (marka sınırları, API anahtarları,
     manuel Instagram bağlama). Ana paneldeki kısayol düğmeleri kalktı. Destek talepleri (liste + ayrıntı), geri bildirimler,
     raporlanan mesajlar, marka sınırları, API anahtarları + Resend kartı, manuel bağlama yeni bileşenlerde; `alert`/`confirm`
     yerine toast ve onay penceresi; destek panelinde başarısız kayıt artık hata gösteriyor.
   - ✅ Kullanıcılar (2026-10-14): `components/admin/AdminPanel.tsx` (durum, gerçek zamanlı güncelleme, toplu işlemler) +
     `components/admin/users/UserDetail.tsx` (sağdaki inceleme paneli) + `users/types.ts`. Sekmeler: Bekleyen · Onaylı influencer ·
     Onaylı marka · Reddedilen; arama her sekmede (ad, e-posta, kullanıcı adı, ID). Tablo + seçilince sağda inceleme (dar ekranda üstte).
     Bütün işlemler aynı sunucu eylemleriyle; `alert`/`confirm`/`prompt` yerine onay penceresi ve toast. Vergi levhası reddi satır içi notla.
     Ana paneldeki "İlanlar/Başvurular" ve "Bildirimler" sekmeleri kendi sayfalarına çıktı: `/admin/adverts`, `/admin/notifications`
     (menüde "İçerik"). Sonraki iş için "Paralel oturumlar" tablosuna bak.

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
- Karar (2026-10-14, kullanıcı): influencer'ın vitrini (web "Keşfet") sekme olmaz; Ana Sayfa "Hızlı erişim"de
  "Vitrine göz at" ve Profil'de "Vitrin" satırından açılır (`Vitrin` ekranı).
- Durum (2026-10-14): ✅ temel bileşenler (#68), giriş/kayıt (#69), influencer ekranları (#70, #72), marka ekranları (#74),
  ortak ekranlar (Mesajlar + sohbet, iş birliği detayı, Ayarlar, Geri bildirim; Bildirimler #72'de). Mesaj listesinde her sohbetin
  bağlı işi (Teklif / Başvuru / Aktif iş) ve okunmamış sayısı; Ayarlar'da web ile aynı e-posta tercihleri
  (`lib/email-preferences.ts`, `/api/mobile/email-preferences`). Sırada: oturumlu akışlar toplu testte.

