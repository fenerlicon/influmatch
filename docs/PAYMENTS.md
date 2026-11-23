# Ödemeler ve abonelik (2026-11-23)

> Sahip kararları (2026-11-23): ödeme sağlayıcısı **iyzico**; Spotlight planları (ibasic, ipro, mbasic, mpro) aylık / yıllık
> **otomatik yenilenen kartlı abonelik**. Şirket ve vergi levhası 1 Ocak'ta, iyzico üye işyeri başvurusu ondan sonra, satış Ocak ortası–sonu.
> Her şey şimdi **iyzico sandbox**'a karşı yazıldı; canlıya geçiş yalnızca ortam değişkeniyle. Mobilde **mağaza içi satın alma**
> (App Store + Google Play): ortak abonelik modeli ve sunucu doğrulaması hazır, uygulamadaki satın alma arayüzü kapalı bayrakla.
> Kurallar: kökteki `CLAUDE.md`. Harita: `docs/SYSTEM_MAP.md` 4.7. Yasal metin yazılmadı (avukattan gelecek).

## 1. Mimari (kısaca)

```
Web (Spotlight sayfası → /dashboard/billing/checkout) ──► iyzico ödeme formu (kart bilgisi yalnızca iyzico'da)
        │                                                        │
        │                       tarayıcı dönüşü (token) ◄────────┘
        ▼
/api/payments/iyzico/callback ──► iyzico API'den sonucu oku ──► subscriptions + payments ──► syncUserSpotlight ──► users.spotlight_*
/api/payments/iyzico/webhook  ──► (imza) + iyzico API'den yeniden oku ───────────┘
Saatlik görev (/api/cron/hourly → lib/payments/billing-jobs.ts) ── kaçan bildirimler, ek süre sonu, hatırlatmalar, 0₺ dağıtımı

Mobil (expo-iap, kapalı) ──► /api/mobile/billing/verify ──► Apple JWS / Google Play API ──► aynı subscriptions tablosu
App Store Server Notifications V2 ──► /api/payments/apple/notifications
Google Play RTDN (Pub/Sub push)   ──► /api/payments/google/rtdn
```

- **Tek kaynak:** Spotlight'ın açık olup olmadığı, hangi planda ve ne zamana kadar olduğu `subscriptions` tablosundaki bütün kayıtlardan
  **tek fonksiyonla** türetilir (`lib/payments/subscriptions.ts` `syncUserSpotlight`, kural `lib/payments/billing-shared.ts`
  `resolveEntitlement`). Kaynaklar: `iyzico`, `apple`, `google` (ücretli), `admin` (elle tanım), `promo` (0₺ dönemi), `reward` (görev ödülü).
  Pro > Basic, sonra en geç biten kazanır; rolüne uymayan plan sayılmaz; hesap doğrulanmamışsa Spotlight açılmaz.
  Hiç abonelik kaydı olmayan kullanıcıya dokunulmaz (eski elle açılmış üyelikler SQL ile `admin` kaydı olarak aktarılır).
- **Kullanıcı başına bir canlı ücretli abonelik** (web ya da mağaza): veritabanında benzersiz indeks (`uq_subscriptions_one_paid`).
  Web'de aboneliği olan mobilde "aktif aboneliğin var" görür, satın alma önerilmez; tersi de aynı.
