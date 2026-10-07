# Influmatch Sistem Haritası

> Son güncelleme: 2026-10-07 · Dal: `claude/verification-and-api-key-pool`
>
> Bu belge kontrol‑düzelt sürecinin referansıdır. Her yapı numaralıdır (`3.7`), her sorun da
> yapının numarasıyla kimliklendirilir (`3.7-S2`). Bir düzeltme yapıldığında ilgili satırı
> `~~üstü çizili~~ ✅ (commit)` olarak işaretleyin; yeni bulgu eklerken o yapının son S numarasından devam edin.

## Nasıl okunur

| Etiket | Anlamı |
|---|---|
| **[KRİTİK]** | Güvenlik açığı, veri sızıntısı, para kaybı veya ana akışın tamamen bozuk olması |
| **[YÜKSEK]** | Kullanıcının gördüğü bir özellik çalışmıyor / yanlış çalışıyor |
| **[ORTA]** | Tutarsızlık, performans, yanlış bilgi gösterimi |
| **[DÜŞÜK]** | Temizlik, ölü kod, kozmetik |

Bulgular kodun statik okunmasından çıkarıldı; canlı veritabanı repodaki migration'lardan farklı olabilir
(bkz. 7.6). "Doğrulanmadı" notu olanlar canlıda kontrol edilmeli.

## İçindekiler