- **Güven:** istemci tutar göndermez (fiyat sunucuda hesaplanır ve iyzico'daki planın fiyatıyla karşılaştırılır); tarayıcı dönüşündeki ve
  webhook'taki veriye güvenilmez, abonelik her seferinde iyzico API'sinden okunur; mağaza satın almasında ürün ve durum Apple'ın imzalı
  verisinden / Google Play API'sinden okunur, satın alma kullanıcıya iOS `appAccountToken` ve Android `obfuscatedAccountId` (= kullanıcı kimliği) ile bağlanır.
- **Kart verisi hiçbir zaman sunucumuza gelmez**, tabloda tutulmaz. `payment_events.payload` yalnızca referans kodlarını içerir.

### Dosyalar

| Dosya | İş |
|---|---|
| `lib/payments/billing-shared.ts` | Saf kurallar: fiyat / indirim hesabı, Spotlight hakkı, plan adları, mağaza ürün kimlikleri, hatırlatma zamanları (testli) |
| `lib/payments/iyzico.ts` | Bütün iyzico HTTP + IYZWSv2 imzası + webhook imzası (testli) |
| `lib/payments/iyzico-flow.ts` | Ödeme formu, sonuç, eşitleme, iptal, plan değişikliği, kart güncelleme, kod, admin iade |
| `lib/payments/subscriptions.ts` | Kayıtlar, ayarlar, `syncUserSpotlight`, ücretsiz tanımlar, kod ayırma, bildirim |
| `lib/payments/apple.ts`, `google.ts`, `store-flow.ts` | Mağaza doğrulaması ve ortak kayda yazım |
| `lib/payments/billing-jobs.ts` | Saatlik görev adımları, 0₺ dağıtımı |
| `lib/payments/invoice.ts` | e-Arşiv kancası (şimdilik boş) |
| `app/dashboard/billing/**`, `components/billing/**`, `components/settings/Billing*.tsx` | Web arayüzü |
| `app/admin/billing/**`, `components/admin/billing/**` | Admin |
| `app/api/payments/**`, `app/api/mobile/billing/**` | Uçlar |
| `scripts/iyzico-sync-plans.mjs` | iyzico ürün + fiyatlandırma planlarını oluşturur |
| `supabase/migrations/20261123000010_payments.sql`, `supabase/manual/2026-11-23_odeme.sql` | Şema (canlıya henüz uygulanmadı) |

## 2. Akışlar

**Abone olma (web).** Spotlight sayfasında "Abone ol" (aylık / yıllık) → `/dashboard/billing/checkout?plan=&interval=`. Sayfa yalnızca
satış bayrağı açık, iyzico anahtarları tanımlı, tablolar hazır, hesap doğrulanmış ve canlı ücretli abonelik yokken açılır. Fatura bilgileri
(ad, soyad, cep telefonu, şehir, adres, isteğe bağlı TCKN), indirim kodu ve üç zorunlu onay kutusu (Mesafeli Satış Sözleşmesi, Ön Bilgilendirme
Formu, Abonelik ve İptal Koşulları — `/legal` sekmeleri, metinler avukattan) → sunucu fiyatı hesaplar, `pending` kayıt açar, iyzico abonelik
ödeme formunu başlatır → kullanıcı kartı iyzico formunda girer → iyzico tarayıcıyı `/api/payments/iyzico/callback`'e gönderir → sonuç
iyzico'dan okunur → kayıt `active`, ilk tahsilat `payments`'a, Spotlight açılır, bildirim. Sekme kapanırsa saatlik görev iyzico'ya sorar
(ödenmişse açar, değilse kaydı düşürür).

**Yenileme.** iyzico her dönem kartı kendisi çeker. Başarılı tahsilat webhook'la (ve saatlik eşitlemeyle) gelir: dönem uzar, ödeme
geçmişine eklenir (bildirim yok). Ücretli abonelikte Spotlight bitişi **dönem sonu + 3 gün** yazılır ki bildirim gecikirse kesilmesin.

**Ödeme alınamadı.** Abonelik `past_due` olur, **3 gün ek süre** (`PAST_DUE_GRACE_DAYS`), kullanıcıya site içi + push + e-posta
"Ödeme alınamadı, kartını güncelle". Ayarlar'da "Kartı güncelle" iyzico kart güncelleme formunu açar; dönüşte son başarısız ödeme yeniden
denenir. Ek süre biterse abonelik iyzico'da iptal edilir, kayıt `expired`, Spotlight kapanır, bildirim.

**İptal.** Kullanıcı Ayarlar > Üyelik ve ödemeler'den (onay penceresiyle) iptal eder: iyzico'da abonelik hemen iptal (yeni tahsilat yok),
Spotlight **dönem sonuna kadar** açık (`cancel_at_period_end`), sonra saatlik görev kapatır. Ödemesi alınamamış abonelikte iptal hemen biter.

**Plan değişikliği.** Yalnızca aynı rolde (influencer: ibasic ↔ ipro, marka: mbasic ↔ mpro) ve aynı dönemde (iyzico kuralı: aynı ürün,
aynı ödeme aralığı). Yükseltme `NOW`, düşürme `NEXT_PERIOD`. Aylık ↔ yıllık geçiş: iptal edip dönem sonunda yeniden abone olmak.

**Yıllık yenileme hatırlatması.** Yenilemeden 7 gün önce bildirim (+ e-posta). Süreli üyelik (admin, 0₺, ödül, iptal edilmiş ücretli)
bitmeden 7 gün önce "üyeliğin bitiyor".

**İndirimler.**
- **İlk ay %50** (0₺ döneminde Spotlight Pro kullananlar; ROADMAP): yalnızca aylık planda, ilk ücretli abonelikte, bir kez. Hak: 0₺ dönemi
  Pro kaydı (`source = 'promo'`) var ve daha önce başlamış ücretli abonelik yok. İsteğe bağlı son gün: admin "İlk ay %50 son günü".
- **Görev kodu** (`IM-XXXXXXXX`, `task_rewards`, "Ödülleri hesaplara işle" sonrası kullanılabilir): kişiye özel, **tek kullanımlık**
  (ödeme başlarken kayda ayrılır, ödeme düşerse serbest kalır, tahsilattan sonra `used_at`).
- **Birleşmez, büyük olan geçer.** Aylıkta ilk ay %50 koddan büyükse ilk ayda o geçer, kod saklı kalır; kullanıcı aktif aboneliğinde
  "Kodu kullan" ile **sonraki yenilemeye** (2. ay ve sonrası) uygular. Yıllık planda %50 yok, kod ilk yıla uygulanır.
- **Nasıl uygulanıyor (seçilen yol):** iyzico abonelik API'sinde kupon yok. Her plan / dönem için ayrı **indirimli fiyatlandırma planı**
  (`IM-ipro-mo-D50` gibi, aynı üründe) tanımlıdır. İlk dönem indirimli planla başlar; o dönemin tahsilatı görülünce abonelik
  `upgrade` (`NEXT_PERIOD`) ile normal plana döner. Koda sonraki yenilemede: abonelik `NEXT_PERIOD` ile indirimli plana geçer, o tahsilattan
  sonra yine normal plana döner. Böylece kart bir kez girilir, ayrı tek seferlik ödeme yok, her tahsilat iyzico'da kayıtlı. Hangi yüzdelerin
  planı olacağı sync betiğinde (`--discounts=20,50`, varsayılan); başka yüzdede kod verilirse betik o yüzdeyle yeniden çalıştırılmalı.

**0₺ kampanyası ve bitişi.** `/admin/tasks`'taki 0₺ dönemi anahtarı açıkken ve `/admin/billing`'de **0₺ Spotlight bitişi** (satış
başlangıcı) girilmişse, saatlik görev doğrulanmış her influencer / marka hesabına bitiş tarihine kadar **Spotlight Pro** (kayıt `promo`)
verir ("Şimdi dağıt" düğmesi de var). Tarih değişince bütün aktif 0₺ kayıtlarının bitişi güncellenir. Bitişten **7 gün önce** bildirim +
e-posta ("0₺ dönemindeki Spotlight üyeliğin … bitiyor"), bitişte Spotlight kapanır. Bu kayıtlar ilk ay %50 hakkının kanıtıdır.

**Admin elle tanım.** Kullanıcılar panelindeki "Spotlight aç / kapat" ve `/admin/billing` "Elle Spotlight tanımı" `admin` kaydı açar
(0 ay = süresiz). Kapatmak yalnızca ücretsiz kayıtları bitirir; ücretli abonelik sürer (mesajda yazar). Görev süre ödülleri `reward` kaydıdır.

**İade.** `/admin/billing` > Tahsilatlar > İade: "İade" (tutar girilebilir, `/v2/payment/refund`) ya da "İptal" (aynı gün, tamamı,
`/payment/cancel`), neden zorunlu, onaylı. Aboneliği de bitirmek için ayrıca "İptal et". Mağaza iadeleri mağaza panelinden yapılır.

## 3. Ortam değişkenleri (Vercel; değerler asla dosyaya / commit'e yazılmaz)

| Değişken | Zorunlu | Not |
|---|---|---|
| `IYZICO_API_KEY`, `IYZICO_SECRET_KEY` | satış için | iyzico panelinden. Önce sandbox anahtarları. Yoksa ödeme arayüzü kapalı kalır. |
| `IYZICO_BASE_URL` | hayır | Varsayılan `https://sandbox-api.iyzipay.com`. Canlı: `https://api.iyzipay.com`. Admin ekranı modu gösterir. |
| `IYZICO_MERCHANT_ID` | hayır | Webhook imzası (X-IYZ-SIGNATURE-V3) doğrulaması için üye işyeri numarası. Yoksa imza kontrol edilmez (yine de API'den yeniden okunur). |
| `PAYMENTS_CALLBACK_BASE_URL` | hayır | iyzico dönüş adresinin kökü. Boşsa `NEXT_PUBLIC_SITE_URL`. Önizlemede sandbox denemesi için korumasız bir adres. |
| `APPLE_ISSUER_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | mağaza için | App Store Connect > Users and Access > Integrations > In-App Purchase anahtarı (.p8 içeriği; satır sonları `\n` olabilir). |
| `APPLE_BUNDLE_ID` | hayır | Varsayılan `net.influmatch.app`. |
| `APPLE_ROOT_CA_SHA256` | hayır | Apple Root CA - G3 parmak izi koddaki sabitten farklıysa. |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | mağaza için | Play Console'a bağlı hizmet hesabının JSON anahtarı (tek satır). |
| `GOOGLE_PLAY_PACKAGE` | hayır | Varsayılan `net.influmatch.app`. |
| `GOOGLE_RTDN_SECRET` | mağaza için | Uzun rastgele değer; Pub/Sub push adresine `?token=` olarak eklenir. |

## 4. Sandbox'ta deneme (sahibin ya da toplu testin işi)

1. iyzico sandbox hesabı aç (sandbox-merchant.iyzipay.com), API anahtarlarını Vercel **Preview** (ya da yerel `.env.local`) ortamına ekle.
2. `IYZICO_API_KEY=… IYZICO_SECRET_KEY=… node scripts/iyzico-sync-plans.mjs --dry-run`, sonra `--dry-run` olmadan. Çıktıda iki ürün ve
   24 plan (4 plan × 2 dönem × [normal, %20, %50]) oluşmalı; "UYUŞMAZLIK" olmamalı.
3. SQL (`supabase/manual/2026-11-23_odeme.sql`) canlıda çalıştırılmış olmalı.
4. `/admin/billing` → iyzico "sandbox (test)" görünmeli → "Web satışı" aç (yalnızca test için; işin bitince kapat).
5. Doğrulanmış test hesabıyla Spotlight > Abone ol → **iyzico test kartları dokümandan** (docs.iyzico.com "Test kartları"; başarılı ve
   başarısız senaryolar için ayrı kartlar var).
6. Webhook için iyzico sandbox panelinde bildirim adresi `https://<adres>/api/payments/iyzico/webhook`. Önizleme adresleri Vercel korumalı
   olduğu için iyzico erişemeyebilir; o zaman webhook yerine saatlik görev / admin "Eşitle" çalışır.
7. Kontrol listesi: `docs/TOPLU_TEST.md` bölüm 7e.

## 5. Doğrulananlar / doğrulanmayanlar

| Konu | Durum |
|---|---|
| iyzico uç noktaları, istek alanları, IYZWSv2 imza biçimi, fiyat biçimi | Resmi Node SDK'sıyla (npm `iyzipay` 2.0.71) karşılaştırıldı; birim testli. **Gerçek istek atılmadı** (bu oturumdan iyzico'ya erişim yoktu). |
| GET isteklerinde imzaya giren gövde | Biz gövde göndermiyor ve imzaya boş dize katıyoruz; Node SDK GET'te `{}` gönderip onu imzalıyor. İlk sandbox isteğinde 401 olursa burası. |
| Abonelik yanıt alanları (`orders`, `startPeriod`, `paymentAttempts`, tarihlerin epoch ms olması) | Doküman özetinden; **sandbox'ta ilk ödemede kontrol edilecek** (`lib/payments/iyzico.ts` `parseSubscriptionDetail`). |
| Webhook imzası sırası (merchantId + secretKey + eventType + subscriptionRef + orderRef + customerRef) | Dokümandan teyit edilemedi. Yanlışsa bildirimler "imza geçersiz" diye işlenmez (admin ekranında görünür), saatlik eşitleme yine yakalar. `IYZICO_MERCHANT_ID` boşken imza kontrol edilmez. |
| `upgrade` `NOW` ile yükseltmede ücretlendirme, yükseltme sonrası yeni abonelik referansı | Doğrulanacak; kod iki durumu da karşılıyor (yeni referans varsa ona geçer, `UPGRADED` durumunda müşterinin yeni aboneliğini arar). |
| Canlıda TCKN | Kullanıcı vermezse `11111111111` gidiyor (sandbox kabul eder). Canlıda iyzico ne istiyor, e-Arşiv için gerekli mi: iyzico ve muhasebeciyle netleşecek. |
| Abonelik tahsilatının `/v2/payment/refund` ile iadesi | Doğrulanacak. |
| Apple JWS zinciri doğrulaması | Kendi ürettiğimiz test zinciriyle testli; Apple kök parmak izi ve OID'ler bilinen değerler, **gerçek Apple JWS'iyle denenmedi**. |
| App Store Server API, Google Play API, RTDN | Belgelenmiş uçlara göre yazıldı; hesap/ürün olmadığı için denenmedi. |
| SQL | Yerel Postgres 16'da (taslak tablolarla) iki kez çalıştırıldı: tekrar çalıştırılabilir, RLS açık, istemci yazması kapalı, tek abonelik kuralı çalışıyor. **Canlıya uygulanmadı.** |

## 6. Canlıya geçiş listesi (sahip)

1. **Şirket + vergi levhası** (1 Ocak) → **iyzico üye işyeri başvurusu.** Genelde istenenler (iyzico'dan teyit et): vergi levhası, imza
   sirküleri / beyannamesi, kimlik fotokopisi, faaliyet belgesi / ticaret sicil, IBAN (şirket adına), web sitesinde mesafeli satış sözleşmesi,
   ön bilgilendirme, iade/iptal, gizlilik metinleri ve iletişim bilgileri; abonelik ürünü (iyzico Abonelik) için ayrıca aktivasyon.
2. **Avukat metinleri** `/legal`'e yerleşir (`app/legal/page.tsx` "Avukat metni bekleniyor" sekmeleri): Mesafeli Satış Sözleşmesi,
   Ön Bilgilendirme Formu, Abonelik / otomatik yenileme / iptal koşulları; Gizlilik metninde ödeme işleyenleri (iyzico, Apple, Google; `docs/KVKK.md`).
   Cayma hakkı ve dijital içerik istisnası avukatın konusu; arayüze Claude metin yazmadı.
3. **Canlı anahtarlar** Vercel Production'a: `IYZICO_API_KEY`, `IYZICO_SECRET_KEY`, `IYZICO_BASE_URL=https://api.iyzipay.com`,
   `IYZICO_MERCHANT_ID`. (Preview'da sandbox kalabilir.)
4. `node scripts/iyzico-sync-plans.mjs` canlı anahtarlarla (önce `--dry-run`). Fiyat değişirse iyzico planı güncellenemez: eski planı iyzico
   panelinden pasifleştir, adı değiştir (ör. sonuna `-old`), betiği yeniden çalıştır; mevcut aboneler eski fiyatta kalır.
5. iyzico panelinde **bildirim (webhook) adresi**: `https://influmatch.net/api/payments/iyzico/webhook`; iyzico entegrasyon ekibinden
   webhook imzasını (V3) açtır.
6. **e-Arşiv fatura sağlayıcısı** (muhasebeci seçer, ör. Paraşüt): `lib/payments/invoice.ts` `issueInvoice` doldurulur; o zamana kadar
   ödemeler `invoice_status = pending` (admin görür).
7. `/admin/billing`: "0₺ Spotlight bitişi" = satış başlangıcı (7 gün önce hatırlatma gider), gerekirse "İlk ay %50 son günü".
   Satış günü: `/admin/tasks` "Ödülleri hesaplara işle", `/admin/limits` ücretsiz marka sınırları bayrağı, "Kampanya sihirbazı ve toplu davet"
   Marka Pro listesine (ROADMAP), son olarak `/admin/billing` **"Web satışı" aç**.
8. Sandbox'ta bölüm 4'ü bir kez baştan sona dene; canlıda küçük bir gerçek ödeme + iade ile kontrol et.

## 7. Mobil (App Store / Google Play)

Durum: sunucu tarafı hazır (`/api/mobile/billing/status`, `/api/mobile/billing/verify`, Apple / Google bildirim uçları); uygulamada
Spotlight ekranı sunucudaki hakkı gösteriyor, web aboneliği varsa "aktif aboneliğin var". **Satın alma kapalı:** `mobile-app/constants/iap.js`
`IAP_ENABLED = false`; yerel satın alma paketi eklenmedi çünkü Expo Go'da çalışmaz ve geliştirme derlemesi ister (uygulama bugün Expo Go'da
test ediliyor). Mağaza fiyatı web'den farklı olabilir (komisyon); fiyat mağazadan gelir, kodda yazılı değil.

Ürün kimlikleri (iki mağazada aynı; web `STORE_PRODUCT_IDS`, mobil `constants/iap.js`):
`net.influmatch.app.{ibasic|ipro|mbasic|mpro}.{monthly|yearly}`.

**App Store Connect (sahip):**
- Uygulama `net.influmatch.app`; Paid Apps sözleşmesi + banka / vergi bilgileri.
- Bir **abonelik grubu** (ör. "Spotlight"), içinde 8 otomatik yenilenen abonelik (yukarıdaki kimliklerle), fiyatlar, yerelleştirme, inceleme ekran görüntüsü.
  Influencer ve marka planları aynı grupta olabilir (rol kontrolü sunucuda); ayrı grup da olur.
- **App Store Server Notifications V2**: Production ve Sandbox adresi `https://influmatch.net/api/payments/apple/notifications`.
- **In-App Purchase anahtarı** (Users and Access > Integrations): Issuer ID, Key ID, .p8 → Vercel `APPLE_ISSUER_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`.
- Sandbox test kullanıcısı.

**Google Play Console (sahip):**
- Uygulama `net.influmatch.app`; ödeme profili.
- **Abonelikler**: 8 ürün (yukarıdaki kimlikler), her birinde bir temel plan (aylık ya da yıllık, otomatik yenilenen).
- **Hizmet hesabı**: Google Cloud'da hizmet hesabı + JSON anahtar; Play Console > Users and permissions'ta bu hesaba "View financial data"
  ve "Manage orders and subscriptions" yetkisi → Vercel `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`.
- **Gerçek zamanlı geliştirici bildirimleri**: Google Cloud Pub/Sub konu + **push** aboneliği, adres
  `https://influmatch.net/api/payments/google/rtdn?token=<GOOGLE_RTDN_SECRET>`; Play Console > Monetization setup'ta konu adı.
- Lisans test kullanıcıları.

**Uygulamada açma (Claude, hesaplar ve ürünler hazır olunca):** `npx expo install expo-iap`, app.json `plugins`'e `expo-iap`, EAS geliştirme
derlemesi, `mobile-app/lib/iap.js` ENTEGRASYON bloğu (iOS `appAccountToken` ve Android `obfuscatedAccountIdAndroid` = kullanıcı kimliği şart),
`IAP_ENABLED = true`, `/admin/billing` "Uygulama içi satın alma" açık. Apple ayrıca uygulamada "Satın alımları geri yükle" ister.

## 8. e-Arşiv

Yapılmadı (sağlayıcıyı muhasebeci seçecek). `payments.invoice_status` (`pending` / `issued` / `failed` / `not_applicable`) ve `invoice_ref`
hazır; her başarılı iyzico tahsilatından sonra `issueInvoice(payment)` çağrılıyor (şimdilik bir şey yapmıyor). Mağaza satışları
`not_applicable` yazılıyor (faturayı mağaza keser; muhasebeciyle teyit).