0. [Genel mimari](#0-genel-mimari)
1. [Hesap yaşam döngüsü](#1-hesap-yaşam-döngüsü)
2. [Influencer / UGC tarafı](#2-influencer--ugc-tarafı)
3. [Marka tarafı ve pazar yeri](#3-marka-tarafı-ve-pazar-yeri)
4. [Ortak: rozetler, Spotlight, profil](#4-ortak-rozetler-spotlight-profil)
5. [İletişim](#5-iletişim)
6. [Admin](#6-admin)
7. [Veri katmanı (Supabase)](#7-veri-katmanı-supabase)
8. [Altyapı ve entegrasyonlar](#8-altyapı-ve-entegrasyonlar)
9. [Landing ve SEO](#9-landing-ve-seo)
10. [Mobil uygulama](#10-mobil-uygulama)
11. [Ölü kod envanteri](#11-ölü-kod-envanteri)
12. [Öncelik sırası](#12-öncelik-sırası)
13. [Bu dalda tamamlananlar](#13-bu-dalda-tamamlananlar)

---

## 0. Genel mimari

- **Web:** Next.js 14.0.4 (app router, server actions), Tailwind. Vercel Hobby üzerinde.
- **Veri:** Supabase (Postgres + RLS + kolon bazlı yetki + trigger'lar, Auth, Storage, Realtime, pg_cron).
- **Mobil:** `mobile-app/` — Expo SDK 54 / React Native; Supabase'e doğrudan bağlanır.
- **Dış servisler:** Apify (Instagram/TikTok kazıma, anahtar havuzu), Resend (e-posta),
  Meta Graph ve TikTok OAuth. Vergi levhası yerelde işlenir (dış servis yok).
- **Roller:** `influencer` (alt tür `creator_type`: influencer / ugc / both), `brand`, `admin`.
  Yetkili kaynak `public.users.role`'dür; ancak birçok ekran hâlâ kullanıcının değiştirebildiği
  `auth.user_metadata.role` değerini okuyor (bkz. 1.8-S1).

**Temel veri akışı:** kayıt (metadata role) → `handle_new_auth_user` trigger'ı `users` satırını açar →
e-posta doğrulama → `saveOnboardingProfile` → influencer ise `/onboarding/verify` (bio kodu ile hesap
doğrulama) → dashboard layout kapıları → admin `verifyUser` ile `verification_status='verified'`
(markaların kilidi açılır).

---

## 1. Hesap yaşam döngüsü

### 1.1 Middleware (rota koruma)
- **Dosya:** `middleware.ts`
- **İş:** Her istekte oturum çerezini yeniler. Oturumsuz kullanıcıyı `/dashboard`, `/admin`,
  `/onboarding`, `/profile` için `/login`'e; oturumlu kullanıcıyı `/login`, `/signup`, `/signup-role`'dan `/dashboard`'a yollar.
- **Sorunlar:**
  - **1.1-S1 [YÜKSEK]** `/profile` korumalı; herkese açık `/profile/[username]` sayfaları anonim ziyaretçiyi ve
    arama motorlarını `/login`'e atıyor. Sitemap ve robots bu sayfaları ilan ediyor → SEO fiilen kırık (bkz. 9.2).
  - **1.1-S2 [ORTA]** Yalnızca oturum varlığı kontrol ediliyor, rol kontrolü yok; admin/marka/influencer ayrımı sayfalara kalmış.
  - ✅ ~~**1.1-S3 [DÜŞÜK]**~~ (giriş sonrası `redirectedFrom` yalnızca site içi yolsa kullanılıyor) `redirectedFrom` parametresi ekleniyor ama `app/login/page.tsx` okumuyor; giriş hep `/dashboard`'a gider.

### 1.2 Supabase istemcileri
- **Dosyalar:** `utils/supabase/server.ts`, `client.ts`, `admin.ts` (service role, anahtar yoksa `null`),
  `components/providers/AuthProvider.tsx`, `SupabaseProvider.tsx`
- **Sorunlar:**
  - **1.2-S1 [DÜŞÜK]** İki farklı tarayıcı istemci fabrikası; bazı bileşenler her render'da yeni istemci açıyor
    (`SidebarLink.tsx`, `NotificationsPopover.tsx`, `AdvertApplicationsList.tsx`) → ayrı realtime soketleri.
  - **1.2-S2 [DÜŞÜK]** Service‑role istemcisi farklı yollarla kuruluyor (`createClient(..., SERVICE_ROLE_KEY!)`:
    `app/admin/actions.ts`, `app/dashboard/brand/advert/actions.ts`).
  - ✅ ~~**1.2-S3 [DÜŞÜK]**~~ (ölü `[locale]` layout'u ve `SupabaseProvider` silindi) `SupabaseProvider` yalnızca ölü `app/[locale]/layout.tsx` tarafından kullanılıyor.
  - **1.2-S4 [ORTA]** `@supabase/auth-helpers-nextjs` 0.10 kullanımdan kalkmış paket; `@supabase/ssr`'a geçilmeli.

### 1.3 Kayıt (rol seçimi + form)
- **Dosyalar:** `app/signup-role/page.tsx`, `app/signup/page.tsx`, `hooks/useSupabaseAuth.ts`
- **İş:** Rol seçimi → `auth.signUp` (metadata: role, full_name, creator_type) → `/auth/check-email`.
  `handle_new_auth_user` trigger'ı `users.role`'ü güvenli değere zorlar.
- **Sorunlar:**
  - ✅ ~~**1.3-S1 [ORTA]**~~ (kayıt URL'sinde yalnızca brand/influencer kabul ediliyor; DB tarafı zaten güvenliydi) Rol URL'den geliyor; `/signup?role=admin` metadata'ya `admin` yazar. DB rolü influencer olur
    ama metadata'ya güvenen ekranlarda admin menüsü görünür (bkz. 1.8-S1).
  - ✅ ~~**1.3-S2 [DÜŞÜK]**~~ (hız sınırı artık hata mesajı; check-email'e yönlendirmiyor) Rate‑limit hatası başarı sayılıp check-email'e yönlendiriyor (`signup/page.tsx:91-99`).

### 1.4 Giriş ve şifre
- **Dosya:** `app/login/page.tsx`
- **Sorunlar:**
  - ✅ ~~**1.4-S1 [YÜKSEK]**~~ (web akışı eklendi ve canlıda kullanıcı tarafından doğrulandı: `/forgot-password` → e-posta → `/auth/callback` → `/auth/update-password`; mobil ekran hâlâ hash tabanlı eski adrese gidiyor) Web'de "şifremi unuttum" akışı yok. Mobil `ForgotPasswordScreen.js` var olmayan
    `/auth/update-password` sayfasına yönlendiriyor; `/auth/callback` de her durumda oturumu kapatıyor → şifre sıfırlama kırık.
  - **1.4-S2 [DÜŞÜK]** `?error=rate_limit&message=` URL'deki metni ekrana basıyor (React kaçışlıyor ama içerik saldırgan kontrolünde).
  - **1.4-S3 [DÜŞÜK]** `account_deleted` dalı ölü; kullanılmayan `supabase` değişkeni.

### 1.5 E-posta doğrulama
- **Dosyalar:** `app/auth/check-email/page.tsx` (OTP), `app/auth/callback/route.ts` (bağlantı),
  `app/auth/verify-email/page.tsx` (yetim), `components/dashboard/EmailVerificationBanner.tsx`
- **Sorunlar:**
  - ✅ ~~**1.5-S1 [ORTA]**~~ (PKCE bağlantısı da oturumu açık bırakıp /dashboard'a gidiyor; token_hash/access_token yolları giriş CSRF'ine karşı oturumu kapatmaya devam ediyor) OTP yolu kullanıcıyı oturum açık bırakıp `/onboarding`'e, bağlantı yolu oturumu kapatıp `/login`'e götürüyor; iki farklı son durum.
  - ✅ ~~**1.5-S2 [ORTA]**~~ (tekrar etmiyor: canlıda son 30 günün kayıtları 6 haneli kodla onaylanmış; yorum düzeltildi) Kodda "user gets 8" yorumu var, arayüz 6 hane kabul ediyor. Supabase projesinde OTP uzunluğu 8 ise doğrulama imkânsız (doğrulanmadı).
  - ✅ ~~**1.5-S3 [ORTA]**~~ (tekrar etmiyor: Supabase onayı zorunlu tutuyor; onaysız 20 hesabın hiçbiri giriş yapamamış) E-posta onayı zorunlu değil; dashboard yalnızca banner gösteriyor.
  - **1.5-S4 [DÜŞÜK]** `/auth/verify-email` hiçbir yerden bağlanmıyor, `alert()` kullanıyor.

### 1.6 Onboarding profil formu
- **Dosyalar:** `app/onboarding/page.tsx`, `app/onboarding/actions.ts` (`saveOnboardingProfile`),
  `components/onboarding/{AvatarUploader,BrandForm,InfluencerForm}.tsx`
- **İş:** Profil + (marka için) vergi bilgileri, web sitesi ve kurumsal e-posta. Taslak localStorage'da.
  Kaydettikten sonra influencer `/onboarding/verify`'a, marka `/dashboard`'a gider. Marka için kurumsal e-postaya kod gönderilir.
- **Sorunlar:**
  - ✅ ~~**1.6-S1 [ORTA]**~~ (taslak yalnızca DB'de boş alanları dolduruyor; varsayılanlar birleştirmeden sonra; DB avatarı öncelikli) localStorage taslağı DB değerlerinin üzerine yazıyor; eski taslak yeni profili ezebilir.
  - **1.6-S2 [DÜŞÜK]** Marka kategorisi `'tech'` olarak sabit (`page.tsx`).
  - **1.6-S3 [DÜŞÜK]** RLS hata metni kullanıcıya gösteriliyor; `avatar_url` istemciden gelen herhangi bir string.

### 1.7 Onboarding sosyal doğrulama adımı
- **Dosyalar:** `app/onboarding/verify/page.tsx`, `components/onboarding/SocialVerificationStep.tsx`
- **İş:** Doğrulanmış IG/TikTok hesabı olmayan influencer'ı bio kodu akışına sokar (detay 2.1).
- **Sorunlar:** **1.7-S1 [DÜŞÜK]** Yasal metin iki kopya (`lib/legal-constants.ts` ve `app/legal/page.tsx`).

### 1.8 Dashboard layout kapıları
- **Dosyalar:** `app/dashboard/layout.tsx`, `app/dashboard/page.tsx`,
  `components/dashboard/{RejectedScreen,IncompleteProfileBanner,EmailVerificationBanner,BrandLockScreen}.tsx`
- **İş (sırasıyla):** oturum → `users` satırı (yoksa oluşturur) → username/full_name yoksa onboarding →
  reddedilmişse RejectedScreen → DB rolü influencer ve doğrulanmış hesap yoksa `/onboarding/verify` → bannerlar.
- **Sorunlar:**
  - ✅ ~~**1.8-S1 [KRİTİK]**~~ (rol artık `lib/viewer-role.ts` ile DB'den; marka/influencer layout'ları eklendi) Rol kaynağı tutarsız. Sidebar, header ve `/dashboard` yönlendirmesi `user_metadata.role`
    okuyor; kullanıcı bunu `auth.updateUser({data:{role:'brand'}})` ile değiştirebilir. Ayrıca
    `/dashboard/brand/*` ve `/dashboard/influencer/*` altında rol koruması yok: doğrulanmış bir influencer marka
    keşif ekranını ve AI önerilerini açabilir. Etkilenen yerler: `app/dashboard/page.tsx:15`, `layout.tsx:24`,
    `brand/discover/page.tsx`, `brand/ai/page.tsx`, `app/profile/actions.ts:26`, Spotlight plan sayfaları, `feedback/thank-you`.
  - ✅ ~~**1.8-S2 [YÜKSEK]**~~ (silmede giriş kaydı önce kilitleniyor; auth silinemezse kilitli kalıyor, `lib/account-deletion.ts`) Silinen hesap geri dönebiliyor: profil satırı yoksa layout yeni satır açıyor; `deleteAccount`
    auth silme hatasını yutuyor (bkz. 1.9-S1).
  - ✅ ~~**1.8-S3 [ORTA]**~~ (sorgu/insert hatasında "Tekrar dene" ekranı; çakışmada satır yeniden okunuyor) Insert hatası her zaman `/onboarding`'e yönlendiriyor → olası döngü.
  - ✅ ~~**1.8-S4 [ORTA]**~~ (kilit marka layout'unda merkezi; doğrulanmamış marka yalnızca ana sayfa, profil, ayarlar, rozetler) Marka kilidi merkezi değil; her sayfa `BrandLockScreen`'i kendisi çiziyor, unutan sayfa kilitsiz kalıyor.

### 1.9 Ayarlar (bildirim tercihi, şifre, hesap silme)
- **Dosyalar:** `app/dashboard/{influencer,brand}/settings/page.tsx` (birebir kopya),
  `app/dashboard/influencer/settings/actions.ts`, `components/settings/*`
- **Sorunlar:**
  - ✅ ~~**1.9-S1 [YÜKSEK]**~~ (`lib/account-deletion.ts`: kilit → profil → dosyalar → auth; DB kuralı mesajı kullanıcıya gösteriliyor) `deleteAccount` auth kullanıcısını silemezse yalnızca loglayıp başarı dönüyor; kullanıcı tekrar giriş yapabilir.
  - ✅ ~~**1.9-S2 [ORTA]**~~ (avatars ve tax-documents altındaki `{uid}/` dosyaları ve eski kök avatar siliniyor) Hesap silinince storage dosyaları (avatars, feedback-images, tax-documents) silinmiyor (KVKK).
  - **1.9-S3 [DÜŞÜK]** Silme modalı "abonelikleriniz iptal edilecek" diyor, Spotlight iptal edilmiyor; şifre tekrar sorulmuyor.
  - ✅ ~~**1.9-S4 [DÜŞÜK]**~~ (hata türüne göre mesaj) `changePassword` her hatayı "en az 6 karakter" olarak raporluyor.
  - **1.9-S5 [ORTA]** `email_notifications` tercihleri kaydediliyor ama hiçbir kod bu tercihlere göre e-posta göndermiyor (bkz. 5.4).

### 1.10 Destek talepleri (kullanıcı tarafı)
- **Dosyalar:** `components/settings/{SupportSection,SupportTicketForm,SupportTicketsList}.tsx`,
  `app/dashboard/influencer/settings/support/actions.ts`
- **Sorunlar:**
  - ✅ ~~**1.10-S1 [ORTA]**~~ (admin ekranları 10 dk imzalı bağlantı kullanıyor; kova gizli, herkese okuma kuralının silinmesi elle çalıştırılacak) Ekler herkese açık `feedback-images` bucket'ına gidiyor ve public URL alıyor (gizlilik).
  - **1.10-S2 [DÜŞÜK]** "Talep numarası" kullanıcının talep sayısı + 1; saklanmıyor, yarış durumuna açık.
  - **1.10-S3 [DÜŞÜK]** Yeni talep realtime gelene kadar listede görünmüyor; seçim değişince realtime yeniden aboneleniyor.

### 1.11 Geri bildirim
- **Dosyalar:** `app/feedback/page.tsx`, `app/feedback/actions.ts`, `app/feedback/thank-you/page.tsx`
- **Sorunlar:** **1.11-S1 [ORTA]** `imageUrl` istemciden gelen herhangi bir URL; `next/image` her host'u optimize ediyor (bkz. 8.5-S1).

### 1.12 Yasal sayfalar
- **Dosya:** `app/legal/page.tsx` (KVKK, şartlar, çerezler — inline JSX)
- **Sorunlar:** ✅ ~~**1.12-S1 [ORTA]**~~ (footer linki `/legal?tab=privacy`; KVKK metni içeriği ayrı iş) Footer `/legal/privacy`'e bağlanıyor, böyle bir rota yok. Metin `lib/legal-constants.ts` ile ikiye bölünmüş; KVKK metni ince.

---

## 2. Influencer / UGC tarafı

Rotalar: `/dashboard/influencer` (+ `/profile`, `/discover`, `/advert`, `/stats`, `/badges`, `/settings`, `/spotlight`),
`/dashboard/offers` (ortak), `/dashboard/spotlight/*`.

### 2.1 Sosyal hesap doğrulama (bio kodu)
- **Dosyalar:** `components/dashboard/{InstagramConnect,TikTokConnect}.tsx`, `app/actions/social-verification.ts`,
  `lib/social-stats.ts`, `utils/{instagram,tiktok}-service.ts`, `app/api/mobile/verify-{instagram,tiktok}`
- **İş:** `IM-xxxxxx` kodu bio'ya konur → Apify kazıması kodu arar → `social_accounts.is_verified=true`, istatistikler,
  `social_account_history`, profil senkronu, `syncBlueTick`. Tüm yazımlar service role ile.
- **Sorunlar:**
  - ✅ ~~**2.1-S1 [KRİTİK]**~~ (kazıma kilidi + saatte 6 deneme + doğrulanmış hesapta günde 1 kullanıcı yenilemesi; migration 20261007000002) Sunucu tarafında sınır yok: her "doğrula/yenile" çağrısı ücretli Apify koşusu (yeniden denemeyle 3'e kadar).
    7 günlük bekleme yalnızca istemcide ve `updated_at`'e bakıyor. Mobil uç noktalar da sınırsız → Apify kredisi tüketme saldırısı.
  - ✅ ~~**2.1-S2 [ORTA]**~~ (gönderi modu boş/hata dönerse profil "details" moduyla alınıyor; gizli/bulunamadı ayrı mesaj) Gönderisi olmayan Instagram hesabı doğrulanamıyor (scraper gönderi yoksa hata atıyor).
  - ✅ ~~**2.1-S3 [ORTA]**~~ (TikTok yenilemesi `social_account_history` yazıyor: takipçi + yaklaşık etkileşim) TikTok yenilemesi `social_account_history` yazmıyor → TikTok grafikleri boş.
  - ✅ ~~**2.1-S4 [ORTA]**~~ (son videoların ortalama beğeni+yorum+paylaşım / takipçi; veri yoksa null. Örnek sayısı `TIKTOK_VIDEO_SAMPLE`, varsayılan 1 = eski maliyet; Profil ekranlarındaki %4.8/%3.0 yedekleri kaldırıldı; mevcut hesaplar sonraki yenilemede düzelir) TikTok etkileşim oranı uydurma: `(toplam beğeni / takipçi) * 10`, 1.5–18.5 aralığına kırpılıyor.
    Bu sayı güven skorunu ve mavi tiki besliyor.
  - ✅ ~~**2.1-S5 [ORTA]**~~ (Apify `authorMeta.id` varsa `tt-id-<id>` kullanılıyor ve başka kullanıcıyla çakışma kontrol ediliyor; yoksa eski biçim) TikTok `platform_user_id` = `tt-${username}`; kimlik değişebilen kullanıcı adına bağlı, başka kullanıcıyla çakışma kontrolü yok.
  - **2.1-S6 [DÜŞÜK]** Analiz penceresi (30 gün / 24 gönderi) ile scraper limiti (15) ve arayüz etiketleri ("Son 21 Gün", "Son 6 gönderi") uyuşmuyor.
  - ✅ ~~**2.1-S7 [ORTA]**~~ (aynı doğrulanmış hesap için yeni kod üretilmiyor, doğrulama düşmüyor; farklı hesaba geçiş bilinçli değişiklik) Doğrulanmış hesapta yeniden kod üretmek hesabı doğrulanmamışa çeviriyor; tek hesapsa kullanıcı dashboard'dan kilitlenir.
  - **2.1-S8 [DÜŞÜK]** `social_accounts` SELECT herkese açık (`USING(true)`, tüm kolonlar); `verification_code` okunabilir.

### 2.2 Otomatik istatistik yenileme
- **Dosyalar:** `app/dashboard/influencer/page.tsx:104-109` (`refreshIfStale`, beklenmeden), `lib/social-stats.ts`,
  `app/api/cron/refresh-stats/route.ts` (Vercel cron, her gün 09:00 UTC)
- **Sorunlar:**
  - ✅ ~~**2.2-S1 [KRİTİK]**~~ (dashboard yenilemesi aynı kilidi kullanıyor, eşzamanlı ikinci koşu başlamıyor) Dashboard her render'da kilitsiz "ateşle-unut" yenileme başlatıyor; kazıma sürerken her sayfa yenilemesi yeni ücretli koşu demek.
    Serverless'ta beklenmeyen iş yanıt sonrası öldürülebilir.
  - ✅ ~~**2.2-S2 [YÜKSEK]**~~ (yeni koşu en geç 25. saniyede başlar, `maxDuration=60`; iş saatlik göreve de yayıldı) Cron 100 hesaba kadar sırayla senkron Apify koşusu yapıyor, `maxDuration` yok → birkaç hesaptan sonra zaman aşımı.
  - ✅ ~~**2.2-S3 [ORTA]**~~ (eşik artık 3 günden eski veri) Cron eşiği "bugün 09:00'dan eski", cron da 09:00'da koşuyor → her hesap her gün bayat sayılıyor (3 günlük kuralla çelişiyor).

### 2.3 OAuth ile hesap bağlama (Meta / TikTok)
- **Dosyalar:** `app/api/auth/{instagram,tiktok}/{login,callback}/route.ts`, `utils/meta-service.ts`, `utils/tiktok-service.ts`,
  `lib/oauth-state.ts` (CSRF state — sağlam), tetikleyici `components/influencer/ProfileForm.tsx`
- **Sorunlar:**
  - ✅ ~~**2.3-S1 [YÜKSEK]**~~ (ProfileForm da "Çok Yakında"; login rotaları `SOCIAL_OAUTH_ENABLED=true` olmadan başlamıyor) Dashboard bu bağlantıları "Çok Yakında" diye kapalı gösteriyor ama ProfileForm canlı link veriyor.
  - **2.3-S2 [YÜKSEK]** (OAuth kapatıldığı için etkisiz; açılmadan önce `user.info.profile` kapsamı + `username` alanı gerekli. Canlıda OAuth ile bağlanmış hesap yok) TikTok OAuth kullanıcı adı yerine `display_name` kaydediyor, `syncBlueTick` çağırmıyor; sonraki yenileme yanlış hesabı kazıyor.
  - **2.3-S3 [ORTA]** Meta yolu `platform_user_id`'yi Graph business id ile yazıyor (Apify IG pk yazıyor) → aynı IG hesabı iki kullanıcıya bağlanabilir.
    `last_scraped_at` set edilmiyor, diğer kullanıcılarla çakışma kontrolü yok.
  - **2.3-S4 [DÜŞÜK]** Token'lar saklanmıyor (OAuth kazımaya göre bir şey katmıyor); `video.list` kapsamı kullanılmıyor.

### 2.4 Mavi tik (`verified-account`)
- **Dosyalar:** `lib/blue-tick-rules.ts`, `lib/blue-tick.ts` (`syncBlueTick`, `sweepBlueTicks`),
  `components/dashboard/BlueTickProgressCard.tsx`, migration `20261006000002_blue_tick_rules.sql`
- **Kural:** aktif Spotlight + doğrulanmış hesap + 30 günden taze istatistik + 10k+ takipçi + güven skoru ≥ 80.
  Admin istisnası `users.blue_tick_override`. Rozet her zaman ilk sırada gösterilir.
- **Sorunlar:**
  - ✅ ~~**2.4-S1 [ORTA]**~~ (kart artık `evaluateBlueTick` sonucunu gösteriyor: aynı hesap, aynı skor, süresi kontrol edilmiş Spotlight) Kural en çok takipçili hesabı (TikTok olabilir) kullanıyor; dashboard TrustScoreCard yalnızca Instagram'ı kullanıyor → iki kart farklı skor gösterebilir.
  - ✅ ~~**2.4-S2 [ORTA]**~~ (4.3-S1 ile: süresi dolan Spotlight saatlik görevde kapanıyor) Spotlight süresi dolanlar `spotlight_active=true` kaldığı için mavi tik kuralını geçmeye devam ediyor (bkz. 4.3-S1).
  - **2.4-S3 [DÜŞÜK]** Eski yorumlar tiki bio doğrulamaya bağlı anlatıyor (`badgeAwarding.ts`, `InfluencerGridCard.tsx`).

### 2.5 Güven skoru ve eşleşme skoru
- **Dosyalar:** `utils/matching.ts`, `components/dashboard/TrustScoreCard.tsx`; mobilde ayrı kopya `mobile-app/utils/calculation.js`
- **Sorunlar:**
  - ✅ ~~**2.5-S1 [YÜKSEK]**~~  `TrustScoreCard.tsx:160-166` yüzde değeri (ör. 3.5) `0.01..0.10` aralığıyla karşılaştırıyor; "Sağlıklı Etkileşim" yalnızca ölü hesaplarda yanıyor.
  - ✅ ~~**2.5-S2 [ORTA]**~~ (Spotlight olmayana öneri verisi hiç gönderilmiyor, yer tutucu kartlar) Spotlight olmayanlarda kart bulanık ama skor istemciye gönderiliyor.
  - ✅ ~~**2.5-S3 [DÜŞÜK]**~~ (skor render başına bir kez) `InfluencerGridCard` skoru her render'da 4 kez hesaplıyor; `verification_status` parametresi yok sayılıyor.

### 2.6 Profil tamamlama
- **Dosyalar:** `utils/profileCompletion.ts`, `components/dashboard/ProfileCompletionCard.tsx`
- **Sorunlar:**
  - ✅ ~~**2.6-S1 [ORTA]**~~ (kullanıcı kendi rozetlerini değerlendirtebiliyor; başkası için admin gerekir) Kart admin‑only `/api/award-badges`'e POST atıyor → kullanıcı hep 403 alıyor, otomatik rozet yolu ölü.
  - **2.6-S2 [DÜŞÜK]** Tamamlama doğrulanmış hesapları değil elle girilen `social_links`'i sayıyor; `phone`/`email` görevleri hiç üretilmiyor.

### 2.7 Profil düzenleme
- **Dosyalar:** `components/influencer/ProfileForm.tsx`, `app/dashboard/influencer/profile/actions.ts`,
  `utils/{socialLinkValidation,usernameValidation}.ts`, `/api/check-username`
- **Sorunlar:**
  - ✅ ~~**2.7-S1 [ORTA]**~~ (doğrulanmış Instagram/TikTok linki formda kilitli ve sunucuda doğrulanmış kullanıcı adından yazılıyor) Instagram link alanı hesap doğrulandıktan sonra da düzenlenebilir (TikTok kilitli); `social_links.instagram` doğrulanmış kullanıcı adından sapabilir.
  - ✅ ~~**2.7-S2 [ORTA]**~~ (avatar artık `{uid}/` klasörüne yükleniyor) Avatar bucket köküne rastgele adla yükleniyor; avatars politikası `{uid}/` klasörü istiyor (bkz. 7.5-S1).
  - **2.7-S3 [DÜŞÜK]** Tüm güncelleme yükü `console.log` ile loglanıyor; eksik kolon için kalıntı try/catch.

### 2.8 Vitrin görünürlüğü (`is_showcase_visible`, "Vitrin Modu")
- **Dosyalar:** `components/dashboard/SpotlightToggleCard.tsx`, `app/dashboard/influencer/actions.ts` (`toggleShowcaseVisibility`)
- **Sorunlar:**
  - ✅ ~~**2.8-S1 [ORTA]**~~ (kolon açılsa bile keşif doğrulanmış hesap şartını sunucuda uyguluyor, 2.8-S2) Kolon istemci beyaz listesinde; kullanıcı REST ile doğrudan açıp aksiyonun kontrollerini atlayabilir.
  - ✅ ~~**2.8-S2 [ORTA]**~~ (keşif listeleri doğrulanmış sosyal hesabı olmayanları göstermiyor; favoriler/listeler göstermeye devam ediyor) Varsayılan `true`; hesap bağlamamış doğrulanmış influencer'lar keşifte görünüyor, kart "Pasif" diyor.
  - ✅ ~~**2.8-S3 [DÜŞÜK]**~~ (bildirim metni vitrin modu için düzeltildi) Her açılışta "Spotlight Üyeliğiniz Aktifleşti!" bildirimi gidiyor (ücretsiz vitrin ile ücretli Spotlight karışmış).

### 2.9 İstatistik kartı ve "AI analiz"
- **Dosyalar:** `components/profile/InfluencerStats.tsx`, `app/actions/ai-analysis.ts`
- **Sorunlar:**
  - **2.9-S1 [ORTA]** "AI analiz" yerel kural motoru + rastgele karıştırma + sahte 800 ms gecikme; LLM yok. Pazarlama dili yanıltıcı.
  - **2.9-S2 [ORTA]** Her marka ücretsiz BRAND_PRO seviyesini alıyor; seviye eşlemesi dosyalar arasında farklı (`ipro`/`mpro`, eski `pro`/`elite`).
  - **2.9-S3 [DÜŞÜK]** `match_score` / `profile_coach` "Çok yakında" ile kapalı; `statsPayload.changes` hiç yazılmıyor; "TikTok Resmi Entegrasyonu Aktif" yazısı yanlış.

### 2.10 İstatistik geçmişi
- **Dosyalar:** `app/dashboard/influencer/stats/page.tsx`, `components/dashboard/StatsHistory.tsx`
- **Sorunlar:** ✅ ~~**2.10-S1 [YÜKSEK]**~~  `social_accounts...eq('user_id').single()` platform filtresi yok; IG + TikTok'u olan kullanıcı "Hesap Bulunamadı" görüyor.

### 2.11 Influencer vitrini (diğer influencer'ları gezme)
- **Dosyalar:** `app/dashboard/influencer/discover/page.tsx`, `BrandDiscoverGrid.tsx`, `InfluencerGridCard.tsx`
- **Sorunlar:** **2.11-S1 [ORTA]** İstatistik `userAccounts[0]`'dan, doğrulanmamış olabilir; sayfalama yok; Spotlight süresi kontrol edilmiyor.

### 2.12 İlanlara başvuru
- **Dosyalar:** `app/dashboard/influencer/advert/{page,actions}.ts(x)`, `components/dashboard/{InfluencerAdvertTabs,AdvertProjectsList,AdvertApplicationsList}.tsx`
- **Sorunlar:**
  - ✅ ~~**2.12-S1 [ORTA]**~~ (aksiyon rol ve son başvuru gününü kontrol ediyor; DB kuralı `20261007000005`) `applyToAdvert` rol ve son tarih kontrolü yapmıyor.
  - **2.12-S2 [DÜŞÜK]** `cancelApplication` hiçbir yerden çağrılmıyor; tüm açık ilanlar sayfalamasız yükleniyor.

### 2.13 Gelen teklifler (influencer)
- **Dosyalar:** `app/dashboard/offers/page.tsx`, `components/dashboard/{OffersManager,OfferActivityCard,OfferActionButtons}.tsx`,
  `app/dashboard/influencer/offers/actions.ts` (`updateOfferStatus`), `.../dismiss/actions.ts`
- **Sorunlar:**
  - **2.13-S1 [ORTA]** (bilinçli görünüyor: teklif beklemede kalır, görüşmek için sohbet açılır; ürün kararı bekliyor) "Beklet" durumu kaydedilmiyor ama sohbet odası yine açılıyor.
  - **2.13-S2 [DÜŞÜK]** `OffersManager` her "gizle"de realtime'a yeniden aboneleniyor; `undismissOffer` ve `InfluencerOffersFeed` ölü.

---

## 3. Marka tarafı ve pazar yeri

Rotalar: `/dashboard/brand` (+ `/discover`, `/favorites`, `/inflist/[id]`, `/ai`, `/offers`, `/advert`, `/profile`, `/badges`, `/settings`).
Marka layout'u ve rol koruması yok (bkz. 1.8-S1).

### 3.1 Marka ana paneli
- **Dosyalar:** `app/dashboard/brand/page.tsx`, `BrandPipelineCard`, `ProfileCompletionCard`, `InfluencerGridCard`,
  `InflistManager`, `BrandOffersList`, `BrandVerificationCard`
- **Sorunlar:**
  - ✅ ~~**3.1-S1 [ORTA]**~~ (öneriler yalnızca Spotlight markası için hesaplanıyor; diğerlerine boş iskelet, `lib/spotlight-access.ts`) Spotlight olmayan markaya AI önerileri hesaplanıp gönderiliyor, yalnızca CSS ile bulanıklaştırılıyor (premium veri DOM'da).
  - ✅ ~~**3.1-S2 [DÜŞÜK]**~~ (users realtime yayınında değil, olay hiç gelmiyordu; sekmeye dönünce durum yeniden okunuyor) `BrandVerificationCard` kolon kısıtlı `users` tablosunu realtime dinliyor; olay sessizce gelmeyebilir (doğrulanmadı).

### 3.2 Keşfet (influencer ızgarası)
- **Dosyalar:** `discover/page.tsx`, `components/dashboard/BrandDiscoverGrid.tsx`, `InfluencerGridCard.tsx`, `AddToListModal`, `SimilarProfilesModal`
- **Sorunlar:**
  - ✅ ~~**3.2-S1 [ORTA]**~~ (favoriler ve liste sayfaları aktif Spotlight planını geçiriyor) Favoriler ve Inflist sayfaları `spotlightPlan` geçmiyor → Pro markalarda bile PRO filtreleri kilitli.
  - **3.2-S2 [ORTA]** (ertelendi: <100 influencer; 3.13-N4 "ücretsiz markaya kota" tasarımıyla birlikte yapılacak) Her şey tek seferde yükleniyor (sayfalama yok); "1,2K" gibi metin istatistikler istemcide ayrıştırılıyor.

### 3.3 Favoriler
- **Dosyalar:** `app/dashboard/brand/favorites/page.tsx`, `app/actions/favorites.ts`
- **Sorunlar:** ✅ ~~**3.3-S1 [ORTA]**~~ (toggle tüm eşleşen satırlara bakıyor; tekil indeks `20261007000010` canlıda uygulandı) `favorites` tablosundaki UNIQUE kısıtı bir migration'da düşürülmüş; tekrar varsa `.single()` hata verip
  silmek yerine bir kopya daha ekliyor.

### 3.4 Inflist (adlandırılmış listeler)
- **Karar (7 Ekim):** listeler favoriler sayfasında (`/dashboard/brand/favorites`) favorilerle birlikte yönetilir; marka panelindeki ayrı bölüm kaldırıldı.
- **Dosyalar:** `components/dashboard/InflistManager.tsx`, `AddToListModal.tsx`, `inflist/[id]/page.tsx`, `app/actions/favoriteLists.ts`
- **Sorunlar:**
  - ✅ ~~**3.4-S1 [ORTA]**~~ (karar: listeler şimdilik ücretsiz, kilit kaldırıldı; ileride Spotlight, bkz. 3.13-N5) Spotlight kısıtı yalnızca istemcide (aksiyonlar ve detay sayfası kontrol etmiyor).
  - **3.4-S2 [DÜŞÜK]** "Tümünü Yönet" favoriler sayfasına gidiyor, liste yönetim sayfası yok; isim sunucuda doğrulanmıyor;
    revalidate yanlış yolu hedefliyor; `InflistCard.tsx` ve `getLists` ölü.

### 3.5 AI öneriler (marka)
- **Dosyalar:** `app/dashboard/brand/ai/page.tsx`, `utils/fetchInfluencers.ts` (`getAIRecommendations`), `utils/matching.ts`
- **Sorunlar:**
  - ✅ ~~**3.5-S1 [ORTA]**~~ (Spotlight yoksa sayfa plan ekranına yönlendiriyor; sezgisel skor/LLM yok notu sürüyor) Sayfada Spotlight kontrolü yok (yalnızca link Spotlight'a gösteriliyor); LLM yok, sezgisel skor.
  - **3.5-S2 [DÜŞÜK]** "%95+ uyumlu" sabit iddia; marka ve influencer kategorileri farklı listelerden geldiği için eşleşme genelde boş havuza düşüyor; sınırsız `.in('id', ids)`.

### 3.6 Teklifler (marka → influencer)
- **Dosyalar:** `components/profile/OfferModal.tsx` → `app/profile/actions.ts` (`createOffer`), `brand/offers/page.tsx`,
  `components/dashboard/BrandOffersList.tsx`, `brand/offers/dismiss/actions.ts`
- **Sorunlar:**
  - ✅ ~~**3.6-S1 [ORTA]**~~ (rol DB'den, `fetchAccountRole`) `createOffer` rol kontrolünü `user_metadata.role` ile yapıyor (DB politikası asıl korumayı sağlıyor),
    bütçe NaN/negatif kontrolü yok, alıcının influencer olduğu kontrol edilmiyor.
  - **3.6-S2 [YÜKSEK]** Influencer'a yeni teklif için bildirim veya e-posta gitmiyor (bkz. 5.4-S1).
  - ✅ ~~**3.6-S3 [ORTA]**~~ (sayımlar paralel ve yalnızca `count` dönüyor; okundu bilgisi 5.3-S1 ile metadata'dan) Okunmamış sayıları N+1 sorgu; okundu bilgisi hiç temizlenmiyor (bkz. 5.3).
  - **3.6-S4 [DÜŞÜK]** `rooms` INSERT realtime kanalı filtresiz; `undismissInfluencer` için arayüz yok; `'hold'` tipi eksik.

### 3.7 İlanlar (advert projects / kampanyalar)
- **Dosyalar:** `brand/advert/page.tsx`, `components/dashboard/{BrandAdvertTabs,BrandAdvertManager,AdvertProjectsList,AdvertPerformanceChart}.tsx`,
  `brand/advert/actions.ts`, `app/actions/analytics.ts`
- **Sorunlar:**
  - ✅ ~~**3.7-S1 [YÜKSEK]**~~ (mevcut kapak korunuyor) İlan düzenleme bozuk: düzenlemede `heroImage` boşaltılıyor, kaydetme "Kapak fotoğrafı zorunlu" diye reddediyor.
  - ✅ ~~**3.7-S2 [YÜKSEK]**~~ (payment_type/custom_questions okunuyor, açıklama ezilmiyor) Düzenlemede veri kaybı: sayfa `payment_type`, `custom_questions`, `description` seçmiyor → barter ilan nakde dönüyor, açıklama `''` ile eziliyor.
  - ✅ ~~**3.7-S3 [ORTA]**~~ (`getAnalyticsStats` Spotlight kontrolü yapıyor) Analitik yalnızca istemcide kısıtlı; `getAnalyticsStats` Spotlight kontrolü yapmıyor.
  - **3.7-S4 [DÜŞÜK]** Topluluk sekmesinde `brandIsSpotlight` hiç set edilmiyor (sıralama işlemiyor); liste sınırsız; silmede dosya yolu `split('/').pop()`.

### 3.8 Başvuru değerlendirme (marka)
- **Dosyalar:** `AdvertApplicationsList.tsx`, `brand/advert/actions.ts` (`getBrandApplicationsAdmin`, `updateApplicationStatus`, `getOrCreateAdvertApplicationRoom`)
- **Sorunlar:**
  - ✅ ~~**3.8-S1 [ORTA]**~~ (okuma ve durum güncelleme oturum istemcisiyle; canlı RLS markaya yalnızca kendi ilanlarının başvurularını açıyor) Okumalar "RLS sorunu için geçici çözüm" olarak service role ile; sahiplik kodda kontrol ediliyor ama RLS devre dışı kalmış.
  - ✅ ~~**3.8-S2 [ORTA]**~~ (yalnızca bu başvurunun odası yeniden kullanılıyor; başvuru durumu artık 'pending'e çekilmiyor) `getOrCreateAdvertApplicationRoom` çift arasındaki herhangi bir odayı yeniden kullanıyor, `rooms` UPDATE politikası olmadığı için
    `advert_application_id` güncellemesi sessizce başarısız; oda açılırken başvuruyu `pending`'e geri çekebiliyor.
  - ✅ ~~**3.8-S4 [YÜKSEK]**~~ (yeni bulundu, canlıda düzeltildi) Canlı CHECK kısıtı `shortlisted` durumunu reddediyordu; "Ön Listeye Al" hiç çalışmamış (canlıda tek bir shortlisted başvuru yok). Kısıt genişletildi, `20261007000011`.
  - **3.8-S3 [ORTA]** Başvuru durumu değişince influencer'a bildirim yok; realtime kanal filtresiz ve anon istemciyle farklı join kullanıyor.

### 3.9 Marka profili
- **Dosyalar:** `brand/profile/page.tsx`, `components/brand/BrandProfileForm.tsx`, `brand/profile/actions.ts`
- **Sorunlar:**
  - ✅ ~~**3.9-S1 [YÜKSEK]**~~ (canlıda "avatars insert" kökte yüklemeye izin veriyordu; logo artık `{uid}/` klasörüne yükleniyor) Logo yükleme yolu klasörsüz (`${uuid}.ext`), avatars politikası `{uid}/` istiyor → büyük ihtimalle başarısız (bkz. 7.5-S1).
  - ✅ ~~**3.9-S2 [YÜKSEK]**~~  Sayfa `kick`, `twitter`, `twitch` alanlarını forma geçmiyor → kaydetme bunları null'a çekiyor (ya da 30 günlük kilide takılıyor).
  - ✅ ~~**3.9-S4 [YÜKSEK]**~~ `updateBrandProfile` doğrulama hatasını fırlatıyordu; production'da kullanıcı hata sayfası görüyordu (canlı Vercel kayıtlarında görüldü). Artık mesaj olarak dönüyor.
  - **3.9-S3 [DÜŞÜK]** Eksik kolon try/catch'i ölü; `brand/profile/badges/actions.ts`, brand settings re-export dosyaları kullanılmıyor.

### 3.10 Vergi levhası doğrulama
- **Dosyalar:** `components/brand/TaxCertificateUpload.tsx`, `brand/profile/tax-actions.ts` (`submitTaxCertificate`),
  `lib/tax-verification.ts`, `lib/tax-certificate-match.ts`, `lib/tax-id.ts`, `components/admin/TaxVerificationReview.tsx`
- **İş:** PDF yerelde `unpdf` ile okunur (dış servis yok), profil ile karşılaştırılır (VKN/TCKN, unvan, vergi dairesi, il, yıl, üretici).
  `TAX_AUTO_APPROVE=true` değilse her kayıt admin onayına düşer. Görsel/taramalar her zaman incelemeye gider.
- **Tablolar:** `tax_verifications`, özel `tax-documents` bucket'ı.
- **Sorunlar:** **3.10-S1 [DÜŞÜK]** Günlük 5 sınırı `tax_verifications` satırlarını sayıyor; aksiyon çağrılmadan bucket'a doğrudan yükleme sınırsız (yalnızca kendi klasörü, 5 MB).

### 3.11 Kurumsal e-posta ve Resmi İşletme (sarı tik)
- **Dosyalar:** `lib/corporate-email.ts`, `lib/corporate-email-verification.ts`, `lib/official-business.ts`,
  `brand/profile/corporate-email-actions.ts`, `components/brand/CorporateEmailVerification.tsx`,
  migration `20261007000001_corporate_email.sql`
- **İş:** Kayıtta web sitesi + sitenin alan adında kurumsal e-posta zorunlu (Gmail vb. reddedilir). 6 haneli kod ile doğrulanır.
  Sarı tik = vergi onayı + doğrulanmış kurumsal e-posta + alan adı eşleşmesi; tek karar noktası `syncOfficialBusiness`.
  Web sitesi alan adı değişirse doğrulama ve sarı tik düşer (DB guard).
- **Sorunlar:**
  - **3.11-S1 [ORTA]** Bu kuraldan önce verilmiş sarı tikler otomatik geri alınmadı (karar bekliyor).
  - ✅ ~~**3.11-S2 [ORTA]**~~ (üretimde `EMAIL_FROM` ve `RESEND_API_KEY` tanımlı; kayıt/kod e-postalarının geldiği kullanıcıca doğrulandı) Kod e-postası için Resend'de doğrulanmış alan adı ve `EMAIL_FROM` gerekli; yoksa yalnızca Resend hesap sahibine gider.

### 3.12 Kilit ve doğrulama ekranları
- **Dosyalar:** `components/dashboard/BrandLockScreen.tsx`, `BrandVerificationCard.tsx`
- **Sorunlar:** bkz. 1.8-S4.

### 3.13 Ürün notları: doğrulama yolu ve ücretsiz marka erişimi (karar/tasarım bekliyor)
- **Kaynak:** kullanıcı notları, 7 Ekim. Henüz kod yok.
- **Önkoşul:** OAuth yolu gerçekten çalışmalı (2.3-S1/S2: arayüzde "Çok yakında", TikTok OAuth yanlış kullanıcı adı kaydediyor).
- **Notlar:**
  - **3.13-N1** Kod (bio) ile doğrulayan Instagram/TikTok hesaplarının belli verileri çekilemiyor: kazıma yalnızca herkese açık
    sayıları verir (takipçi, beğeni, yorum, izlenme). Erişim, gösterim, kaydetme, kitle demografisi yalnızca OAuth ile gelir.
  - **3.13-N2** OAuth yerine kod ile doğrulayanlar dezavantajlı olmalı. Seçenekler: güven skorunda tavan, mavi tik/rozet yok,
    keşifte alt sıra, "resmi veri" etiketi yok, Spotlight sınırı.
  - **3.13-N3** Ücret ödemeyen markalar yalnızca kod ile doğrulanmış influencer/UGC'lere ulaşabilsin; OAuth ile bağlanmış
    profiller ücretli markalara ayrılsın.
  - **3.13-N4** Ücret ödemeyen markalar tüm listeyi göremesin. Sistem markanın ihtiyacını (kategori, bütçe, ilanlar, hedef kitle)
    analiz edip ücretsiz olarak belli oranda/kotada profil önersin. Kısıt sunucuda uygulanmalı (bugün premium veri istemciye
    gidip yalnızca CSS ile bulanıklaştırılıyor, bkz. 3.1-S1).
  - **3.13-N5** Listeler (Inflist) şimdilik tüm doğrulanmış markalara ücretsiz; ileride Spotlight'a dahil edilecek
    (o zaman `createList` / `toggleInList` sunucuda da kontrol etmeli).
  - **3.13-N6** İleride gönderisi olmayan Instagram/TikTok hesapları doğrulamada kabul edilmeyecek (bugün 2.1-S2 düzeltmesiyle
    kabul ediliyor). Kural eklenince `media_count = 0` veya son gönderi yoksa net mesajla reddet; mevcut gönderisiz doğrulanmış
    hesaplar kalır (karar, 7 Ekim).

---

## 4. Ortak: rozetler, Spotlight, profil

### 4.1 Rozet kataloğu ve otomatik verme
- **Dosyalar:** `app/badges/data.ts`, `utils/badgeAwarding.ts` (`awardBadgesForUser`), `app/api/award-badges/route.ts`
- **İş:** Influencer: `profile-expert`, `founder-member` (ilk 1000). Marka: `showcase-brand`, `pioneer-brand`.
  `official-business` artık yalnızca `syncOfficialBusiness` ile verilir.
- **Sorunlar:**
  - ✅ ~~**4.1-S1 [ORTA]**~~ ('use server' kaldırıldı; yalnızca sunucu içi çağrılar) Dosya `'use server'`; `awardBadgesForUser(anyUserId)` yetki kontrolsüz çağrılabilir bir aksiyon (yalnızca hak edilen rozetleri verdiği için etki düşük).
  - ✅ ~~**4.1-S2 [ORTA]**~~ (okumalar ve sayım service role ile; sayım hatasında rozet verilmiyor) `founder-member` sayımı RLS'e tabi istemciyle yapılıyor; satırlar gizlenirse fazla kişiye rozet gider. RPC fallback'i artık admin dışı oturumda hata veriyor.
  - **4.1-S3 [DÜŞÜK]** Katalogda verme mantığı olmayan rozetler: `brand-ambassador`, `lightning-fast`, `five-star`, `trendsetter`, `million-club`, `conversion-wizard`, marka v1.2/v1.3 rozetleri.

### 4.2 Rozet seçimi ve gösterimi
- **Dosyalar:** `components/badges/{BadgeSelector,BadgeDisplay,BadgeDetailList,BadgeCompactList,BadgeProgressInfo,BadgeCard,BadgeToggle}.tsx`
- **İş:** En fazla 3 rozet gösterilir; DB trigger'ı kazanılmamış rozetin gösterilmesini engeller.
- **Sorunlar:**
  - ✅ ~~**4.2-S1 [ORTA]**~~ (keşif kartları seçilen rozetleri gösteriyor, yalnızca kazanılmışlar; mavi tik her zaman; profil sayfası tüm rozet listesini bilinçli gösteriyor) `/profile/[username]` ve `utils/fetchInfluencers.ts` kullanıcının seçtiği `displayed_badges` yerine tüm kazanılmış rozetleri gösteriyor.
  - **4.2-S2 [DÜŞÜK]** `influencer/profile/badges/actions.ts` (`updateDisplayedBadges`) ölü; marka rozet sayfası kazanılanları göstermiyor.

### 4.3 Spotlight üyeliği
- **Dosyalar:** `app/actions/spotlight.ts`, `app/dashboard/spotlight/**`, `app/spotlight/page.tsx`, `components/spotlight/*`
- **İş:** Planlar `ibasic`, `ipro`, `mbasic`, `mpro`. Satın alma kapalı; yalnızca admin açar (`toggleUserSpotlight`).
- **Sorunlar:**
  - ✅ ~~**4.3-S1 [YÜKSEK]**~~ (saatlik görev `lib/spotlight-expiry.ts` ile kapatıyor; canlıda 12 kullanıcı etkileniyordu) Süresi dolan Spotlight hiç kapanmıyor: `checkSpotlightStatus` kullanıcı istemcisiyle `spotlight_active` yazıyor,
    kolon beyaz listede olmadığı için sessizce düşüyor; cron da kapatmıyor. Süresi dolanlar sıralamada önde, +10 güven puanı ve mavi tik hakkı sürüyor.
    Fonksiyon ayrıca istemciden gelen `userId`'ye güveniyor.
  - **4.3-S2 [ORTA]** Fiyatlar birden çok yerde sabit; seviye eşlemesi tutarsız (bkz. 2.9-S2); plan sayfaları metadata rolünü okuyor.
  - **4.3-S3 [DÜŞÜK]** `/dashboard/influencer/spotlight` menüde yok; `/dashboard/spotlight/agency` statik "Çok Yakında".

### 4.4 Benzer profiller
- **Dosyalar:** `app/actions/spotlight.ts` (`getSimilarInfluencers`), `SimilarProfilesModal.tsx`
- **Sorunlar:** ✅ ~~**4.4-S1 [YÜKSEK]**~~ (doğrulanmış hesaplardan okunuyor, oturum gerekli) Var olmayan `instagram_stats` kolonunu okuyor → takipçi hep 0, filtre neredeyse hiçbir şey döndürmüyor.
  Yetki/Spotlight kontrolü yok, `limit(5)` filtreden önce.

### 4.5 Herkese açık profil `/profile/[username]`
- **Dosyalar:** `app/profile/[username]/page.tsx`, `app/profile/actions.ts`
- **Sorunlar:**
  - **4.5-S1 [YÜKSEK]** Giriş zorunlu (bkz. 1.1-S1); anon kullanıcının `users` SELECT politikası da yok (bkz. 7.3-S2).
  - ✅ ~~**4.5-S2 [ORTA]**~~ (geri linki izleyicinin rolüne göre; gizli profilin doğrudan açılması bilinçli bırakıldı) `is_showcase_visible=false` profiller açılabiliyor; geri linki influencer izleyici için bile `/dashboard/brand/discover`.
  - **4.5-S3 [DÜŞÜK]** `view_profile` / `click_profile` analitik olayları hiç gönderilmiyor.

### 4.6 Analitik olaylar
- **Dosyalar:** `app/actions/analytics.ts`, RPC `track_analytics_event`, tablo `analytics_events`
- **Sorunlar:**
  - ✅ ~~**4.6-S1 [ORTA]**~~ (anon yetkisi kaldırıldı, search_path sabit; `20261007000006`) RPC anon dahil herkese açık ve `search_path`'siz; `click_*` olayları için yalnızca markanın varlığına bakıyor → herkes istediği markanın analitiğini şişirebilir.
  - **4.6-S2 [DÜŞÜK]** Yalnızca `view_advert` izleniyor; influencer tarafında analitik yok.

---

## 5. İletişim

### 5.1 Mesaj kutusu
- **Dosyalar:** `app/dashboard/messages/page.tsx`, `components/messages/MessagesPage.tsx`,
  `components/chat/{ModernChatWindow,ModernChatInput,MessageActionsMenu}.tsx`, `app/dashboard/messages/send/actions.ts`
- **İş:** Karşı tarafa göre gruplanmış sohbetler (teklif, başvuru, destek odaları birleşik), metin + görsel eki.
- **Sorunlar:**
  - **5.1-S1 [YÜKSEK]** Doğrudan sohbet başlatma bozuk: `MessagesPage.tsx` `offer_id`/`advert_application_id` olmadan oda ekliyor,
    `restrict_rooms_insert` trigger'ı reddediyor; `?userId=` ile mevcut oda yoksa yalnızca konsola hata düşüyor. Mobilde de aynı (10.3-S4).
  - ✅ ~~**5.1-S2 [YÜKSEK]**~~ (her oda için yalnızca son mesaj ve okunmamış sayısı; 20'lik gruplar halinde paralel) Sunucu sayfası tüm odaların tüm mesajlarını iki kez, sınırsız yüklüyor; PostgREST 1000 satır sınırı son mesajları ve okunmamış sayılarını kesiyor.
  - ✅ ~~**5.1-S3 [ORTA]**~~ (thread yalnızca karşı taraf değişince yükleniyor; realtime kanalı liste güncellemesinde yeniden kurulmuyor) Her yeni mesaj `conversations`'ı değiştirip tüm thread'i temizleyip yeniden yüklüyor (titreme).
  - ✅ ~~**5.1-S4 [ORTA]**~~ (yalnızca chat-attachments adresi görsel sayılıyor, diğerleri düz metin; boyut sınırı PR #19) Görseller `![image](url)` ile algılanıyor; herkes istediği URL'yi gönderip `next/image` üzerinden açtırabiliyor (bkz. 8.5-S1). Ek boyut kontrolü yok.
  - **5.1-S5 [ORTA]** (5 MB/görsel sınırı canlıda; oda katılımcısı politikası `20261007000007` elle çalıştırılmayı bekliyor) `chat-attachments` bucket'ı hiçbir migration'da yok, politika yok; public URL ile servis ediliyor (bkz. 7.5-S2).
  - **5.1-S6 [DÜŞÜK]** Her mesajda engel kontrolü için sunucu aksiyonu; `SidebarLink` iki kez render edilip aynı adlı iki kanal açıyor.

### 5.2 Eski sohbet sayfası
- **Dosyalar:** `app/chat/[roomId]/page.tsx`, `components/chat/ChatWindow.tsx`
- **Sorunlar:** **5.2-S1 [DÜŞÜK]** Hiçbir yerden bağlanmıyor (yetim), dashboard layout'u dışında; robots'ta engellenmemiş.

### 5.3 Okundu takibi (iki ayrı sistem)
- **Sistem A:** `message_reads` tablosu — yalnızca yetim `/chat` sayfası ve ölü `markRoomAsRead` yazıyor;
  BrandOffersList, OffersManager, AdvertApplicationsList bunu okuyor.
- **Sistem B:** `auth.user_metadata["last_read_<roomId>"]` — sidebar ve mesaj kutusu kullanıyor.
- **Sorunlar:**
  - ✅ ~~**5.3-S1 [YÜKSEK]**~~ (`message_reads` tablosu canlıda yok, rozetler hep 0 çıkıyordu; sayım `last_read_<roomId>` metadata ile, `lib/unread-messages.ts`) Teklif ve başvuru ekranlarındaki okunmamış rozetleri hiç temizlenmiyor.
  - **5.3-S2 [ORTA]** (canlıda ölçüldü: en büyük metadata 550 bayt, en çok 4 oda anahtarı; acil değil, mesajlaşma tasarımıyla birlikte `room_reads` tablosuna taşınacak) Sistem B her mesaj sayısı değişiminde metadata yazıyor; her oda için bir anahtar ekleyerek JWT/çerezi şişiriyor;
    aynı kişiyle birleşik odalardan yalnızca seçili oda okundu oluyor.

### 5.4 Bildirimler
- **Dosyalar:** `components/dashboard/NotificationsPopover.tsx`, `app/actions/notifications.ts`, tablo `notifications`
- **Sorunlar:**
  - **5.4-S1 [YÜKSEK]** Yeni teklif, teklif durumu, yeni başvuru, başvuru durumu, yeni mesaj, destek yanıtı için hiçbir bildirim ya da e-posta üretilmiyor.
    Tek üreticiler admin paneli ve Spotlight bildirimi.
  - **5.4-S2 [DÜŞÜK]** Header herkese sabit "PREMIUM" etiketi gösteriyor.

### 5.5 Otomatik mesajlar / hoş geldin mesajı
- **Dosyalar:** `lib/welcome-message.ts`, `app/actions/automated-messages.ts`
- **Sorunlar:**
  - ✅ ~~**5.5-S1 [ORTA]**~~ (olmayan kolonlar kaldırıldı) Hoş geldin mesajı migration'larda olmayan kolonlara yazıyor (`messages.receiver_id`, `is_read`, `rooms.last_message_at`) → büyük ihtimalle sessizce başarısız (doğrulanmadı).
  - ✅ ~~**5.5-S2 [ORTA]**~~ (gönderen en eski admin hesabı; destek@ hesabı hiç yoktu, mesaj hiç gitmiyordu) İki destek kimliği: kod `destek@influmatch.net`'i arıyor, migration `support@influmatch.com` (id `000…0`) ekliyor.
  - **5.5-S3 [DÜŞÜK]** `sendNotification` adı iki modülde farklı imzayla export ediliyor; Spotlight bildirim metni influencer'a yönelik.

### 5.6 Engelleme ve şikayet
- **Dosyalar:** `app/dashboard/users/block/actions.ts`, `app/dashboard/messages/report/actions.ts`, tablolar `user_blocks`, `message_reports`
- **İş:** Çift yönlü engel kontrolü (trigger + aksiyon), mesajlar değiştirilemez (trigger), şikayetler admin'e.
- **Sorunlar:**
  - ✅ ~~**5.6-S1 [ORTA]**~~ (uygulama artık çağırmıyor; istemci rollerinden yetki kaldırıldı) `log_message` RPC'si anon dahil herkese açık; mesaj içeriğini (200 karakter) ve kullanıcı id'lerini Postgres loglarına yazıyor (loglarda kişisel veri, spam edilebilir).
  - **5.6-S2 [DÜŞÜK]** `checkIfBlocked` ve `isUserBlocked` aynı işi yapıyor.

---

## 6. Admin

Tüm admin sayfaları rolü kendi içinde kontrol ediyor; `app/admin/layout.tsx` yok, kontrol bloğu ~25 kez kopyalanmış.

### 6.1 Admin paneli `/admin`
- **Dosyalar:** `app/admin/page.tsx`, `components/admin/AdminPanel.tsx`
- **İş:** Tüm kullanıcılar (service role, `ADMIN_USER_SELECT`), onay bekleyen / doğrulanmış / reddedilmiş sekmeleri, toplu işlemler,
  Spotlight ve rozet modalları, vergi levhası incelemesi, kurumsal e-posta durumu, ilanlar, başvurular, bildirim gönderimi.
- **Sorunlar:**
  - ✅ ~~**6.1-S1 [ORTA]**~~ (oturum kontrolü try dışında; bakım mesajı genelleştirildi) `redirect('/login')` `try` içinde; NEXT_REDIRECT yakalanıp "Bir Hata Oluştu" ekranı gösteriliyor.
  - **6.1-S2 [DÜŞÜK]** (PGRST116 artık rate limit sayılmıyor; bakım mesajı genelleştirildi) `PGRST116` rate limit sayılıyor; eski "21-23 Kasım bakım" mesajı sabit; başka statüdeki kullanıcılar hiçbir listede yok.
  - ✅ ~~**6.1-S3 [ORTA]**~~ (toplu silme deleteUser kullanıyor; kendini/admini silme koruması PR #7) Toplu silme kendini veya başka bir admini silmeye karşı korumasız.

### 6.2 Admin aksiyonları (`app/admin/actions.ts`)

| Aksiyon | İş | Bilinen sorun |
|---|---|---|
| `verifyUser` / `rejectUser` / `updateAdminNotes` | statü ve not | rozet hatasında `revalidatePath` atlanıyor |
| `manuallyAwardBadges` | — | **ölü** |
| `manuallyAwardSpecificBadge` | rozet ver (mavi tik → override) | — |
| `toggleUserSpotlight` | Spotlight aç/kapa, kullanıcıyı otomatik doğrular | hata metninde admin e-postası |
| `verifyTaxId` | vergi onayı → `syncOfficialBusiness` | — |
| `resendVerificationEmail` / `forceVerifyEmail` | auth e-posta işlemleri | site URL'si yoksa localhost'a düşüyor |
| `resetVerifiedBadges` / `setBlueTickOverride` / `toggleBlueTick` | mavi/sarı tik | — |
| `deleteUser` | profil + auth silme | ✅ ~~**6.2-S1 [YÜKSEK]**~~ (ortak silme fonksiyonu; admin kendini ve diğer adminleri panelden silemez) profil silme hatası yalnızca loglanıyor (aktif anlaşma trigger'ı hatası yutuluyor), kendini/admini silme koruması yok |
| `getAllAdverts` / `deleteAdvertAdmin` | ilan yönetimi | dosya yolu `split('/').pop()` → alt klasördeki dosyalar artık kalıyor |
| `adminUpdateInstagramData` | Apify ile IG güncelle | **6.2-S2 [ORTA]** her zaman `is_verified:true` yazıyor, `syncBlueTick` çağırmıyor |
| `adminManualConnectInstagram` | IG'yi elle bağla | hedef rol kontrolü yok, geçmiş satırı yok |
| `getAllApplications` / `getAdminUserCard` / `getTaxDocumentUrl` / `rejectTaxVerification` | okuma, imzalı URL, red | — |

### 6.3 Bildirim gönderimi
- **Dosyalar:** `components/admin/NotificationsPanel.tsx`, `app/actions/notifications.ts`
- **Sorunlar:** **6.3-S1 [DÜŞÜK]** Toplu gönderimde boyut sınırı yok, `link` doğrulanmıyor; "tüm kullanıcılar" sunucu props'undan geliyor.

### 6.4 Geri bildirim yönetimi `/admin/feedback`
- **Dosyalar:** `app/admin/feedback/{page,actions}.ts(x)`, `components/admin/FeedbackAdminPanel.tsx`
- **Sorunlar:** **6.4-S1 [DÜŞÜK]** `admin_notes` gösteriliyor ama yazan aksiyon yok.

### 6.5 Destek yönetimi `/admin/support`
- **Dosyalar:** `app/admin/support/{page,actions}.ts(x)`, `components/admin/SupportTicketsPanel.tsx`
- **Sorunlar:** **6.5-S1 [ORTA]** (kapatılmış talebin yeniden açılması düzeltildi; kullanıcıya bildirim 5.4 ile) `addAdminResponse` kapalı talebi bile `in_progress`'e çekiyor; kullanıcıya bildirim/e-posta gitmiyor.

### 6.6 Mesaj şikayetleri `/admin/messages`
- **Dosyalar:** `app/admin/messages/{page,actions}.ts(x)`, `components/admin/MessageReportsPanel.tsx`
- **Sorunlar:** ✅ ~~**6.6-S1 [YÜKSEK]**~~ (mesaj silinmiyor, içerik sabit metinle değiştiriliyor; orijinal içerik `message_reports.message_snapshot`ta saklanıyor) `deleteMessage` kullanıcı istemcisiyle siliyor; `messages` için DELETE politikası yok (ve silmeyi engelleyen trigger var) →
  0 satır silinip başarı dönüyor. Silme çalışsa bile `ON DELETE CASCADE` şikayet kaydını da siler (denetim izi kaybı).

### 6.7 API anahtar havuzu ekranı `/admin/api-keys`
- **Dosyalar:** `app/admin/api-keys/{page,data,actions}.ts(x)`, `components/admin/ApiKeysPanel.tsx`
- **İş:** Apify/Gemini anahtarlarını ekle, sırala, kapat, sağlık kontrolü, test e-postası. Gizli anahtarlar maskeli.
- **Sorunlar:** **6.7-S1 [DÜŞÜK]** Gemini sağlayıcısı listede ama artık hiçbir modül kullanmıyor (bkz. 8.3-S2); `moveApiKey` transaction'sız.

### 6.8 Manuel Instagram bağlama `/admin/manual-connect`
- **Dosya:** `app/admin/manual-connect/page.tsx`
- **Sorunlar:** **6.8-S1 [ORTA]** Sayfada sunucu tarafı admin kontrolü yok (aksiyon kontrol ediyor); panelden bağlantı yok.

### 6.9 Vergi levhası inceleme
- **Dosya:** `components/admin/TaxVerificationReview.tsx` (AdminPanel içinde). Onay `verifyTaxId`, red `rejectTaxVerification`. Bilinen açık sorun yok.

---

## 7. Veri katmanı (Supabase)

### 7.1 Migration düzeni
- `supabase/schema.sql` (temel) + `supabase/migrations/`: **58 zaman damgasız** eski dosya (`add_*`, `fix_*`, `delete_*`, `test_*`; elle SQL Editor'a yapıştırılmak üzere,
  bazıları yalnızca tanı SELECT'i) + 20241129 → 20261007 zaman damgalı dosyalar. Migration çalıştırıcı yok.
- `supabase/cron/hourly_jobs.sql` — pg_cron + Vault, elle çalıştırılır.
- **Sorunlar:**
  - **7.1-S1 [YÜKSEK]** (kısmen: bilinen sapmalar `20261007000011` ile kapatıldı, `20260316000001` artık influencer_id'yi kendisi ekliyor. Tam doğrulama için repo dosyalarını boş bir veritabanında sırayla çalıştıran bir deneme gerekir) Canlı DB repodan neredeyse kesin sapmış (bkz. 7.6); migration'lar sıfırdan sırayla oynatılamıyor (`20260316000001` var olmayan `influencer_id`'yi kullanıyor).
  - ✅ ~~**7.1-S2 [ORTA]**~~ (`20241209023500` IF NOT EXISTS; `create_user_badges_table` politikaları DROP IF EXISTS + kısıt DO bloğu, rozet ekleme canlıdaki gibi yalnızca admin) Bazı migration'lar idempotent değil (`20241209023500` IF NOT EXISTS'siz, `create_user_badges_table` korumasız ADD CONSTRAINT).
  - ✅ ~~**7.1-S3 [ORTA]**~~ (tasarım gereği güvenli varsayılan: yeni kolon gizli doğar. Kural: herkese açık yeni bir `users` kolonu eklenirken aynı migration'da `GRANT SELECT (kolon) ON public.users TO anon, authenticated;` yazılır) Kolon bazlı yetki (`20260930000001`) sonradan eklenen her kolonu gizliyor; yeni herkese açık kolon için GRANT bloğu tekrar çalıştırılmalı (unutması kolay).

### 7.2 Tablolar

| Tablo | Amaç | Erişim özeti |
|---|---|---|
| `users` | profil, rol, statü, vergi, Spotlight, rozet seçimi, kurumsal e-posta | bkz. 7.3 |
| `social_accounts` | doğrulanmış sosyal hesap + istatistik | SELECT herkese (tüm kolonlar); yazma yalnızca sunucu |
| `social_account_history` | istatistik geçmişi | sahibi/admin okur; yazma yalnızca sunucu |
| `offers` | teklifler | taraflar okur; INSERT yalnızca doğrulanmış marka; kolon kilidi trigger'ı |
| `advert_projects` / `advert_applications` | ilan ve başvuru | açık veya sahibi okur; INSERT doğrulanmış marka; politikalar karışık (7.7) |
| `rooms` / `messages` / `message_reads` | sohbet | katılımcı; oda yalnızca teklif/başvuru bağlantısıyla; mesajlar değiştirilemez |
| `message_reports` / `user_blocks` | şikayet / engel | bildiren ve admin / engelleyen |
| `notifications` | uygulama içi bildirim | sahibi okur; INSERT yalnızca admin |
| `favorites` / `favorite_lists` / `favorite_list_items` | favori ve listeler | sahibi marka |
| `dismissed_offers` | gizlenen teklifler | sahibi |
| `user_badges` | kazanılmış rozetler | SELECT herkese; yazma yalnızca admin/sunucu |
| `support_tickets` / `feedback_submissions` | destek ve geri bildirim | sahibi + admin |
| `analytics_events` | ilan görüntüleme vb. | marka kendi verisini okur; yazma RPC ile |
| `api_keys` / `system_state` | anahtar havuzu ve sistem durumu | yalnızca service role |
| `tax_verifications` | vergi levhası kayıtları | sahibi okur; yazma yalnızca sunucu |
| `corporate_email_verifications` | bekleyen e-posta kodları (hash) | yalnızca service role |

### 7.3 `users` koruma katmanı
- RLS: authenticated herkes okur; anon için SELECT politikası **yok**. Kolon bazlı gizlilik: email, phone, tax_id, tax_office, tax_office_city,
  admin_notes ve sonradan eklenen tüm kolonlar (blue_tick_override, corporate_email…) istemciye kapalı.
- Trigger'lar: `users_before_insert_guard` (güvenli değerler), `users_before_update_guard` (yazılabilir kolon beyaz listesi, vergi doğrulama,
  yasal bilgi değişince onay/sarı tik sıfırlama, kazanılmamış rozet gösterimini engelleme, web sitesi alan adı değişince kurumsal e-posta onayını düşürme),
  `check_user_deletion_integrity`, auth tarafında `handle_new_auth_user`, `on_auth_user_email_verified`, `sync_user_email_from_auth`.
- **Sorunlar:**
  - **7.3-S1 [ORTA]** Beyaz listede `push_notifications_enabled`, `website` var ama bu kolonlar yok; `push_token` ise ne kolon ne beyaz listede (mobil push hiç kaydedilmiyor).
  - **7.3-S2 [YÜKSEK]** (`/api/check-username` düzeldi: service role + oturumdaki kullanıcı; herkese açık profil 1.1-S1 kararına bağlı) Anon SELECT politikası olmadığı için herkese açık profil ve `/api/check-username` (kayıt öncesi her zaman "müsait" der) çalışmıyor.
  - ✅ ~~**7.3-S3 [ORTA]**~~ (canlıda realtime yayınında yalnızca messages var; users yok, sızıntı yolu yok) `users` realtime yayınındaysa `postgres_changes` olayları kolon yetkisine bakmadan tüm satırı gönderebilir → gizli kolon sızıntısı riski (canlıda doğrulanmalı).

### 7.4 RPC'ler ve fonksiyonlar
- **Güvenlik denetimi (2026-10-07):** tetikleyici fonksiyonların RPC çağrı izni kaldırıldı; `get_my_private_profile` /
  `get_offer_contact_email` anon'a kapatıldı; `website_host` search_path sabitlendi (`20261007000014`). Açık kalanlar:
  `is_admin()` anon'a açık (RLS'te kullanılıyor, gerekli); `pg_net` public şemada (taşımak riskli);
  **Auth → sızdırılmış şifre koruması kapalı (panelden açılmalı, kullanıcı)**.
- **Performans denetimi (2026-10-07):** 17 indekssiz yabancı anahtar indekslendi (`20261007000015`). Ertelenenler (mevcut
  ölçekte etkisiz, kural yeniden yazımı riskli): 66 politikada `auth.uid()` satır başına değerlendiriliyor (`(select auth.uid())`
  ile sarılmalı), 123 "çoklu permissive politika" (aynı işlem için birden çok kural; 7.7 temizliğiyle birlikte birleştirilmeli),
  15 kullanılmayan indeks (veri az, yanıltıcı).
- Güvenli: `is_admin()`, `get_my_private_profile()`, `get_offer_contact_email()`, `award_user_badge()` (artık yalnızca admin/sunucu),
  `is_valid_tax_number()`, `website_host()`, `record_api_key_result()` (yalnızca service role).
- **Sorunlar:**
  - ✅ ~~**7.4-S1 [ORTA]**~~ (her iki RPC de anon'a kapalı) `track_analytics_event` ve `log_message` anon dahil herkese açık (bkz. 4.6-S1, 5.6-S1).
  - ✅ ~~**7.4-S2 [ORTA]**~~ (public şemasındaki tüm SECURITY DEFINER fonksiyonlarında search_path = public) SECURITY DEFINER trigger fonksiyonlarının çoğunda `search_path` sabitlenmemiş.
  - **7.4-S3 [DÜŞÜK]** `handle_delete_auth_user` boş taslak, trigger'ı yorumda.

### 7.5 Storage bucket'ları

| Bucket | Tanım | Politika | Risk |
|---|---|---|---|
| `avatars` | elle | public okuma; yazma ilk klasör = uid | web marka/influencer ve mobil yükleme yolları uymuyor |
| `advert-hero-images` | elle | herhangi bir authenticated yükler; sahibi siler | kök dizine yükleme |
| `feedback-images` | elle | aynı desen | destek ekleri de burada (public) |
| `tax-documents` | migration | özel; yalnızca kendi klasörüne INSERT | — |
| `chat-attachments` | **hiçbir yerde** | **yok** | public URL |

- **Sorunlar:**
  - **7.5-S1 [YÜKSEK]** (canlıda doğrulandı: dosya hiç uygulanmamış. Ölü "Tam Yetki" politikalarını silen `20261007000013` toplu SQL'de; "avatars insert" yayındaki mobil sürüm public/<uid>/ yüklediği için mobil sürüm çıkınca kaldırılacak) `20260317000005` dosyası var olmayan `storage.policies` tablosundan DELETE yapıyor; dosyanın tamamı hata verip geri alınmış olabilir
    (avatars politikaları, users SELECT değişikliği ve `track_analytics_event` sertleştirmesi dahil). Canlıda kontrol edilmeli.
  - **7.5-S2 [ORTA]** `chat-attachments` için migration ve politika yazılmalı, özel bucket + imzalı URL'ye geçilmeli.

### 7.6 Şema kayması (kodda var, migration'da yok)
- ✅ ~~**7.6-S1 [YÜKSEK]**~~ (`20261007000011` ile repoya eklendi) `advert_applications.influencer_id` — politikalarda, web ve mobilde kullanılıyor, hiç oluşturulmamış.
- ✅ ~~**7.6-S2 [ORTA]**~~ (`20261007000011`) `social_accounts.verification_code`, `has_stats`, `last_scraped_at` — kod yazıyor; canlıda var olmalı, repoda yok.
- ✅ ~~**7.6-S3 [ORTA]**~~ (`20261007000011`) `users.role='admin'` — `schema.sql` CHECK yalnızca influencer/brand'e izin veriyor; hiçbir migration genişletmiyor.
- **7.6-S4 [DÜŞÜK]** `feedback` tablosu (mobil), `rooms.last_message_at`, `messages.receiver_id`, `messages.is_read`, `advert_projects.brand_id`, `users.push_token`.

### 7.7 Çakışan migration'lar
- ✅ ~~**7.7-S1 [YÜKSEK]**~~ (advert_applications için `20261007000005` canlıda uygulandı) Permissive politikalar OR'lanıyor: `advert_applications` için "kabul edilmişse silinemez" kuralı eski serbest politika düşürülmediği için etkisiz;
  doğrulanmamış influencer da başvurabiliyor.
- **7.7-S2 [ORTA]** (canlıda doğrulandı: şartsız INSERT/UPDATE ve `qual=true` SELECT kuralları duruyor; `20261007000009` elle çalıştırılacak) Eski `fix_advert_projects_rls.sql` uygulanmışsa doğrulanmamış markalar ilan açabilir.
- **7.7-S3 [DÜŞÜK]** `handle_new_auth_user` 8 kez yeniden tanımlanmış; `spotlight_plan` CHECK → enum → enum geçişi kayıplı eşleme yapmış, kodda hâlâ `'basic'|'pro'` cast'i var.

---

## 8. Altyapı ve entegrasyonlar

### 8.1 API route'ları

| Route | Yetki | İş |
|---|---|---|
| `GET /api/auth/{instagram,tiktok}/login` · `callback` | oturum + state çerezi | OAuth bağlama (2.3) |
| `POST /api/mobile/verify-{instagram,tiktok}` | Bearer JWT | mobil bio doğrulama (2.1-S1: sınırsız) |
| `GET /api/cron/refresh-stats` | `Bearer CRON_SECRET` | günlük istatistik yenileme (2.2) |
| `GET /api/cron/hourly` | `Bearer CRON_SECRET` | anahtar sağlık kontrolü + e-posta, mavi tik taraması |
| `POST /api/award-badges` | admin | rozet verme (2.6-S1) |
| `GET /api/check-username` | yok | kullanıcı adı müsaitliği (7.3-S2) |
| `GET /api/test-welcome` | yok | 410 dönen ölü taslak |
| `GET /auth/callback` | — | e-posta bağlantısı; her zaman çıkış yaptırıyor (1.4-S1) |

### 8.2 Zamanlanmış işler
- **Vercel cron** (`vercel.json`): `refresh-stats` her gün 09:00 UTC.
- **Supabase pg_cron** (`supabase/cron/hourly_jobs.sql`): her saat `/api/cron/hourly`, gizli anahtar Vault'ta.
- **Sorunlar:** ✅ ~~**8.2-S1 [YÜKSEK]**~~ (Spotlight kısmı) Süresi dolan Spotlight'ı kapatan bir iş yok (4.3-S1); `refresh-stats` zaman aşımı (2.2-S2).

### 8.3 API anahtar havuzu
- **Dosyalar:** `lib/api-keys.ts` (`withApiKey`, otomatik geçiş, bekleme süreleri), `lib/apify.ts`, `lib/gemini.ts`, `lib/api-key-health.ts`
- **Sorunlar:**
  - **8.3-S1 [DÜŞÜK]** `isKeyUsable` bekleme süresi olmayan `exhausted`/`error` anahtarları yine deniyor.
  - **8.3-S2 [DÜŞÜK]** `generateGeminiContent` ve `@google/generative-ai` paketi kullanılmıyor (vergi kontrolü yerelde).
  - **8.3-S3 [DÜŞÜK]** `fetch` çağrılarında zaman aşımı yok.

### 8.4 E-posta (Resend)
- **Dosya:** `lib/email.ts` (`sendEmail`, `sendAdminAlertEmail`). Kullanım: admin uyarıları, kurumsal e-posta kodları.
- **İzleme:** `lib/resend-status.ts` — her gönderimde Resend kota başlıkları kaydedilir; anahtar, gönderici alan adı ve kota durumu `/admin/api-keys` sayfasında ve saatlik kontrolde.
- **Sorunlar:**
  - **8.4-S1 [YÜKSEK]** Ücretsiz plan günde 100, ayda 3000 e-posta. Kurumsal e-posta kodları ve admin uyarıları aynı kotayı paylaşıyor; kota dolunca markalara kod gitmez. İzleme ve uyarı eklendi, risk sürüyor (çözüm: ücretli plan veya ikinci sağlayıcı).
  - bkz. 3.11-S2 ve 5.4-S1 (kullanıcıya işlem e-postası yok).

### 8.5 Konfigürasyon
- `next.config.js`, `vercel.json`, `package.json`, `middleware.ts`
- **Sorunlar:**
  - ✅ ~~**8.5-S1 [ORTA]**~~ (yalnızca Supabase deposu ve Instagram/TikTok CDN'leri; optimize görseller 31 gün önbellekte) `images.remotePatterns hostname: '**'` → görsel optimizasyonu açık proxy (maliyet/kötüye kullanım).
  - ✅ ~~**8.5-S2 [ORTA]**~~ (main'de Next 14.2.35) Next 14.0.4 eski ve güvenlik yamaları eksik; yükseltilmeli.
  - ✅ ~~**8.5-S3 [DÜŞÜK]**~~ (next-intl, pg, xlsx, uuid kaldırıldı; dev script'i platformdan bağımsız) Kullanılmayan bağımlılıklar: `@google/generative-ai`, `pg`, `xlsx` (bilinen açıkları var), `uuid`; `next-intl` yalnızca ölü layout'ta.
    `dev` script'i Windows'a özel `set` sözdizimi.

### 8.6 Ortam değişkenleri

| Değişken | Amaç |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | istemciler |
| `SUPABASE_SERVICE_ROLE_KEY` | admin istemcisi, cron, sosyal istatistik, vergi |
| `CRON_SECRET` | iki cron route'u |
| `APIFY_API_TOKEN`, `GEMINI_API_KEY`, `GEMINI_MODEL` | havuza tek seferlik aktarım |
| `RESEND_API_KEY`, `EMAIL_FROM`, `ALERT_EMAIL_TO`, `ALERT_EMAIL_FROM` | e-posta |
| `TAX_AUTO_APPROVE` | vergi levhası otomatik onayı (varsayılan kapalı) |
| `INSTAGRAM_CLIENT_ID/SECRET`, `TIKTOK_CLIENT_KEY/SECRET` | OAuth |
| `NEXT_PUBLIC_SITE_URL` | yönlendirme, e-posta linkleri, sitemap |
| `SUPABASE_DB_URL` | `env.example`'da var, kullanılmıyor |

### 8.7 Gizli bilgiler ve repo hijyeni
- ✅ ~~**8.7-S1 [KRİTİK]**~~ (dosya silindi; anahtarın sağlayıcıda iptali kullanıcıda) `test-rocket-reels-debug.js` dosyasında canlı görünen bir RocketAPI anahtarı commit'lenmiş. Anahtar iptal edilip yenilenmeli,
  dosya silinmeli (git geçmişinde kalacağı için iptal şart).
- ✅ ~~**8.7-S2 [DÜŞÜK]**~~ (takipten çıkarıldı) `.env.local.txt` `.gitignore`'a rağmen takip ediliyor (yalnızca URL + anon key).
- ✅ ~~**8.7-S3 [DÜŞÜK]**~~ (başıboş dosyalar silindi) Başıboş dosyalar: `validate_json.js`, `fix_turkish.js`, `crop_icon.py`, boş `types.ts`, `tsc_output.txt`, `tasarim-sistemi-analizi.txt`.
- ✅ ~~**8.7-S4 [ORTA]**~~ (JSON-LD, sitemap ve robots influmatch.net) Alan adı tutarsızlığı: sitemap/robots/JSON-LD `influmatch.com`, geri kalan her şey `influmatch.net`.

### 8.9 Ürün notu: dosya depolama ("Drive" yapısı)
- **8.9-N1** Siteye Drive benzeri bir dosya yapısı kurulacak (karar, 7 Ekim): görseller ve dosyalar (avatar, logo, ilan kapakları,
  sohbet ekleri, vergi belgeleri) için düzenli klasör yapısı ve daha düşük depolama/aktarım maliyeti. Bugünkü durum: Supabase
  Storage'da `avatars` (çoğu `{uid}/` klasöründe, eskiler kökte), `advert-hero-images` ve `feedback-images` (kökte, rastgele ad),
  `chat-attachments` (`{uid}/{oda}/...`), `tax-documents` (özel). Hepsi herkese açık URL ile servis ediliyor (vergi hariç),
  görsel boyutlandırma Vercel'de. Tasarımda düşünülecekler: yüklemede boyut/format küçültme (ör. WebP, en fazla 1080 px),
  kullanıcı/varlık bazlı klasörler, silinen kayıtların dosyalarının temizlenmesi (hesap silmede yapılıyor), gizli dosyalar için
  imzalı URL, gerekirse ucuz depolama (ör. Cloudflare R2) ve CDN.

### 8.8 Dokümanlar
- Kökteki `DEPLOYMENT.md`, `FINAL_DEPLOYMENT_CHECKLIST.md`, `SUPABASE_SETUP_CHECKLIST.md`, `TRIGGER_SETUP.md`, `SUPABASE_RLS_FIX.md`,
  `MIGRATION_INSTRUCTIONS.md`, `CLEAN_START_GUIDE.md`, `GITHUB_PUSH_GUIDE.md`, `VERCEL_FIX.md`, `VERCEL_ROOT_DIRECTORY_FIX.md`, `README.md`.
- **8.8-S1 [DÜŞÜK]** Hepsi eski; `VERCEL_FIX.md` ile `VERCEL_ROOT_DIRECTORY_FIX.md` çelişiyor; CRON_SECRET, Resend, anahtar havuzu, pg_cron, bucket'lar ve migration sırası anlatılmıyor.

---

## 9. Landing ve SEO

### 9.1 Ana sayfa
- **Dosyalar:** `app/page.tsx`, `components/landing/*` (Hero, PartnersSection, Spotlight, FeaturesSection, DetailedStatsSection, VerificationCTA,
  ValueProposition, FAQSection, BadgesSection, Footer)
- **Sorunlar:**
  - ✅ ~~**9.1-S1 [ORTA]**~~ (ana sayfa vitrini is_showcase_visible=true filtreliyor) Vitrin `is_showcase_visible`'ı yok sayıyor; gizlenmiş profiller ana sayfada çıkabilir.
  - **9.1-S2 [ORTA]** PartnersSection TikTok, Instagram, Meta, YouTube, Google logolarını "partner" olarak gösteriyor (ortaklık izlenimi / marka hakkı riski).
  - **9.1-S3 [DÜŞÜK]** Sabit pazarlama rakamları ("%5.2", "10K+", "50+", "%100"); Footer'da kırık linkler (`/discover`, `/legal/privacy`); production'da `console.log`.

### 9.2 Sitemap ve robots
- **Dosyalar:** `app/sitemap.ts`, `app/robots.ts`
- **Sorunlar:**
  - ✅ ~~**9.2-S1 [YÜKSEK]**~~ (profiller site haritasından çıkarıldı, robots `/profile/` engelliyor; varsayılan alan adı influmatch.net) `/profile/*` ilan ediliyor ama giriş istiyor (1.1-S1); sitemap gizli profilleri de listeliyor ve sınırsız.
  - **9.2-S2 [DÜŞÜK]** robots var olmayan `/verify-phone`'u engelliyor, `/chat/`'i engellemiyor.

### 9.3 Statik ve ölü sayfalar
- `/spotlight` (fiyatlar), `/badges` (katalog), `/cekilis` (404'e yönlendiriyor).
- ✅ ~~**9.3-S1 [ORTA]**~~ (app/cekilis silindi) `app/cekilis/actions.ts`: `'use server'` dosyasında altı gerçek isim ve sabit 6 haneli PIN'ler. Kullanılmıyor; silinmeli.
- **9.3-S2 [DÜŞÜK]** `app/[locale]/layout.tsx` yalnızca layout, sayfası yok, ikinci `<html>` üretir; next-intl yapılandırılmamış.

---

## 10. Mobil uygulama (`mobile-app/`)

### 10.1 Yığın ve ekranlar
- Expo SDK 54, React Native 0.81, React Navigation 7, NativeWind, supabase-js (AsyncStorage oturumu), expo-notifications.
- **Auth:** Login, ForgotPassword, RegisterRole, RegisterForm, VerifyEmail, Onboarding.
- **Influencer:** Dashboard, Discover, Proposals, Messages, Profile + Spotlight, Badges, Analysis, Verification, Statistics, MyProfile, InfluencerDetail.
- **Marka:** BrandDashboard, Discover, BrandAdverts, BrandMessages, BrandProfile + BrandVerification.
- **Ortak:** Settings, Feedback, AiAssistant.

### 10.2 Kimlik ve veri erişimi
- Supabase e-posta/şifre; neredeyse her şey anon key + kullanıcı JWT'si ile doğrudan PostgREST'e gidiyor.
  Tek sunucu API'si `/api/mobile/verify-*`; geliştirmede `API_BASE` LAN IP'sine sabit.
- `app.json` varsayılan slug/ad ("mobile-app").

### 10.3 Web kurallarıyla uyumsuzluklar
- **10.3-S1 [YÜKSEK]** Influencer sosyal doğrulama zorunluluğu mobilde yok (web'de de yalnızca arayüz kapısı; DB zorlamıyor).
- **10.3-S2 [YÜKSEK]** Marka doğrulama ekranı: VKN/TCKN istemci kontrolü yok, vergi dairesi/il yok, vergi levhası yükleme yok, kurumsal e-posta yok;
  `verification_status` yazımı beyaz liste tarafından sessizce düşürülüyor.
- ✅ ~~**10.3-S3 [YÜKSEK]**~~ (brand_id kullanılıyor; kalp yalnızca markalara) Favoriler bozuk (`user_id` kolonu kullanılıyor, tablo `brand_id`); influencer'lara da kalp gösteriliyor.
- **10.3-S4 [YÜKSEK]** Doğrudan sohbet engelleniyor (`InfluencerDetailScreen.js` bağlantısız oda açıyor).
- ✅ ~~**10.3-S5 [YÜKSEK]**~~ (influencer_user_id de gönderiliyor) İlana başvuru bozuk (`influencer_user_id` NOT NULL, yalnızca `influencer_id` gönderiliyor).
- ✅ ~~**10.3-S6 [ORTA]**~~ (`<uid>/…` yolu) Avatar yüklemeleri `public/<uid>/…` yoluna gidiyor, politika ihlali (MyProfile hariç).
- **10.3-S7 [ORTA]** Push token'ları ve bildirim tercihi hiç kaydedilmiyor (7.3-S1).
- ✅ ~~**10.3-S8 [ORTA]**~~ (`feedback_submissions`'a yazıyor, hata gösteriliyor) Geri bildirim var olmayan `feedback` tablosuna gidiyor ama başarı gösteriliyor.
- **10.3-S9 [ORTA]** (sahte güven skoru satırı kaldırıldı; kullanılmıyordu) Keşfette doğrulanmamış istatistikler ve sahte güven skoru (`75 + charCode % 22`).
- **10.3-S10 [ORTA]** AiAssistant ekranı sabit cevaplı sahte sohbet; şifre sıfırlama kırık (1.4-S1); signup `creator_type` göndermiyor.
- **10.3-S11 [DÜŞÜK]** İlan ekleme var olmayabilecek `brand_id` kolonu gönderiyor; kapak görseli klasörsüz.

---

### 10.4 Notlar
- **10.4-N1** `@testermobilapp` (marka, auth e-postası geçici bir test adresi) mobil uygulama testleri için bilinçli olarak tutuluyor; silinmeyecek (karar, 7 Ekim).

## 11. Ölü kod envanteri

| ID | Öğe |
|---|---|
| 11.1 | `app/[locale]/layout.tsx`, `components/providers/SupabaseProvider.tsx` |
| 11.2 | `app/cekilis/*` (sabit PIN'li) |
| 11.3 | `app/api/test-welcome` |
| 11.4 | `app/chat/[roomId]` + `components/chat/ChatWindow.tsx` (yetim), `markRoomAsRead` |
| 11.5 | `app/auth/verify-email` |
| 11.6 | `InflistCard.tsx`, `getLists`, `InfluencerOffersFeed` bileşeni, `undismissInfluencer`, `undismissOffer`, `cancelApplication` |
| 11.7 | `manuallyAwardBadges`, iki `updateDisplayedBadges` (influencer ve marka), brand settings re-export dosyaları |
| 11.8 | `components/showcase/ProfileCard.tsx`, `VerificationPromoCard.tsx` |
| 11.9 | `lib/gemini.ts → generateGeminiContent`, `@google/generative-ai`, `pg`, `xlsx`, `uuid` |
| 11.10 | `checkIfBlocked` (kopya), `MessagesPage` içindeki kullanılmayan `ChatWindow` importu |
| 11.11 | Kök dizindeki başıboş script ve notlar (8.7-S3), eski deploy dokümanları (8.8) |

---

### 11.1 Bekleyen elle testler (kullanıcı yapacak)
- **T1** Marka doğrulama kilidi (1.8-S4, PR #17): doğrulanmış marka hesabıyla Keşfet, İlanlar, Favoriler, AI öneriler, Teklifler normal açılmalı;
  doğrulanmamış markada bu sayfalar kilit ekranı göstermeli, ana sayfa/profil/ayarlar/rozetler açık olmalı.
- **T2** Instagram hızlı doğrulama (PR #12): kodla hesap ekleyip "Kontrol et" süresi.

### 11.3 Elle çalıştırılacak SQL'ler (kullanıcı kararı: en sonda tek dosyada toplu gönderilecek)
- **Kural (kullanıcı, 2026-10-07):** risksiz şema düzeltmeleri (kısıt genişletme, indeks, idempotent kolon) doğrudan
  canlıya uygulanır ve migration dosyasına yazılır; uygulanamayanlar (DROP POLICY vb.) bu listede birikir ve en sonda
  sırasıyla toplu verilir.
- Canlıya doğrudan uygulananlar: `20261007000010` favoriler tekil indeksi; `20261007000011` başvuru `shortlisted`, ilan `paused`; `20261007000012` geri bildirimde admin rolü. `20261007000014` tetikleyici fonksiyonlarda EXECUTE kaldırıldı, iki RPC anon'a kapatıldı, `website_host` search_path. `20261007000015` 17 yabancı anahtar indeksi.
- `sohbet_ekleri_kurali.sql` → `20261007000007` politika kısmı (chat-attachments oda katılımcısı kuralı, 5.1-S5)
- `geri_bildirim_gorselleri_kurali.sql` → `20261007000008` DROP POLICY kısmı (kova zaten gizli, 1.10-S1)
- `ilan_kurallari_temizlik.sql` → `20261007000009` (gevşek advert_projects kuralları, 7.7-S2)
- `20261007000013` ölü avatars "Tam Yetki" politikaları (7.5-S1)
- (mobil sürüm sonrası) `DROP POLICY "avatars insert"` (7.5-S1)

### 11.2 Mobil dondurma (kullanıcı kararı, 2026-10-07)
- Mobil uygulamaya bir süre dokunulmayacak; önce web tamamlanacak, mobil entegrasyonlar web'e göre yapılacak.
  **Hatırlatılacak.** O zamana kadar açık mobil maddeler (bölüm 10.3) bekliyor. PR #22'deki mobil düzeltmeler
  (favoriler, başvuru, avatar yolu, geri bildirim) repoda, bir sonraki mobil sürümle yayına çıkar.
  Mobil sürüm çıkınca: `avatars insert` politikası kaldırılacak (7.5-S1).

## 12. Öncelik sırası

Önerilen düzeltme sırası (önce güvenlik ve para, sonra kırık akışlar):

| Sıra | ID | Konu |
|---|---|---|
| 1 | 8.7-S1 | Repodaki RocketAPI anahtarını iptal et, dosyayı sil |
| 2 | 1.8-S1 | Rolü her yerde DB'den oku; `/dashboard/brand` ve `/dashboard/influencer` için rol koruyan layout |
| 3 | 2.1-S1, 2.2-S1 | Apify harcamasına sunucu tarafı sınır ve kilit |
| 4 | 4.3-S1, 8.2-S1 | Süresi dolan Spotlight'ı saatlik işte kapat |
| 5 | 2.2-S2 | `refresh-stats` cron'unu parçala / `maxDuration` |
| 6 | 7.5-S1, 7.6, 7.1-S1 | Canlı DB ile repo arasındaki farkı çıkar; tek bir "baseline" migration üret |
| 7 | 1.1-S1, 7.3-S2, 9.2-S1 | Herkese açık profil kararını ver (anon okuma + middleware + sitemap) |
| 8 | 5.1-S1, 10.3-S4 | Doğrudan sohbet: kurala izin ver ya da butonu kaldır |
| 9 | 5.3-S1 | Okundu takibini tek sisteme indir |
| 10 | 3.7-S1, 3.7-S2 | İlan düzenleme ve veri kaybı |
| 11 | 3.9-S1, 3.9-S2, 2.7-S2 | Avatar/logo yükleme yolu, sosyal linklerin silinmesi |
| 12 | 1.4-S1 | Şifre sıfırlama akışı (web + mobil) |
| 13 | 1.9-S1, 6.2-S1, 1.8-S2 | Hesap silme tutarlılığı |
| 14 | 6.6-S1 | Admin mesaj silme |
| 15 | 5.4-S1, 1.9-S5 | Teklif/başvuru/mesaj bildirimleri ve e-postaları |
| 16 | 4.4-S1, 2.10-S1, 2.5-S1 | Benzer profiller, istatistik sayfası, güven kartı |
| 17 | 4.6-S1, 5.6-S1, 7.4-S2 | Herkese açık RPC'ler, `search_path` |
| 18 | 8.5-S1, 8.5-S2 | Görsel proxy, Next.js yükseltmesi |
| 19 | 10.3-* | Mobil uyumsuzluklar |
| 20 | 11.* | Ölü kod temizliği |

---

## 13. Bu dalda tamamlananlar

`claude/verification-and-api-key-pool` dalında yapılan ve haritada artık sorun olarak listelenmeyen işler:

- VKN/TCKN checksum (TS + SQL), yasal bilgi değişince vergi onayı ve sarı tikin düşmesi.
- `award_user_badge` RPC'sinin anon'a açık olması kapatıldı (yalnızca admin/sunucu).
- Onaylanan her markaya otomatik sarı tik verilmesi kaldırıldı.
- Apify/Gemini çoklu anahtar havuzu, otomatik geçiş, admin ekranı, saatlik sağlık kontrolü + özet e-posta (pg_cron).
- Influencer/UGC için kayıtta ve girişte zorunlu sosyal hesap doğrulama.
- Yeni mavi tik kuralı (Spotlight × performans × güven eşiği), eski tiklerin kaldırılıp yeniden değerlendirilmesi.
- Vergi levhasının dış servis olmadan yerelde doğrulanması, admin inceleme ekranı, otomatik onay varsayılan kapalı.
- Kurumsal e-posta (şirket alan adı) zorunluluğu ve sarı tik için kodla doğrulama.
- Admin `toggleBlueTick`'in `displayed_badges`'i ezmesi ve `rejectTaxVerification`'ın onaylı kaydı reddedebilmesi düzeltildi.
