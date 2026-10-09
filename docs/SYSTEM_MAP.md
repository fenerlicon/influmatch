# Influmatch Sistem Haritası

> Son güncelleme: 2026-10-10 (3.18) · Çalışma kuralları ve devir notu: kökteki `CLAUDE.md`
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
  - ✅ ~~**1.1-S1 [YÜKSEK]**~~ (kullanıcı kararı 2026-10-07: profiller yalnızca giriş yapanlara görünür; mevcut davranış doğru) `/profile` korumalı; herkese açık `/profile/[username]` sayfaları anonim ziyaretçiyi ve
    arama motorlarını `/login`'e atıyor. Sitemap ve robots bu sayfaları ilan ediyor → SEO fiilen kırık (bkz. 9.2).
  - ✅ ~~**1.1-S2 [ORTA]**~~ (marka/influencer layout'ları zaten DB rolüne bakıyordu; `app/admin/layout.tsx` eklendi, admin bölümü de merkezi kontrolde. Middleware'e her istekte DB sorgusu eklenmedi) Yalnızca oturum varlığı kontrol ediliyor, rol kontrolü yok; admin/marka/influencer ayrımı sayfalara kalmış.
  - ✅ ~~**1.1-S3 [DÜŞÜK]**~~ (giriş sonrası `redirectedFrom` yalnızca site içi yolsa kullanılıyor) `redirectedFrom` parametresi ekleniyor ama `app/login/page.tsx` okumuyor; giriş hep `/dashboard`'a gider.

### 1.2 Supabase istemcileri
- **Dosyalar:** `utils/supabase/server.ts`, `client.ts`, `admin.ts` (service role, anahtar yoksa `null`),
  `components/providers/AuthProvider.tsx`, `SupabaseProvider.tsx`
- **Sorunlar:**
  - ✅ ~~**1.2-S1 [DÜŞÜK]**~~ (`@supabase/ssr` `createBrowserClient` tarayıcıda tek örnek; AuthProvider ve doğrudan çağıranlar aynı istemciyi paylaşıyor) İki farklı tarayıcı istemci fabrikası; bazı bileşenler her render'da yeni istemci açıyor
    (`SidebarLink.tsx`, `NotificationsPopover.tsx`, `AdvertApplicationsList.tsx`) → ayrı realtime soketleri.
  - ✅ ~~**1.2-S2 [DÜŞÜK]**~~ (admin rozet sıfırlama da `createSupabaseAdminClient` kullanıyor; dinamik importlar statik yapıldı) Service‑role istemcisi farklı yollarla kuruluyor (`createClient(..., SERVICE_ROLE_KEY!)`:
    `app/admin/actions.ts`, `app/dashboard/brand/advert/actions.ts`).
  - ✅ ~~**1.2-S3 [DÜŞÜK]**~~ (ölü `[locale]` layout'u ve `SupabaseProvider` silindi) `SupabaseProvider` yalnızca ölü `app/[locale]/layout.tsx` tarafından kullanılıyor.
  - ✅ ~~**1.2-S4 [ORTA]**~~ (`@supabase/ssr` 0.8: sunucu, middleware ve tarayıcı istemcileri geçirildi; eski dizi biçimli oturum çerezleri middleware'de `lib/supabase/legacy-session-cookie.ts` ile yeni biçime çevriliyor, kimse çıkış yapmıyor. `auth-helpers-react` yalnızca bağlam/kanca olarak kaldı) `@supabase/auth-helpers-nextjs` 0.10 kullanımdan kalkmış paket; `@supabase/ssr`'a geçilmeli.

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
  - ✅ ~~**1.4-S2 [DÜŞÜK]**~~ (sabit metin gösteriliyor) `?error=rate_limit&message=` URL'deki metni ekrana basıyor (React kaçışlıyor ama içerik saldırgan kontrolünde).
  - ✅ ~~**1.4-S3 [DÜŞÜK]**~~ (silme sonrası `/login?deleted=true` → "Hesabınız ve verileriniz silindi") `account_deleted` dalı ölü; kullanılmayan `supabase` değişkeni.

### 1.5 E-posta doğrulama
- **Dosyalar:** `app/auth/check-email/page.tsx` (OTP), `app/auth/callback/route.ts` (bağlantı),
  `app/auth/verify-email/page.tsx` (yetim), `components/dashboard/EmailVerificationBanner.tsx`
- **Sorunlar:**
  - ✅ ~~**1.5-S1 [ORTA]**~~ (PKCE bağlantısı da oturumu açık bırakıp /dashboard'a gidiyor; token_hash/access_token yolları giriş CSRF'ine karşı oturumu kapatmaya devam ediyor) OTP yolu kullanıcıyı oturum açık bırakıp `/onboarding`'e, bağlantı yolu oturumu kapatıp `/login`'e götürüyor; iki farklı son durum.
  - ✅ ~~**1.5-S2 [ORTA]**~~ (tekrar etmiyor: canlıda son 30 günün kayıtları 6 haneli kodla onaylanmış; yorum düzeltildi) Kodda "user gets 8" yorumu var, arayüz 6 hane kabul ediyor. Supabase projesinde OTP uzunluğu 8 ise doğrulama imkânsız (doğrulanmadı).
  - ✅ ~~**1.5-S3 [ORTA]**~~ (tekrar etmiyor: Supabase onayı zorunlu tutuyor; onaysız 20 hesabın hiçbiri giriş yapamamış) E-posta onayı zorunlu değil; dashboard yalnızca banner gösteriyor.
  - ✅ ~~**1.5-S4 [DÜŞÜK]**~~ (yetim sayfa silindi) `/auth/verify-email` hiçbir yerden bağlanmıyor, `alert()` kullanıyor.

### 1.6 Onboarding profil formu
- **Dosyalar:** `app/onboarding/page.tsx`, `app/onboarding/actions.ts` (`saveOnboardingProfile`),
  `components/onboarding/{AvatarUploader,BrandForm,InfluencerForm}.tsx`
- **İş:** Profil + (marka için) vergi bilgileri, web sitesi ve kurumsal e-posta. Taslak localStorage'da.
  Kaydettikten sonra influencer `/onboarding/verify`'a, marka `/dashboard`'a gider. Marka için kurumsal e-postaya kod gönderilir.
- **Sorunlar:**
  - ✅ ~~**1.6-S1 [ORTA]**~~ (taslak yalnızca DB'de boş alanları dolduruyor; varsayılanlar birleştirmeden sonra; DB avatarı öncelikli) localStorage taslağı DB değerlerinin üzerine yazıyor; eski taslak yeni profili ezebilir.
  - ✅ ~~**1.6-S2 [DÜŞÜK]**~~ (sabit 'tech' kaldırıldı; kategori yalnızca seçilince yazılıyor, mevcut değer silinmiyor) Marka kategorisi `'tech'` olarak sabit (`page.tsx`).
  - ✅ ~~**1.6-S3 [DÜŞÜK]**~~ (onboarding ve profil kayıtlarında ham DB hata metni yerine genel mesaj; avatar/logo adresi sunucuda `lib/avatar-url.ts` ile yalnızca kullanıcının `avatars/{id}/` klasörü veya mevcut değer olarak kabul ediliyor) RLS hata metni kullanıcıya gösteriliyor; `avatar_url` istemciden gelen herhangi bir string.

### 1.7 Onboarding sosyal doğrulama adımı
- **Dosyalar:** `app/onboarding/verify/page.tsx`, `components/onboarding/SocialVerificationStep.tsx`
- **İş:** Doğrulanmış IG/TikTok hesabı olmayan influencer'ı bio kodu akışına sokar (detay 2.1).
- **Sorunlar:** ✅ ~~**1.7-S1 [DÜŞÜK]**~~ (2026-10-10, kullanıcı kararı: tek kaynak `app/legal/page.tsx`; doğrulama ekranlarındaki "Sözleşmeleri" bağlantısı `/legal?tab=terms`'e gidiyor, kısa kopya `lib/legal-constants.ts` ve `LegalModal` silindi. Metinlerin hukuki içeriği avukat yazınca güncellenecek) Yasal metin iki kopya (`lib/legal-constants.ts` ve `app/legal/page.tsx`).

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
  - ✅ ~~**1.9-S3 [DÜŞÜK]**~~ (hesap silmede şifre tekrar soruluyor; doğrulama oturum saklamayan ayrı istemciyle) Silme modalı "abonelikleriniz iptal edilecek" diyor, Spotlight iptal edilmiyor; şifre tekrar sorulmuyor.
  - ✅ ~~**1.9-S4 [DÜŞÜK]**~~ (hata türüne göre mesaj) `changePassword` her hatayı "en az 6 karakter" olarak raporluyor.
  - ✅ ~~**1.9-S5 [ORTA]**~~ (bildirim e-postaları `email_notifications` tercihlerine uyuyor (teklif, başvuru, mesaj, güncellemeler)) `email_notifications` tercihleri kaydediliyor ama hiçbir kod bu tercihlere göre e-posta göndermiyor (bkz. 5.4).

### 1.10 Destek talepleri (kullanıcı tarafı)
- **Dosyalar:** `components/settings/{SupportSection,SupportTicketForm,SupportTicketsList}.tsx`,
  `app/dashboard/influencer/settings/support/actions.ts`
- **Sorunlar:**
  - ✅ ~~**1.10-S1 [ORTA]**~~ (admin ekranları 10 dk imzalı bağlantı kullanıyor; kova gizli, herkese okuma kuralının silinmesi elle çalıştırılacak) Ekler herkese açık `feedback-images` bucket'ına gidiyor ve public URL alıyor (gizlilik).
  - ✅ ~~**1.10-S2 [DÜŞÜK]**~~ (kullanıcı ve admin aynı sabit kodu görüyor: talep kimliğinin ilk 8 karakteri, `lib/support-ticket.ts`) "Talep numarası" kullanıcının talep sayısı + 1; saklanmıyor, yarış durumuna açık.
  - ✅ ~~**1.10-S3 [DÜŞÜK]**~~ (yeni talep anında listeye ekleniyor; seçim değişince kanal yeniden açılmıyor) Yeni talep realtime gelene kadar listede görünmüyor; seçim değişince realtime yeniden aboneleniyor.

### 1.11 Geri bildirim
- **Dosyalar:** `app/feedback/page.tsx`, `app/feedback/actions.ts`, `app/feedback/thank-you/page.tsx`
- **Sorunlar:** ✅ ~~**1.11-S1 [ORTA]**~~ (geri bildirim görseli ve destek eki yalnızca feedback-images kovasındaki `feedback-<uuid>` / `support-ticket-<uuid>` adresiyse kaydediliyor, `lib/attachment-url.ts`; destek talebinde ham DB hata metni artık gösterilmiyor) `imageUrl` istemciden gelen herhangi bir URL; `next/image` her host'u optimize ediyor (bkz. 8.5-S1).

### 1.12 Yasal sayfalar
- **Dosya:** `app/legal/page.tsx` (KVKK, şartlar, çerezler — inline JSX)
- **Sorunlar:**
  - ✅ ~~**1.12-S1 [ORTA]**~~ (footer linki `/legal?tab=privacy`; KVKK metni içeriği ayrı iş) Footer `/legal/privacy`'e bağlanıyor, böyle bir rota yok. Metin `lib/legal-constants.ts` ile ikiye bölünmüş; KVKK metni ince.
  - ✅ ~~**1.12-S2 [ORTA]**~~ (2026-10-10, kullanıcı kararı "şimdi ekle": kök layout'ta `components/consent/CookieConsent.tsx` — "Yalnızca zorunlu" / "Tümünü kabul et" + `/legal?tab=cookies` bağlantısı; tercih `im_cookie_consent` birinci taraf çerezinde 12 ay. Sitede zorunlu olmayan tek araç Vercel Speed Insights; artık yalnızca "Tümünü kabul et" sonrası yükleniyor. Banner metni ve çerez politikası **avukat onayından geçmeli**; çerez politikasındaki "Google Analytics" / "pazarlama çerezleri" ifadeleri sitede kullanılmayan araçları anıyor, avukat metniyle düzeltilmeli. Tercihi sonradan değiştirme bağlantısı yok (çerez silinince banner yeniden çıkar)) Çerez tercihi alınmıyordu; Speed Insights onaysız yükleniyordu.

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
  - ✅ ~~**2.1-S6 [DÜŞÜK]**~~ (yanıltıcı "Son 21 Gün" / "Son 6 gönderi" etiketleri kaldırıldı) Analiz penceresi (30 gün / 24 gönderi) ile scraper limiti (15) ve arayüz etiketleri ("Son 21 Gün", "Son 6 gönderi") uyuşmuyor.
  - ✅ ~~**2.1-S7 [ORTA]**~~ (aynı doğrulanmış hesap için yeni kod üretilmiyor, doğrulama düşmüyor; farklı hesaba geçiş bilinçli değişiklik) Doğrulanmış hesapta yeniden kod üretmek hesabı doğrulanmamışa çeviriyor; tek hesapsa kullanıcı dashboard'dan kilitlenir.
  - ✅ ~~**2.1-S8 [DÜŞÜK]**~~ (2026-10-09: mobil `select('*')` okumaları açık kolon listesine çevrildi; kolon yetkisi `2026-10-09_mobil_sikilastirma.sql` ile kapanıyor) (2026-10-08: kolon yetkisiyle kapatılamıyor; yayındaki mobil sürüm `social_accounts`'u `select('*')` ile okuyor, kolon kapatılırsa mobil bozulur. Mobil sürümle birlikte. canlıda kontrol edildi: jeton kolonu yok; okunabilen doğrulama kodu başkasının biyografisine yazılamayacağı için işe yaramaz. Düşük) `social_accounts` SELECT herkese açık (`USING(true)`, tüm kolonlar); `verification_code` okunabilir.

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
- **Karar (2026-10-10):** OAuth mobil uygulamanın mağaza yayınından **sonra** açılacak; 2.3-S2/S3/S4 ve 3.13'teki kod/OAuth ayrımı o zaman.
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
  - ✅ ~~**2.4-S3 [DÜŞÜK]**~~ (yorumlar güncel kurala göre yazıldı) Eski yorumlar tiki bio doğrulamaya bağlı anlatıyor (`badgeAwarding.ts`, `InfluencerGridCard.tsx`).

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
  - ✅ ~~**2.6-S2 [DÜŞÜK]**~~ (2026-10-09: doğrulanan hesap profil linkine yazıldığı için tamamlamada sayılıyor; telefon/e-posta görevi tasarımda yok, eklenmeyecek) Tamamlama doğrulanmış hesapları değil elle girilen `social_links`'i sayıyor; `phone`/`email` görevleri hiç üretilmiyor.

### 2.7 Profil düzenleme
- **Dosyalar:** `components/influencer/ProfileForm.tsx`, `app/dashboard/influencer/profile/actions.ts`,
  `utils/{socialLinkValidation,usernameValidation}.ts`, `/api/check-username`
- **Sorunlar:**
  - ✅ ~~**2.7-S1 [ORTA]**~~ (doğrulanmış Instagram/TikTok linki formda kilitli ve sunucuda doğrulanmış kullanıcı adından yazılıyor) Instagram link alanı hesap doğrulandıktan sonra da düzenlenebilir (TikTok kilitli); `social_links.instagram` doğrulanmış kullanıcı adından sapabilir.
  - ✅ ~~**2.7-S2 [ORTA]**~~ (avatar artık `{uid}/` klasörüne yükleniyor) Avatar bucket köküne rastgele adla yükleniyor; avatars politikası `{uid}/` klasörü istiyor (bkz. 7.5-S1).
  - ✅ ~~**2.7-S3 [DÜŞÜK]**~~ (eksik kolon try/catch'leri ve e-posta ayarlarındaki 42703 dalı silindi) Tüm güncelleme yükü `console.log` ile loglanıyor; eksik kolon için kalıntı try/catch.

### 2.8 Vitrin görünürlüğü (`is_showcase_visible`, "Vitrin Modu")
- **Dosyalar:** `components/dashboard/SpotlightToggleCard.tsx`, `app/dashboard/influencer/actions.ts` (`toggleShowcaseVisibility`)
- **Sorunlar:**
  - ✅ ~~**2.8-S1 [ORTA]**~~ (kolon açılsa bile keşif doğrulanmış hesap şartını sunucuda uyguluyor, 2.8-S2) Kolon istemci beyaz listesinde; kullanıcı REST ile doğrudan açıp aksiyonun kontrollerini atlayabilir.
  - ✅ ~~**2.8-S2 [ORTA]**~~ (keşif listeleri doğrulanmış sosyal hesabı olmayanları göstermiyor; favoriler/listeler göstermeye devam ediyor) Varsayılan `true`; hesap bağlamamış doğrulanmış influencer'lar keşifte görünüyor, kart "Pasif" diyor.
  - ✅ ~~**2.8-S3 [DÜŞÜK]**~~ (bildirim metni vitrin modu için düzeltildi) Her açılışta "Spotlight Üyeliğiniz Aktifleşti!" bildirimi gidiyor (ücretsiz vitrin ile ücretli Spotlight karışmış).

### 2.9 İstatistik kartı ve "AI analiz"
- **Dosyalar:** `components/profile/InfluencerStats.tsx`, `app/actions/ai-analysis.ts`
- **Sorunlar:**
  - ✅ ~~**2.9-S1 [ORTA]**~~ (2026-10-10, kullanıcı kararı "dürüst metin": sahte 800 ms bekleme ve rastgele seçim kaldırıldı, aynı istatistik aynı yorumu verir; arayüzde "AI/yapay zeka" ifadeleri "akıllı eşleştirme / profil analizi" oldu (marka AI sayfası, Spotlight sayfaları, ana sayfa SSS ve özellikler)) "AI analiz" yerel kural motoru + rastgele karıştırma + sahte 800 ms gecikme; LLM yok. Pazarlama dili yanıltıcı.
  - ✅ ~~**2.9-S2 [ORTA]**~~ (seviye tek yerden: `lib/subscription-tier.ts` (süre ve onay kontrollü, Pro planı tanıyor; eski `pro`/`elite` eşlemesi kaldırıldı). Markaların ücretsiz BRAND_PRO alması ürün kararı olarak 3.13'te) Her marka ücretsiz BRAND_PRO seviyesini alıyor; seviye eşlemesi dosyalar arasında farklı (`ipro`/`mpro`, eski `pro`/`elite`).
  - ✅ ~~**2.9-S3 [DÜŞÜK]**~~ (`statsPayload.changes` hiçbir ekranda okunmuyor, yazılmaması bir şeyi bozmuyor; `match_score` / `profile_coach` "Çok yakında" ürün kararı. TikTok metni düzeltilmişti) ("TikTok Resmi Entegrasyonu Aktif" → "Herkese açık TikTok profilinden alındı") `match_score` / `profile_coach` "Çok yakında" ile kapalı; `statsPayload.changes` hiç yazılmıyor; "TikTok Resmi Entegrasyonu Aktif" yazısı yanlış.

### 2.10 İstatistik geçmişi
- **Dosyalar:** `app/dashboard/influencer/stats/page.tsx`, `components/dashboard/StatsHistory.tsx`
- **Sorunlar:** ✅ ~~**2.10-S1 [YÜKSEK]**~~  `social_accounts...eq('user_id').single()` platform filtresi yok; IG + TikTok'u olan kullanıcı "Hesap Bulunamadı" görüyor.

### 2.11 Influencer vitrini (diğer influencer'ları gezme)
- **Dosyalar:** `app/dashboard/influencer/discover/page.tsx`, `BrandDiscoverGrid.tsx`, `InfluencerGridCard.tsx`
- **Sorunlar:** ✅ ~~**2.11-S1 [ORTA]**~~ (sayfa marka keşfiyle aynı `getEnrichedInfluencers`'ı kullanıyor: yalnızca doğrulanmış hesap istatistikleri; Spotlight süresi `hasActiveSpotlight` ile; "Vitrinde görünmüyorsun" uyarısı doğrulanmış hesaba bakıyor. Sayfalama 3.2-S2 ile birlikte) İstatistik `userAccounts[0]`'dan, doğrulanmamış olabilir; sayfalama yok; Spotlight süresi kontrol edilmiyor.

### 2.12 İlanlara başvuru
- **Dosyalar:** `app/dashboard/influencer/advert/{page,actions}.ts(x)`, `components/dashboard/{InfluencerAdvertTabs,AdvertProjectsList,AdvertApplicationsList}.tsx`
- **Sorunlar:**
  - ✅ ~~**2.12-S1 [ORTA]**~~ (aksiyon rol ve son başvuru gününü kontrol ediyor; DB kuralı `20261007000005`) `applyToAdvert` rol ve son tarih kontrolü yapmıyor.
  - ✅ ~~**2.12-S3 [ORTA]**~~ (2026-10-09, yeni bulgu) Başvuru kartlarında durum (Beklemede / Ön Listede / Kabul / Red) hiç gösterilmiyordu; etiketler tanımlı ama kullanılmıyordu. Kartın sağ üstünde gösteriliyor; yalnızca ölü bir durumu besleyen oda başına mesaj kanalları kaldırıldı.
  - ✅ ~~**2.12-S2 [DÜŞÜK]**~~ (influencer başvuru kartında "Başvuruyu Geri Çek"; yalnızca bekleyen başvuru, DB kuralıyla uyumlu. Açık ilanların sayfalaması 3.2-S2 ile birlikte) `cancelApplication` hiçbir yerden çağrılmıyor; tüm açık ilanlar sayfalamasız yükleniyor.

### 2.13 Gelen teklifler (influencer)
- **Dosyalar:** `app/dashboard/offers/page.tsx`, `components/dashboard/{OffersManager,OfferActivityCard,OfferActionButtons}.tsx`,
  `app/dashboard/influencer/offers/actions.ts` (`updateOfferStatus`), `.../dismiss/actions.ts`
- **Sorunlar:**
  - ✅ ~~**2.13-S1 [ORTA]**~~ (kullanıcı kararı: davranış aynı, buton "Markayla görüş"; sohbet odasını açıp kullanıcıyı oraya götürüyor, markaya bildirim gidiyor) (bilinçli görünüyor: teklif beklemede kalır, görüşmek için sohbet açılır; ürün kararı bekliyor) "Beklet" durumu kaydedilmiyor ama sohbet odası yine açılıyor.
  - ✅ ~~**2.13-S2 [DÜŞÜK]**~~ (gizle/seçim kanalları yeniden açmıyor; oda kanalları oda listesine bağlı; `InfluencerOffersFeed` silindi, tip `OffersManager`'a taşındı) `OffersManager` her "gizle"de realtime'a yeniden aboneleniyor; `undismissOffer` ve `InfluencerOffersFeed` ölü.

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
  - ✅ ~~**3.2-S2 [ORTA]**~~ (kullanıcı kararı: kota şimdilik yok; keşfet ızgarası 24'er profil, "Daha fazla göster") (ertelendi: <100 influencer; 3.13-N4 "ücretsiz markaya kota" tasarımıyla birlikte yapılacak) Her şey tek seferde yükleniyor (sayfalama yok); "1,2K" gibi metin istatistikler istemcide ayrıştırılıyor.

### 3.3 Favoriler
- **Dosyalar:** `app/dashboard/brand/favorites/page.tsx`, `app/actions/favorites.ts`
- **Sorunlar:** ✅ ~~**3.3-S1 [ORTA]**~~ (toggle tüm eşleşen satırlara bakıyor; tekil indeks `20261007000010` canlıda uygulandı) `favorites` tablosundaki UNIQUE kısıtı bir migration'da düşürülmüş; tekrar varsa `.single()` hata verip
  silmek yerine bir kopya daha ekliyor.

### 3.4 Inflist (adlandırılmış listeler)
- **Karar (7 Ekim):** listeler favoriler sayfasında (`/dashboard/brand/favorites`) favorilerle birlikte yönetilir; marka panelindeki ayrı bölüm kaldırıldı.
- **Dosyalar:** `components/dashboard/InflistManager.tsx`, `AddToListModal.tsx`, `inflist/[id]/page.tsx`, `app/actions/favoriteLists.ts`
- **Sorunlar:**
  - ✅ ~~**3.4-S1 [ORTA]**~~ (karar: listeler şimdilik ücretsiz, kilit kaldırıldı; ileride Spotlight, bkz. 3.13-N5) Spotlight kısıtı yalnızca istemcide (aksiyonlar ve detay sayfası kontrol etmiyor).
  - ✅ ~~**3.4-S3 [ORTA]**~~ (2026-10-09, yeni bulgu) Listeye ekleme penceresinde çöp kutusu silinecek listeyi seçiyor ama onay penceresi hiç çizilmediği için liste silinemiyordu. Onay penceresi bağlandı.
  - ✅ ~~**3.4-S2 [DÜŞÜK]**~~ (liste adı sunucuda kırpılıp 1–50 karakter doğrulanıyor; ham hata metni gösterilmiyor; `InflistCard` ve `getLists` silindi. Liste yönetim sayfası ürün kararı olarak açık) "Tümünü Yönet" favoriler sayfasına gidiyor, liste yönetim sayfası yok; isim sunucuda doğrulanmıyor;
    revalidate yanlış yolu hedefliyor; `InflistCard.tsx` ve `getLists` ölü.

### 3.5 AI öneriler (marka)
- **Dosyalar:** `app/dashboard/brand/ai/page.tsx`, `utils/fetchInfluencers.ts` (`getAIRecommendations`), `utils/matching.ts`
- **Sorunlar:**
  - ✅ ~~**3.5-S1 [ORTA]**~~ (Spotlight yoksa sayfa plan ekranına yönlendiriyor; sezgisel skor/LLM yok notu sürüyor) Sayfada Spotlight kontrolü yok (yalnızca link Spotlight'a gösteriliyor); LLM yok, sezgisel skor.
  - ✅ ~~**3.5-S2 [DÜŞÜK]**~~ (2026-10-10: metin düzeltmesi + `lib/category-map.ts` marka sektörü → birincil ve ilgili influencer kategorileri; öneri sorgusu eşlenen kategorilerle, onaylı/vitrinde/doğrulanmış sosyal hesaplı profillerle ve en fazla 200 adayla çalışıyor (teknoloji markası için aday 1 → 42); puan: birincil 40, ilgili 25; eski mobil etiketleri ("Moda") anahtara çevriliyor; `getEnrichedInfluencers` kimlikleri 100'lük parçalarla sorguluyor; listeler değişmedi) "%95+ uyumlu" sabit iddia; marka ve influencer kategorileri farklı listelerden geldiği için eşleşme genelde boş havuza düşüyor; sınırsız `.in('id', ids)`.

### 3.6 Teklifler (marka → influencer)
- **Dosyalar:** `components/profile/OfferModal.tsx` → `app/profile/actions.ts` (`createOffer`), `brand/offers/page.tsx`,
  `components/dashboard/BrandOffersList.tsx`, `brand/offers/dismiss/actions.ts`
- **Sorunlar:**
  - ✅ ~~**3.6-S1 [ORTA]**~~ (rol DB'den, `fetchAccountRole`) `createOffer` rol kontrolünü `user_metadata.role` ile yapıyor (DB politikası asıl korumayı sağlıyor),
    bütçe NaN/negatif kontrolü yok, alıcının influencer olduğu kontrol edilmiyor.
  - ✅ ~~**3.6-S2 [YÜKSEK]**~~ (5.4-S1 ile: yeni teklifte site içi bildirim + e-posta) Influencer'a yeni teklif için bildirim veya e-posta gitmiyor (bkz. 5.4-S1).
  - ✅ ~~**3.6-S5 [KRİTİK]**~~ (2026-10-09, yeni bulgu) Teklif penceresi 2026-01-06'dan beri olmayan `payment_type` kolonuna yazıyordu: webden hiçbir teklif kaydedilemedi (son teklif 2026-01-04). Kolon `20261009000004` ile ekleniyor; kod kolon yokken de kaydediyor. Bütçe, kampanya adı ve alıcı rolü sunucuda doğrulanıyor.
  - ✅ ~~**3.6-S6 [DÜŞÜK]**~~ (kolon canlıda; influencer ve marka teklif ekranlarında "Bütçe (nakit)" / "Barter (ürün değeri)") Teklif listelerinde ödeme türü (nakit / barter) gösterilmiyordu.
  - ✅ ~~**3.6-S3 [ORTA]**~~ (sayımlar paralel ve yalnızca `count` dönüyor; okundu bilgisi 5.3-S1 ile metadata'dan) Okunmamış sayıları N+1 sorgu; okundu bilgisi hiç temizlenmiyor (bkz. 5.3).
  - ✅ ~~**3.6-S4 [DÜŞÜK]**~~ (`rooms` kanalı `brand_id` ile filtreli; `undismissInfluencer` ve `'hold'` daha önce kaldırılmıştı) `rooms` INSERT realtime kanalı filtresiz; `undismissInfluencer` için arayüz yok; `'hold'` tipi eksik.

### 3.7 İlanlar (advert projects / kampanyalar)
- **Dosyalar:** `brand/advert/page.tsx`, `components/dashboard/{BrandAdvertTabs,BrandAdvertManager,AdvertProjectsList,AdvertPerformanceChart}.tsx`,
  `brand/advert/actions.ts`, `app/actions/analytics.ts`
- **Sorunlar:**
  - ✅ ~~**3.7-S1 [YÜKSEK]**~~ (mevcut kapak korunuyor) İlan düzenleme bozuk: düzenlemede `heroImage` boşaltılıyor, kaydetme "Kapak fotoğrafı zorunlu" diye reddediyor.
  - ✅ ~~**3.7-S2 [YÜKSEK]**~~ (payment_type/custom_questions okunuyor, açıklama ezilmiyor) Düzenlemede veri kaybı: sayfa `payment_type`, `custom_questions`, `description` seçmiyor → barter ilan nakde dönüyor, açıklama `''` ile eziliyor.
  - ✅ ~~**3.7-S3 [ORTA]**~~ (`getAnalyticsStats` Spotlight kontrolü yapıyor) Analitik yalnızca istemcide kısıtlı; `getAnalyticsStats` Spotlight kontrolü yapmıyor.
  - ✅ ~~**3.7-S4 [DÜŞÜK]**~~ (brandIsSpotlight süre kontrollü dolduruluyor; kapak silme yolu adresten çıkarılıyor) Topluluk sekmesinde `brandIsSpotlight` hiç set edilmiyor (sıralama işlemiyor); liste sınırsız; silmede dosya yolu `split('/').pop()`.

### 3.8 Başvuru değerlendirme (marka)
- **Dosyalar:** `AdvertApplicationsList.tsx`, `brand/advert/actions.ts` (`getBrandApplicationsAdmin`, `updateApplicationStatus`, `getOrCreateAdvertApplicationRoom`)
- **Sorunlar:**
  - ✅ ~~**3.8-S1 [ORTA]**~~ (okuma ve durum güncelleme oturum istemcisiyle; canlı RLS markaya yalnızca kendi ilanlarının başvurularını açıyor) Okumalar "RLS sorunu için geçici çözüm" olarak service role ile; sahiplik kodda kontrol ediliyor ama RLS devre dışı kalmış.
  - ✅ ~~**3.8-S2 [ORTA]**~~ (yalnızca bu başvurunun odası yeniden kullanılıyor; başvuru durumu artık 'pending'e çekilmiyor) `getOrCreateAdvertApplicationRoom` çift arasındaki herhangi bir odayı yeniden kullanıyor, `rooms` UPDATE politikası olmadığı için
    `advert_application_id` güncellemesi sessizce başarısız; oda açılırken başvuruyu `pending`'e geri çekebiliyor.
  - ✅ ~~**3.8-S4 [YÜKSEK]**~~ (yeni bulundu, canlıda düzeltildi) Canlı CHECK kısıtı `shortlisted` durumunu reddediyordu; "Ön Listeye Al" hiç çalışmamış (canlıda tek bir shortlisted başvuru yok). Kısıt genişletildi, `20261007000011`.
  - ✅ ~~**3.8-S3 [ORTA]**~~ (5.4-S1 ile: ön liste / kabul / red bildirimi + e-posta; marka kanalı filtreli) (marka tarafındaki yeni başvuru kanalı artık kendi ilanlarıyla filtreli; bildirim kısmı 5.4 ile) Başvuru durumu değişince influencer'a bildirim yok; realtime kanal filtresiz ve anon istemciyle farklı join kullanıyor.

### 3.9 Marka profili
- **Dosyalar:** `brand/profile/page.tsx`, `components/brand/BrandProfileForm.tsx`, `brand/profile/actions.ts`
- **Sorunlar:**
  - ✅ ~~**3.9-S1 [YÜKSEK]**~~ (canlıda "avatars insert" kökte yüklemeye izin veriyordu; logo artık `{uid}/` klasörüne yükleniyor) Logo yükleme yolu klasörsüz (`${uuid}.ext`), avatars politikası `{uid}/` istiyor → büyük ihtimalle başarısız (bkz. 7.5-S1).
  - ✅ ~~**3.9-S2 [YÜKSEK]**~~  Sayfa `kick`, `twitter`, `twitch` alanlarını forma geçmiyor → kaydetme bunları null'a çekiyor (ya da 30 günlük kilide takılıyor).
  - ✅ ~~**3.9-S4 [YÜKSEK]**~~ `updateBrandProfile` doğrulama hatasını fırlatıyordu; production'da kullanıcı hata sayfası görüyordu (canlı Vercel kayıtlarında görüldü). Artık mesaj olarak dönüyor.
  - ✅ ~~**3.9-S3 [DÜŞÜK]**~~ (eksik kolon try/catch'leri silindi) Eksik kolon try/catch'i ölü; `brand/profile/badges/actions.ts`, brand settings re-export dosyaları kullanılmıyor.

### 3.10 Vergi levhası doğrulama
- **Dosyalar:** `components/brand/TaxCertificateUpload.tsx`, `brand/profile/tax-actions.ts` (`submitTaxCertificate`),
  `lib/tax-verification.ts`, `lib/tax-certificate-match.ts`, `lib/tax-id.ts`, `components/admin/TaxVerificationReview.tsx`
- **İş:** PDF yerelde `unpdf` ile okunur (dış servis yok), profil ile karşılaştırılır (VKN/TCKN, unvan, vergi dairesi, il, yıl, üretici).
  `TAX_AUTO_APPROVE=true` değilse her kayıt admin onayına düşer. Görsel/taramalar her zaman incelemeye gider.
- **Tablolar:** `tax_verifications`, özel `tax-documents` bucket'ı.
- **Sorunlar:** ✅ ~~**3.10-S1 [DÜŞÜK]**~~ (2026-10-10: yükleme yalnızca sunucunun verdiği imzalı adresle — web `requestTaxUploadUrl`, mobil `/api/mobile/brand-verification` `action: 'upload-url'`, ortak `createTaxUploadUrlAs` (`lib/brand-verification.ts`). Adres verilmeden önce ön koşullar ve günlük sınır kontrol edilir; sınır artık son 24 saatte kovaya yüklenen dosyaları da sayar. Depolama INSERT politikası `WITH CHECK (false)` ile kapatılıyor: `20261010000003_tax_upload_signed_only.sql` = `supabase/manual/2026-10-10_vergi_yukleme.sql`, PR #53 yayına (READY) girdikten sonra 2026-10-10'da canlıya uygulandı ve `pg_policies` ile doğrulandı. Belge dış servise gitmez. Sahipsiz dosya temizliği 8.9-N1 ile) Günlük 5 sınırı `tax_verifications` satırlarını sayıyor; aksiyon çağrılmadan bucket'a doğrudan yükleme sınırsız (yalnızca kendi klasörü, 5 MB).

### 3.11 Kurumsal e-posta ve Resmi İşletme (sarı tik)
- **Dosyalar:** `lib/corporate-email.ts`, `lib/corporate-email-verification.ts`, `lib/official-business.ts`,
  `brand/profile/corporate-email-actions.ts`, `components/brand/CorporateEmailVerification.tsx`,
  migration `20261007000001_corporate_email.sql`
- **İş:** Kayıtta web sitesi + sitenin alan adında kurumsal e-posta zorunlu (Gmail vb. reddedilir). 6 haneli kod ile doğrulanır.
  Sarı tik = vergi onayı + doğrulanmış kurumsal e-posta + alan adı eşleşmesi; tek karar noktası `syncOfficialBusiness`.
  Web sitesi alan adı değişirse doğrulama ve sarı tik düşer (DB guard).
- **Sorunlar:**
  - ✅ ~~**3.11-S1 [ORTA]**~~ (kullanıcı kararı: saatlik `sweepOfficialBusiness` kurala uymayanın tikini geri alıyor ve bildirim gönderiyor; kuralı tamamlayan geri alıyor) Bu kuraldan önce verilmiş sarı tikler otomatik geri alınmadı (karar bekliyor).
  - ✅ ~~**3.11-S2 [ORTA]**~~ (üretimde `EMAIL_FROM` ve `RESEND_API_KEY` tanımlı; kayıt/kod e-postalarının geldiği kullanıcıca doğrulandı) Kod e-postası için Resend'de doğrulanmış alan adı ve `EMAIL_FROM` gerekli; yoksa yalnızca Resend hesap sahibine gider.

### 3.12 Kilit ve doğrulama ekranları
- **Dosyalar:** `components/dashboard/BrandLockScreen.tsx`, `BrandVerificationCard.tsx`
- **Sorunlar:** bkz. 1.8-S4.

### 3.13 Ürün notları: doğrulama yolu ve ücretsiz marka erişimi (karar/tasarım bekliyor)
- **Kaynak:** kullanıcı notları, 7 Ekim. Henüz kod yok.
- **Önkoşul:** OAuth yolu gerçekten çalışmalı (2.3-S1/S2: arayüzde "Çok yakında", TikTok OAuth yanlış kullanıcı adı kaydediyor).
- **Karar (2026-10-10):** OAuth mağaza yayınından sonra açılacak; kod/OAuth ayrımı (N2, N3) o zaman ele alınır.
- **Notlar:**
  - **3.13-N1** Kod (bio) ile doğrulayan Instagram/TikTok hesaplarının belli verileri çekilemiyor: kazıma yalnızca herkese açık
    sayıları verir (takipçi, beğeni, yorum, izlenme). Erişim, gösterim, kaydetme, kitle demografisi yalnızca OAuth ile gelir.
  - **3.13-N2** (2026-10-10, kullanıcı kararı: OAuth açılana kadar bekle; bugün herkes kodla doğruladığı için fark konmuyor) OAuth yerine kod ile doğrulayanlar dezavantajlı olmalı. Seçenekler: güven skorunda tavan, mavi tik/rozet yok,
    keşifte alt sıra, "resmi veri" etiketi yok, Spotlight sınırı.
  - **3.13-N3** Ücret ödemeyen markalar yalnızca kod ile doğrulanmış influencer/UGC'lere ulaşabilsin; OAuth ile bağlanmış
    profiller ücretli markalara ayrılsın.
  - ✅ ~~**3.13-N4**~~ (2026-10-10, 3. tur kararıyla: keşif çarkı + teklif/ilan sınırları kapalı bayrakla yapıldı, bkz. 3.17) Ücret ödemeyen markalar tüm listeyi göremesin. Sistem markanın ihtiyacını (kategori, bütçe, ilanlar, hedef kitle)
    analiz edip ücretsiz olarak belli oranda/kotada profil önersin. Kısıt sunucuda uygulanmalı (bugün premium veri istemciye
    gidip yalnızca CSS ile bulanıklaştırılıyor, bkz. 3.1-S1).
  - **3.13-N5** Listeler (Inflist) şimdilik tüm doğrulanmış markalara ücretsiz; ileride Spotlight'a dahil edilecek
    (o zaman `createList` / `toggleInList` sunucuda da kontrol etmeli).
  - ✅ ~~**3.13-N6**~~ (2026-10-10: `lib/social-stats.ts` yeni doğrulamada gönderi/video sayısı 0 ve son gönderi/video yoksa
    "Gönderisi olmayan Instagram hesapları doğrulanamıyor..." / "Videosu olmayan TikTok hesapları..." mesajıyla reddediyor (kod `no_posts`);
    web ve mobil aynı kod. Doğrulanmış hesapların yenilemesi etkilenmiyor) İleride gönderisi olmayan Instagram/TikTok hesapları doğrulamada kabul edilmeyecek (bugün 2.1-S2 düzeltmesiyle
    kabul ediliyor). Kural eklenince `media_count = 0` veya son gönderi yoksa net mesajla reddet; mevcut gönderisiz doğrulanmış
    hesaplar kalır (karar, 7 Ekim).


### 3.14 İş birlikleri ve fiyat kartı (yol haritası özellik 1, 2026-10-10)
- **Dosyalar:** `lib/collaborations.ts`, `lib/collaboration-shared.ts`, `lib/rate-card.ts`, `lib/rate-card-shared.ts`,
  `app/dashboard/collaborations/{page,actions}.ts(x)`, `components/dashboard/CollaborationsManager.tsx`,
  `components/influencer/RateCardForm.tsx`, `components/profile/RateCardView.tsx`, `/api/mobile/{collaborations,rate-card}`,
  mobil `screens/CollaborationsScreen.js`, `constants/rateCard.js`; migration `20261010000001_collaborations_rate_cards.sql`.
- **İş birliği:** teklif kabul edilince (`lib/offers.ts`) ve marka başvuruyu kabul edince (`lib/adverts.ts`; başvurunun sohbet odası da açılır)
  `collaborations` kaydı açılır. Aşamalar: `agreed` → `in_progress` (iki taraf) → `published` (influencer yayın linki: yalnızca http(s)
  instagram.com / tiktok.com / youtube.com) → `completed` (marka onayı) / `cancelled` (tamamlanmadan önce iki taraf, isteğe bağlı gerekçe).
  Marka 7 gün yanıt vermezse saatlik görev tamamlar (`auto_completed`). Kabul edilmiş başvurunun durumu, iş birliği sürerken geri alınamaz
  (önce iş birliği iptal edilir). Tablo istemcilere yalnızca okunur (RLS: taraflar + admin); bütün yazımlar `runCollaborationAction` /
  `createCollaborationFor` ile service role'den, taraf ve rol kontrolünden sonra. Realtime yayınında.
- **Bildirim:** açılış (iki tarafa, e-postasız), yayın linki (markaya), tamamlanma (iki tarafa), iptal (karşı tarafa); e-posta "Teklif bildirimleri" tercihine bağlı.
- **Güven:** tamamlanan iş birliği sayısı `completed_collaboration_counts(uuid[])` RPC'siyle (yalnızca sayı) profilde, keşif kartında ve mobil detayda.
- **Fiyat kartı:** `rate_cards` (influencer başına bir satır; story / reel / gönderi / UGC video / paket başlangıç fiyatı, tam sayı 1–10.000.000 ₺,
  `negotiable`). RLS: sahibi + `can_view_rate_cards()` (doğrulanmış marka veya admin); influencer'lar birbirininkini, onaysız marka hiçbirini göremez
  (canlıda rollback'li RLS denemesiyle doğrulandı). Yazım `saveRateCardAs` (yalnızca influencer, kendi kartı). Keşifte "Bütçem (₺)": girilince en az bir
  başlangıç fiyatı bütçeye sığanlar kalır; boşken herkes görünür. Web profil düzenleme + mobil MyProfile'dan düzenlenir.
- **Geriye dönük:** canlıdaki 1 kabul edilmiş teklif `agreed` olarak aktarıldı (kabul edilmiş başvuru yoktu).
- **Sorunlar / notlar:**
  - **3.14-S1 [DÜŞÜK]** (yeni bulgu) Teklif ve başvuru listeleri iş birliği aşamasını göstermiyor (yalnızca "Kabul edildi"); kullanıcı aşamayı
    İş Birlikleri sayfasında görüyor. 2. aşamada (takip alanı) listelere bağlantı/aşama etiketi eklenebilir.
  - **3.14-S2 [DÜŞÜK]** (yeni bulgu) Mobil keşif bütçe filtresi fiyat kartlarını istemcide süzüyor (en fazla 1000 kart); kart sayısı büyüyünce sunucu ucuna taşınmalı.
  - **3.14-N1** Fiyat kartı bugün tüm doğrulanmış markalara açık; ücretsiz/ücretli marka ayrımı (3.13-N3/N4) gelince burada da ele alınmalı.
  - **3.14-N2** Revize hakkı, teslimat listesi, taslak onayı ve anlaşma özeti yol haritasının 2. aşamasında (ROADMAP "Buluşturmayı kolaylaştıran özellikler" 2).
    ✅ Anlaşma özeti, teslimat takibi (taslak linki, revize sayacı, teslimat başına yayın linki) ve ödeme teyidi yapıldı (2026-10-10, bkz. 3.18).
    **Kalan:** teslim kilidi (taslak dosyası yükleme, ödeme teyidine kadar kilitli dosya) Cloudflare R2 ile Kasım'da (3.18-N4).

### 3.15 Teklif süresi, teklif şablonu, kaydedilen ilanlar ve ilan alarmı (yol haritası adım 2, 2026-10-10)
- **Dosyalar:** `lib/offer-shared.ts`, `lib/offers.ts` (`expireStaleOffers`, `validateOfferFields`), `lib/offer-templates.ts`,
  `lib/advert-alerts.ts`, `lib/advert-alerts-shared.ts`, `components/profile/OfferModal.tsx`, `components/dashboard/{InfluencerAdvertTabs,AdvertAlertsManager,AdvertProjectsList}.tsx`,
  `/api/mobile/{offer-templates,saved-adverts,advert-alerts}`, mobil `OffersScreen`, `InfluencerDetailScreen` (teklif formu), `ProposalsScreen`,
  `constants/advertAlerts.js`; migration `20261010000010_offer_expiry_templates_advert_alerts.sql` (canlıda).
- **Maddeler:**
  - ✅ ~~**3.15-N1**~~ (2026-10-10, cevapsız teklif: `offers.status` CHECK'ine `expired` eklendi; saatlik görev 7 günü geçen `pending` teklifleri
    `expired` yapıyor (turda en fazla 50, süre bütçesiyle) ve markaya site içi + e-posta ("Teklif bildirimleri" tercihi) + push bildirim gönderiyor
    (14 günden eski olanlar bildirimsiz kapanır). `respondToOfferAs` 7 günü geçmiş teklifi görev çalışmadan da reddediyor, güncelleme yalnızca
    hâlâ `pending` olan satıra yazıyor. DB tetikleyicisi `secure_offers_final` istemcinin süresi dolan ya da 7 günü geçen teklifi değiştirmesini ve
    durumu `expired` yapmasını engelliyor. Web ve mobil listelerde "Süresi doldu"; influencer listesinde "Tümü" süresi dolanları göstermez
    ("Süresi dolan" filtresi / mobilde "göster" düğmesi)) Yanıtlanmayan teklif sonsuza kadar bekliyordu.
  - ✅ ~~**3.15-N2**~~ (2026-10-10, teklif şablonu: `offer_templates` (marka başına en fazla 20, ad markada tekil). Teklif penceresinde
    "Şablondan doldur", "Son teklifimi kopyala", "Bu formu şablon olarak kaydet", şablon silme; mobil teklif formunda aynı (dokun = doldur,
    basılı tut = sil). Tablo istemcilere yalnızca sahibine SELECT; yazımlar `lib/offer-templates.ts` ile rol kontrolünden sonra service role)
    Marka her teklifi baştan yazıyordu.
  - ✅ ~~**3.15-N3**~~ (2026-10-10, kaydedilen ilanlar + ilan alarmı: `saved_adverts` (en fazla 200) ve `advert_alerts` (en fazla 5; kategori/anahtar
    kelime, platform, en az bütçe; boş alan = fark etmez). Web ilanlar sayfasında "Kaydedilenler" ve "Alarmlar" sekmeleri, kartta kaydet düğmesi;
    mobil İlanlar ekranında aynı sekmeler. Eşleştirme saatlik görevde: son 48 saatte açılan ve işlenmemiş ilanlar (`advert_alert_runs` ile tek sefer),
    ilan başına en fazla 300 alıcı, kullanıcı başına tek bildirim (site içi + e-posta "İlan Başvuruları" tercihi + push). İki tablo yalnızca sahibine
    SELECT, `advert_alert_runs` istemcilere tamamen kapalı) Influencer ilanı kaydedemiyor, yeni uygun ilandan haberdar olamıyordu.
- **Sorunlar / notlar:**
  - **3.15-S1 [DÜŞÜK]** (yeni bulgu) İlan alarmı saatlik çalışıyor (anlık değil). ROADMAP "anlık ilan alarmı"nı Spotlight Basic'e koyuyor;
    bugün alarmlar herkese açık ve saatlik. Spotlight ayrımı (anlık = yayın anında eşleştirme) satış başlayınca kararla eklenir.
  - **3.15-S2 [DÜŞÜK]** (yeni bulgu) Web ilan formunda kategori serbest metin ("Çanta -Cüzdan", "Bakım"); alarm bu yüzden anahtar kelimeyle
    eşleşiyor (kategori + başlık, büyük/küçük harf ve aksan farkı yok). İlan formuna kategori listesi eklenirse alarm da listeden seçilebilir.
  - **3.15-S3 [DÜŞÜK]** (yeni bulgu) Bir ilanın alıcıları saatlik görevin süre bütçesine sığmazsa kalanlar o ilan için atlanır (ilan önce
    "işlendi" işaretlenir; çift bildirim yerine eksik bildirim tercih edildi). Bugünkü kullanıcı sayısında sorun değil.

### 3.16 İlk adımlar kontrol listesi (2026-10-10 kararı)
- **Dosyalar:** `lib/first-steps.ts` (sunucu hesabı), `lib/first-steps-shared.ts` (tipler, çerez adı, "4 adımdan X'i tamam" metni),
  `components/dashboard/FirstStepsCard.tsx`, `app/dashboard/{influencer,brand}/page.tsx`, `GET /api/mobile/first-steps`,
  mobil `components/FirstStepsCard.js` (`DashboardScreen`, `BrandDashboardScreen`).
- **Adımlar:** influencer/UGC — doğrulanmış Instagram/TikTok hesabı, profil doluluğu %100 (`utils/profileCompletion.ts`, paneldeki kartla aynı eşik),
  fiyat kartında en az bir fiyat (`rate_cards`), en az bir ilan başvurusu. Marka — kurumsal e-posta doğrulandı (`corporate_email_verified_at`,
  gizli kolon; sunucuda yalnızca sahibinin kendi satırı service role ile okunur), son vergi levhası kaydı reddedilmemiş (işleniyor / incelemede
  "İnceleniyor" etiketi), en az bir ilan, en az bir gönderilmiş teklif.
- Durum her istekte sayım sorgularıyla hesaplanır (tablo yok). Hepsi bitince kart görünmez. "Gizle": web'de `im_first_steps_hidden` çerezi
  (değeri kullanıcı kimliği, 1 yıl), mobilde AsyncStorage `first_steps_hidden:<uid>`; gizliyken sunucu hesaplamaz.
- **Sorunlar / notlar:**
  - ✅ ~~**3.16-N1 [ÖZELLİK]**~~ (2026-10-10: "İlk adımlar" kartı web + mobil panellerde; ortak `lib/first-steps.ts`, `/api/mobile/first-steps`) Yeni kullanıcı için ilk adımlar kontrol listesi.

### 3.17 Ücretsiz marka sınırları ve keşif çarkı (yol haritası adım 3, 2026-10-10; KAPALI BAYRAKLA)
- **Karar:** 2026-10-10 (3. tur). Altyapı hazır, **bayrak kapalı** (`free_brand_limits_enabled = false`); satış başlayınca (POS) admin
  `/admin/limits` sayfasından açar. Kapalıyken hiçbir davranış değişmez (sunucu kodu ayar okuyup çıkar; DB tetikleyicileri ilk satırda döner).
- **Dosyalar:** `lib/platform-settings{,-shared}.ts`, `lib/brand-limits.ts`, `lib/discovery-wheel.ts`, `lib/offers.ts`, `lib/adverts.ts`,
  `app/admin/limits/{page,actions}.ts(x)`, `components/admin/PlatformSettingsPanel.tsx`, `app/dashboard/brand/discover/{page,actions}.ts(x)`,
  `components/dashboard/DiscoveryWheelCard.tsx`, `app/profile/[username]/page.tsx`, `components/profile/OfferModal.tsx`,
  `/api/mobile/discovery-wheel` (GET/POST, `?profileId=`), `/api/mobile/offer-templates` (`quotaText`), mobil `components/DiscoveryWheelCard.js`,
  `DiscoverScreen`, `InfluencerDetailScreen`, `BrandDashboardScreen`; migration `20261010000020_free_brand_limits.sql` (canlıda).
- **Ayarlar:** `platform_settings` (anahtar/değer jsonb; RLS açık, anon/authenticated'a hiçbir yetki yok, yalnızca service role).
  Varsayılanlar: çark 10 profil / 24 saat, ücretsiz marka teklif günde 3 / ayda 15 (takvim ayı, Türkiye saati), 1 aktif ilan;
  Basic değerleri boş (= sınırsız, paket içeriği kararı bekliyor); Pro her zaman sınırsız. Influencer/UGC sınırlanmaz.
- **Plan:** aktif Spotlight + `mpro` = Pro, diğer aktif Spotlight = Basic, yoksa ücretsiz (`brandPlanOf`; DB'de `brand_limit_for()` aynı kural).
- **Maddeler:**
  - ✅ ~~**3.17-N1 [ÖZELLİK]**~~ (2026-10-10: admin ayar sayfası `/admin/limits`, panelde "Marka Sınırları"; bayrağı değiştirirken onay sorulur; rol kontrolü sunucuda) Sınır değerleri ve bayrak tek yerden, admin panelinden.
  - ✅ ~~**3.17-N2 [ÖZELLİK]**~~ (2026-10-10, keşif çarkı: ücretsiz marka web keşfinde ve mobil Keşfet/ana sayfada yalnızca güncel çevirmedeki profilleri görür.
    "Çarkı çevir" pencere başına bir kez; sunucu sektöre uyan (`lib/category-map.ts`) onaylı, vitrinde, doğrulanmış sosyal hesaplı profilleri seçer,
    yetmezse diğer doğrulanmış profiller; önceki çevirmelerde gösterilenler havuz bitene kadar gelmez. `discovery_spins` (marka yalnızca kendi
    satırını okur, yazım service role). Çevirmeden önce / süre bitince açıklama kartı (fiyat yok, "Spotlight markalar tüm profilleri görür").
    Profil sayfası (web + mobil detay): ücretsiz marka yalnızca çarktaki ya da teklif / iş birliği / sohbet / ilan başvurusu ilişkisi olan profili açar,
    diğerlerinde aynı kart; engellenen ziyaret görüntülenme sayılmaz) Ücretsiz marka tüm listeyi görüyordu.
  - ✅ ~~**3.17-N3 [ÖZELLİK]**~~ (2026-10-10, teklif sınırı: `createOfferAs` (web + mobil) gün / takvim ayı sayar, net Türkçe hata ve kalan hak;
    teklif penceresinde ve mobil formda "Bu ay X teklif hakkın kaldı (bugün Y)". Çark açıkken ücretsiz marka teklifi yalnızca açabildiği profile (çark / önceki ilişki) gönderebilir. DB yedeği `enforce_brand_offer_limits` tetikleyicisi (istemci oturumu)) Teklif sınırı yoktu.
  - ✅ ~~**3.17-N4 [ÖZELLİK]**~~ (2026-10-10, aktif ilan sınırı: `saveAdvertAs` yeni ilanda ve kapalı/duraklatılmış ilanı açarken, `updateAdvertStatusAs`
    yeniden açarken kontrol eder; DB yedeği `enforce_brand_advert_limits`. Bayrak açıldığında sınırın üstünde açık ilanı olan marka mevcut ilanlarını korur,
    yalnızca yenisini açamaz) Aktif ilan sınırı yoktu.
  - ✅ ~~**3.17-S1 [DÜŞÜK]**~~ (2026-10-10, yeni bulgu) Mobil marka ana sayfasındaki öneri kartlarında sabit "%94 Uyumlu" / "Eşleşme oranını gör" yazısı
    (gerçek hesap yoktu) kaldırıldı.
- **Sorunlar / notlar:**
  - **3.17-S2 [ORTA]** (yeni bulgu, bayrak açılmadan önce karar) `users` ve `social_accounts` tabloları her oturumlu kullanıcıya okunur (RLS `true`);
    çark web/mobil arayüzde ve sunucu sayfalarında uygulanır, ama teknik bilgisi olan ücretsiz marka Supabase istemcisiyle tüm profilleri doğrudan
    sorgulayabilir. Tam koruma için marka rolüne `users`/`social_accounts` okumasının daraltılması (riskli politika değişikliği, mobil ekranlar
    doğrudan okuyor) ya da profil verisinin sunucu uçlarına taşınması gerekir.
  - **3.17-S3 [DÜŞÜK]** (yeni bulgu) Favoriler / listeler sayfaları ve web marka ana sayfasındaki "son favoriler" ücretsiz markada da kaydedilmiş
    profillerin kartlarını gösterir (profil sayfası çark kuralıyla kapalı). Karar: favoriler çark dışında kalsın mı?
  - **3.17-S4 [DÜŞÜK]** (yeni bulgu) Aynı anda iki "Çarkı çevir" isteği iki çevirme kaydı açabilir (son açılan geçerli olur); sayaç sınırları da eşzamanlı
    isteklerde bir fazla geçebilir. Bugünkü kullanıcı sayısında sorun değil.
  - **3.17-S5 [DÜŞÜK]** Fiyat kartı (3.14-N1) ve ilan alarmının anlık sürümü (3.15-S1) ücretsiz/ücretli ayrımına henüz bağlanmadı; satış başlarken kararla.

### 3.18 İş birliği takip alanı, anlaşma özeti ve ödeme teyidi (yol haritası özellik 2, 2026-10-10)
- **Dosyalar:** `lib/collaboration-workspace.ts` (okuma + bütün yazımlar), `lib/collaboration-workspace-shared.ts`, `lib/collaborations.ts`
  (liste özeti, teslimatlı iş birliğinde tek yayın linki kapalı), `app/dashboard/collaborations/[id]/{page,actions}.ts(x)`,
  `components/dashboard/CollaborationWorkspace.tsx`, `CollaborationsManager.tsx` ("Ayrıntılar ve teslimatlar"), `app/profile/[username]/page.tsx`
  (marka güvenilirliği), `GET/POST /api/mobile/collaborations/[id]`, `/api/mobile/offers` (`sender_reliability`), mobil
  `screens/CollaborationDetailScreen.js`, `CollaborationsScreen.js`, `OffersScreen.js`, `constants/collaborationWorkspace.js`, `utils/notifications.js`
  (bildirim → detay ekranı); migration `20261010000040_collaboration_workspace.sql` (canlıda).
- **Tablolar:** `collaboration_agreements` (iş birliği başına bir satır: ücret ₺ tam sayı, ödeme türü nakit/barter, kullanım hakkı ≤300, revize sayısı 0–10,
  `version`, iki onay zaman damgası), `collaboration_deliverables` (tür story/reel/post/ugc_video/other, adet, not, teslim tarihi, durum, kullanılan revize,
  son taslak, revize notu, yayın linki), `collaboration_submissions` (taslak geçmişi; `file_key` / `file_locked` R2 teslim kilidi için boş duruyor),
  `collaboration_payments` (marka "ödeme yapıldı", influencer "ödeme alındı" tarih + not, ödeme alınamadı bildirimi + destek kaydı). Dördü de RLS'li,
  istemcilere yalnızca SELECT ve yalnızca taraflar + admin (`is_collaboration_party()`); yazımlar service role. Güvenilirlik `brand_collaboration_reliability(uuid[])`
  (yalnızca sayılar). Realtime: anlaşma, teslimat, ödeme. Canlıda rollback'li denemeyle doğrulandı: taraflar görür, taraf olmayan marka 0 satır, istemci
  UPDATE/INSERT/DELETE reddedilir, anon SELECT ve RPC reddedilir.
- **Maddeler:**
  - ✅ ~~**3.18-N1 [ÖZELLİK]**~~ (2026-10-10, anlaşma özeti: iki taraftan biri yazar, diğeri onaylar; onaylar zaman damgasıyla. Değişiklik iki onayı sıfırlar,
    kaydeden tarafın kaydı yeni sürümün onayı sayılır (karşı taraf yeniden onaylar); içerik aynıysa onaylar korunur. Sürüm kilidiyle eşzamanlı düzenleme reddedilir.
    Taslağı gönderilmiş teslimat listeden çıkarılamaz, revize sayısı kullanılandan aza indirilemez. Hukuki metin yok; yalnızca "Bu özet iki tarafın uygulamada
    onayladığı bilgileri gösterir." Düzenleme anlaşıldı / içerik hazırlanıyor aşamalarında) Anlaşma özeti ve iki tarafın onay kaydı.
  - ✅ ~~**3.18-N2 [ÖZELLİK]**~~ (2026-10-10, teslimat takibi: bekliyor → taslak gönderildi → revize istendi → onaylandı → yayınlandı; teslimatlar anlaşma iki tarafça
    onaylanınca başlar. Taslak http(s) link + not (dosya R2 ile); marka onaylar ya da notla revize ister; "X / Y revize kullanıldı", sınır dolunca marka revize
    isteyemez (influencer yine yeni taslak gönderebilir). İlk taslakla iş birliği "İçerik hazırlanıyor" olur. Yayın linki teslimat başına (Instagram/TikTok/YouTube,
    3.14 ile aynı doğrulama); hepsi yayınlanınca iş birliği `published` olur ve 7 günlük marka onayı / otomatik tamamlama işler. Teslimatlı iş birliğinde eski tek
    "Yayın linkini gir" kapalı) Teslimat listesi, taslak onayı, revize sayacı.
  - ✅ ~~**3.18-N3 [ÖZELLİK]**~~ (2026-10-10, ödeme teyidi: iptal dışındaki her aşamada marka "Ödeme yapıldı", influencer "Ödeme alındı" (tarih, isteğe bağlı not;
    geri alınabilir). Marka profilinde ve influencer'ın gördüğü iş birliği/teklif detayında "X iş birliği, Y ödeme teyitli" (sunucuda sayılır). Tamamlanmadan
    14 gün sonra teyit yoksa influencer'a "Ödeme alamadım": tek seferlik, `support_tickets`'a "Ödeme Sorunu / Acil" kaydı (admin `/admin/support` listesinde
    görür; metinde iş birliği, marka, anlaşma ve markanın işareti), markaya bildirim. Otomatik yaptırım yok) Ödeme teyidi ve marka güvenilirliği.
  - ✅ ~~**3.18-N5**~~ (2026-10-10) Bildirimler (`lib/notify.ts`): anlaşma özeti hazırlandı / değişti / onaylandı, taslak gönderildi, revize istendi, taslak onaylandı,
    teslimat yayınlandı, ödeme işaretlendi, ödeme alınamadı. E-posta: özet hazırlandı/değişti, taslak, revize, ödeme alınamadı ("Teklif bildirimleri" tercihi);
    diğerleri site içi + push. İş birliği bildirimleri artık detay sayfasına (`/dashboard/collaborations/<id>`) gider, mobilde detay ekranı açılır.
- **Sorunlar / notlar:**
  - **3.18-N4** Teslim kilidi (taslak dosyası yükleme; marka ödeme teyidine kadar orijinal dosyayı indiremez) Cloudflare R2 ile Kasım'da. Veri modeli hazır:
    `collaboration_submissions.file_key`, `file_locked` (kontrol kısıtı url veya file_key ister).
  - **3.18-S1 [DÜŞÜK]** (yeni bulgu, karar) UGC video teslimatı da yayın linki istiyor (Instagram/TikTok/YouTube); marka içeriği kendi hesabında yayınlıyorsa influencer
    markanın gönderi linkini girmeli. UGC için "onaylandı = teslim edildi" ayrımı istenirse kararla eklenir.
  - **3.18-S2 [DÜŞÜK]** (yeni bulgu) İptal edilip yeniden kabul edilen başvuruda (`createCollaborationFor` yeniden açma) eski anlaşma özeti, teslimatlar ve ödeme kaydı
    kalır. Bugün yeniden açma yalnızca başvuruda ve nadir; gerekirse yeniden açılışta sıfırlanır.
  - **3.18-S3 [DÜŞÜK]** (yeni bulgu) Anlaşma kaydı ile teslimat değişiklikleri tek veritabanı işleminde değil (sürüm kilidi var; teslimat yazımı arada hata verirse liste
    kısmen güncellenebilir, aynı form tekrar kaydedilince düzelir). Gerekirse service role RPC'sine taşınır.
  - **3.18-S4 [DÜŞÜK]** (yeni bulgu) Web teklif listesinde (influencer) marka güvenilirliği satırı yok; marka profili ve iş birliği detayında var, mobilde teklif detayında var.

---

## 4. Ortak: rozetler, Spotlight, profil

### 4.1 Rozet kataloğu ve otomatik verme
- **Dosyalar:** `app/badges/data.ts`, `utils/badgeAwarding.ts` (`awardBadgesForUser`), `app/api/award-badges/route.ts`
- **İş:** Influencer: `profile-expert`, `founder-member` (ilk 1000). Marka: `showcase-brand`, `pioneer-brand`.
  `official-business` artık yalnızca `syncOfficialBusiness` ile verilir.
- **Sorunlar:**
  - ✅ ~~**4.1-S1 [ORTA]**~~ ('use server' kaldırıldı; yalnızca sunucu içi çağrılar) Dosya `'use server'`; `awardBadgesForUser(anyUserId)` yetki kontrolsüz çağrılabilir bir aksiyon (yalnızca hak edilen rozetleri verdiği için etki düşük).
  - ✅ ~~**4.1-S2 [ORTA]**~~ (okumalar ve sayım service role ile; sayım hatasında rozet verilmiyor) `founder-member` sayımı RLS'e tabi istemciyle yapılıyor; satırlar gizlenirse fazla kişiye rozet gider. RPC fallback'i artık admin dışı oturumda hata veriyor.
  - ✅ ~~**4.1-S3 [DÜŞÜK]**~~ (kullanıcı kararıyla eşikler, saatlik görev verir/geri alır: `million-club` 1M+ takipçi (`lib/million-club.ts`); `lightning-fast`, `brand-ambassador`, `jet-approval`, `elite-budget` (`lib/activity-badges.ts`, veri `20261009000001`). `five-star` (5 Yıldız) mağaza yayınından sonra (karar 2026-10-10); `trendsetter`, `conversion-wizard`, `global`, `communication-expert`, `loyal-partner` "yakında" kalıyor) Katalogda verme mantığı olmayan rozetler: `brand-ambassador`, `lightning-fast`, `five-star`, `trendsetter`, `million-club`, `conversion-wizard`, marka v1.2/v1.3 rozetleri.

### 4.2 Rozet seçimi ve gösterimi
- **Dosyalar:** `components/badges/{BadgeSelector,BadgeDisplay,BadgeDetailList,BadgeCompactList,BadgeProgressInfo,BadgeCard,BadgeToggle}.tsx`
- **İş:** En fazla 3 rozet gösterilir; DB trigger'ı kazanılmamış rozetin gösterilmesini engeller.
- **Sorunlar:**
  - ✅ ~~**4.2-S1 [ORTA]**~~ (keşif kartları seçilen rozetleri gösteriyor, yalnızca kazanılmışlar; mavi tik her zaman; profil sayfası tüm rozet listesini bilinçli gösteriyor) `/profile/[username]` ve `utils/fetchInfluencers.ts` kullanıcının seçtiği `displayed_badges` yerine tüm kazanılmış rozetleri gösteriyor.
  - ✅ ~~**4.2-S2 [DÜŞÜK]**~~ (marka rozet sayfası `BadgeProgressInfo` ile kazanılanları gösteriyor; kazanma koşulları gerçek kurallarla güncellendi (Marka Elçisi artık "yakında" değil)) (ölü `profile/badges/actions.ts` dosyaları silindi) `influencer/profile/badges/actions.ts` (`updateDisplayedBadges`) ölü; marka rozet sayfası kazanılanları göstermiyor.

### 4.3 Spotlight üyeliği
- **Dosyalar:** `app/actions/spotlight.ts`, `app/dashboard/spotlight/**`, `app/spotlight/page.tsx`, `components/spotlight/*`
- **İş:** Planlar `ibasic`, `ipro`, `mbasic`, `mpro`. Satın alma kapalı; yalnızca admin açar (`toggleUserSpotlight`).
- **Sorunlar:**
  - ✅ ~~**4.3-S1 [YÜKSEK]**~~ (saatlik görev `lib/spotlight-expiry.ts` ile kapatıyor; canlıda 12 kullanıcı etkileniyordu) Süresi dolan Spotlight hiç kapanmıyor: `checkSpotlightStatus` kullanıcı istemcisiyle `spotlight_active` yazıyor,
    kolon beyaz listede olmadığı için sessizce düşüyor; cron da kapatmıyor. Süresi dolanlar sıralamada önde, +10 güven puanı ve mavi tik hakkı sürüyor.
    Fonksiyon ayrıca istemciden gelen `userId`'ye güveniyor.
  - ✅ ~~**4.3-S2 [ORTA]**~~ (fiyatlar `lib/spotlight-plans.ts`'te tek yerde (değerler değişmedi), seviye eşlemesi 2.9-S2 ile tekleşti; plan sayfaları metadata rolü okumuyor) Fiyatlar birden çok yerde sabit; seviye eşlemesi tutarsız (bkz. 2.9-S2); plan sayfaları metadata rolünü okuyor.
  - ✅ ~~**4.3-S3 [DÜŞÜK]**~~ (`/dashboard/influencer/spotlight` sahte istatistik gösteriyordu; artık `/dashboard/spotlight/influencer`'a yönleniyor. 2026-10-10, kullanıcı kararı: ajans sayfası ve Spotlight seçimindeki "Agency Edition" kartı kaldırıldı; ajans paketi gelince eklenir) `/dashboard/influencer/spotlight` menüde yok; `/dashboard/spotlight/agency` statik "Çok Yakında".

### 4.4 Benzer profiller
- **Dosyalar:** `app/actions/spotlight.ts` (`getSimilarInfluencers`), `SimilarProfilesModal.tsx`
- **Sorunlar:** ✅ ~~**4.4-S1 [YÜKSEK]**~~ (doğrulanmış hesaplardan okunuyor, oturum gerekli) Var olmayan `instagram_stats` kolonunu okuyor → takipçi hep 0, filtre neredeyse hiçbir şey döndürmüyor.
  Yetki/Spotlight kontrolü yok, `limit(5)` filtreden önce.

### 4.5 Herkese açık profil `/profile/[username]`
- **Dosyalar:** `app/profile/[username]/page.tsx`, `app/profile/actions.ts`
- **Sorunlar:**
  - ✅ ~~**4.5-S1 [YÜKSEK]**~~ (kullanıcı kararı 2026-10-07: profiller yalnızca giriş yapanlara görünür; mevcut davranış doğru) Giriş zorunlu (bkz. 1.1-S1); anon kullanıcının `users` SELECT politikası da yok (bkz. 7.3-S2).
  - ✅ ~~**4.5-S2 [ORTA]**~~ (geri linki izleyicinin rolüne göre; gizli profilin doğrudan açılması bilinçli bırakıldı) `is_showcase_visible=false` profiller açılabiliyor; geri linki influencer izleyici için bile `/dashboard/brand/discover`.
  - ✅ ~~**4.5-S3 [DÜŞÜK]**~~ (kullanıcı kararı 2026-10-08: profil görüntülenmeleri `profile_views` tablosuna kişi başına günde bir kaydediliyor, `record_profile_view`; sayılar yalnızca Spotlight üyesi influencer panelinde `ProfileViewsCard` ile, sunucuda okunuyor. `20261008000002`) `view_profile` / `click_profile` analitik olayları hiç gönderilmiyor.

### 4.6 Analitik olaylar
- **Dosyalar:** `app/actions/analytics.ts`, RPC `track_analytics_event`, tablo `analytics_events`
- **Sorunlar:**
  - ✅ ~~**4.6-S1 [ORTA]**~~ (anon yetkisi kaldırıldı, search_path sabit; `20261007000006`) RPC anon dahil herkese açık ve `search_path`'siz; `click_*` olayları için yalnızca markanın varlığına bakıyor → herkes istediği markanın analitiğini şişirebilir.
  - ✅ ~~**4.6-S2 [DÜŞÜK]**~~ (influencer tarafı için profil görüntülenmeleri eklendi (4.5-S3)) Yalnızca `view_advert` izleniyor; influencer tarafında analitik yok.

---

## 5. İletişim

### 5.1 Mesaj kutusu
- **Dosyalar:** `app/dashboard/messages/page.tsx`, `components/messages/MessagesPage.tsx`,
  `components/chat/{ModernChatWindow,ModernChatInput,MessageActionsMenu}.tsx`, `app/dashboard/messages/send/actions.ts`
- **İş:** Karşı tarafa göre gruplanmış sohbetler (teklif, başvuru, destek odaları birleşik), metin + görsel eki.
- **Sorunlar:**
  - ✅ ~~**5.1-S1 [YÜKSEK]**~~ (kullanıcı kararı: doğrudan mesaj açılmayacak. `?userId=` artık yeni oda açmıyor, yalnızca mevcut sohbeti açıyor; teklif listeleri teklifin kendi odasına gidiyor. Mobil tarafı 10.3-S4) Doğrudan sohbet başlatma bozuk: `MessagesPage.tsx` `offer_id`/`advert_application_id` olmadan oda ekliyor,
    `restrict_rooms_insert` trigger'ı reddediyor; `?userId=` ile mevcut oda yoksa yalnızca konsola hata düşüyor. Mobilde de aynı (10.3-S4).
  - ✅ ~~**5.1-S2 [YÜKSEK]**~~ (her oda için yalnızca son mesaj ve okunmamış sayısı; 20'lik gruplar halinde paralel) Sunucu sayfası tüm odaların tüm mesajlarını iki kez, sınırsız yüklüyor; PostgREST 1000 satır sınırı son mesajları ve okunmamış sayılarını kesiyor.
  - ✅ ~~**5.1-S3 [ORTA]**~~ (thread yalnızca karşı taraf değişince yükleniyor; realtime kanalı liste güncellemesinde yeniden kurulmuyor) Her yeni mesaj `conversations`'ı değiştirip tüm thread'i temizleyip yeniden yüklüyor (titreme).
  - ✅ ~~**5.1-S4 [ORTA]**~~ (yalnızca chat-attachments adresi görsel sayılıyor, diğerleri düz metin; boyut sınırı PR #19) Görseller `![image](url)` ile algılanıyor; herkes istediği URL'yi gönderip `next/image` üzerinden açtırabiliyor (bkz. 8.5-S1). Ek boyut kontrolü yok.
  - ✅ ~~**5.1-S5 [ORTA]**~~ (5 MB/görsel sınırı canlıda; yükleme politikası oda katılımcısıyla sınırlandı — canlıda mevcut "Authenticated users can upload chat attachments" politikası ALTER ile daraltıldı, bkz. `20261007000017`) `chat-attachments` bucket'ı hiçbir migration'da yok, politika yok; public URL ile servis ediliyor (bkz. 7.5-S2).
  - ✅ ~~**5.1-S6 [DÜŞÜK]**~~ (okunmamış sayısı kenar çubuğunda tek kanca/tek kanalla izleniyor) Her mesajda engel kontrolü için sunucu aksiyonu; `SidebarLink` iki kez render edilip aynı adlı iki kanal açıyor.

### 5.2 Eski sohbet sayfası
- **Dosyalar:** `app/chat/[roomId]/page.tsx`, `components/chat/ChatWindow.tsx`
- **Sorunlar:** ✅ ~~**5.2-S1 [DÜŞÜK]**~~ (yetim `/chat` sayfası ve `ChatWindow` silindi) Hiçbir yerden bağlanmıyor (yetim), dashboard layout'u dışında; robots'ta engellenmemiş.

### 5.3 Okundu takibi
- **2026-10-10'dan beri tek sistem:** `public.room_reads` (user_id, room_id, last_read_at; RLS: yalnızca kendi satırı ve katıldığı oda;
  zaman sunucu saatini geçemez). Kod: `lib/room-reads.ts`; web mesaj kutusu, kenar çubuğu sayacı, teklif/başvuru rozetleri ve
  mobil mesaj ekranı (`PATCH /api/mobile/messages`) bunu kullanır.
- Eski: `message_reads` tablosu (canlıda yok) ve `auth.user_metadata["last_read_<roomId>"]` (artık okunmuyor/yazılmıyor).
- **Sorunlar:**
  - ✅ ~~**5.3-S1 [YÜKSEK]**~~ (`message_reads` tablosu canlıda yok, rozetler hep 0 çıkıyordu; sayım `last_read_<roomId>` metadata ile, `lib/unread-messages.ts`) Teklif ve başvuru ekranlarındaki okunmamış rozetleri hiç temizlenmiyor.
  - ✅ ~~**5.3-S2 [ORTA]**~~ (2026-10-10: `room_reads` tablosu + RLS + tetikleyici, migration `20261010000000_room_reads.sql` canlıya uygulandı; mevcut 11 metadata anahtarının 10'u (biri silinmiş odaya ait) tabloya taşındı, RLS canlıda denendi. Birleşik sohbet açılınca aynı kişiyle olan tüm odalar okundu oluyor. Eski anahtarların silinmesi 5.3-S3) Sistem B her mesaj sayısı değişiminde metadata yazıyor; her oda için bir anahtar ekleyerek JWT/çerezi şişiriyor;
    aynı kişiyle birleşik odalardan yalnızca seçili oda okundu oluyor.
  - ✅ ~~**5.3-S3 [DÜŞÜK]**~~ (2026-10-10: kullanıcı onayıyla eski anahtarlar canlıda silindi; `last_read_` içeren kullanıcı sayısı 0 olarak doğrulandı) Kullanıcıların auth metadata'sında eski `last_read_<roomId>` anahtarları duruyor
    (canlıda 5 kullanıcıda 11 anahtar). Hiçbir kod okumuyor; zararsız ama JWT'de yer kaplıyor. Silmek için (veri değişikliği, kullanıcı çalıştırır):
    `UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data - ARRAY(SELECT k FROM jsonb_object_keys(raw_user_meta_data) k WHERE k LIKE 'last_read_%') WHERE raw_user_meta_data::text LIKE '%last_read_%';`

### 5.3b Realtime yayını (2026-10-07)
- ✅ Canlıda yayında yalnızca `messages` vardı: teklif, başvuru, oda, gizlenen teklif, bildirim, destek, şikâyet ve rozet
  dinleyicilerine hiç olay gelmiyordu. 8 tablo eklendi (`20261007000016`; hepsinde RLS açık, kolon gizleme yok).
  `users` bilerek eklenmedi (gizli kolonlar). Var olmayan `message_reads` dinleyicileri (aynı kanaldaki `messages`
  aboneliğini bozabiliyordu) kaldırıldı. `users` tablosunu dinleyen 4 kanal hâlâ olay almaz (tasarım gereği).

### 5.4 Bildirimler
- **Dosyalar:** `components/dashboard/NotificationsPopover.tsx`, `app/actions/notifications.ts`, tablo `notifications`
- **Sorunlar:**
  - ✅ ~~**5.4-S1 [YÜKSEK]**~~ (2026-10-09, kullanıcı kararı: `lib/notify.ts`; yeni teklif, teklif yanıtı / görüşme isteği, yeni başvuru, başvuru sonucu, yeni mesaj (oda başına saatte bir, çevrimiçiyken e-posta yok, içerik e-postaya konmaz), destek yanıtı, sarı tik değişikliği için site içi bildirim; önemli olaylarda e-posta. Mobilden gelen olaylar mobil güncellemesinde) Yeni teklif, teklif durumu, yeni başvuru, başvuru durumu, yeni mesaj, destek yanıtı için hiçbir bildirim ya da e-posta üretilmiyor.
    Tek üreticiler admin paneli ve Spotlight bildirimi.
  - ✅ ~~**5.4-S2 [DÜŞÜK]**~~ (etiket kaldırıldı) Header herkese sabit "PREMIUM" etiketi gösteriyor.

### 5.5 Otomatik mesajlar / hoş geldin mesajı
- **Dosyalar:** `lib/welcome-message.ts`, `app/actions/automated-messages.ts`
- **Sorunlar:**
  - ✅ ~~**5.5-S1 [ORTA]**~~ (olmayan kolonlar kaldırıldı) Hoş geldin mesajı migration'larda olmayan kolonlara yazıyor (`messages.receiver_id`, `is_read`, `rooms.last_message_at`) → büyük ihtimalle sessizce başarısız (doğrulanmadı).
  - ✅ ~~**5.5-S2 [ORTA]**~~ (gönderen en eski admin hesabı; destek@ hesabı hiç yoktu, mesaj hiç gitmiyordu) İki destek kimliği: kod `destek@influmatch.net`'i arıyor, migration `support@influmatch.com` (id `000…0`) ekliyor.
  - ✅ ~~**5.5-S3 [DÜŞÜK]**~~ (ikinci `sendNotification` server action'ı silindi; vitrin bildirimi sunucuda yazılıyor, bağlantısı panele gidiyor) `sendNotification` adı iki modülde farklı imzayla export ediliyor; Spotlight bildirim metni influencer'a yönelik.

### 5.6 Engelleme ve şikayet
- **Dosyalar:** `app/dashboard/users/block/actions.ts`, `app/dashboard/messages/report/actions.ts`, tablolar `user_blocks`, `message_reports`
- **İş:** Çift yönlü engel kontrolü (trigger + aksiyon), mesajlar değiştirilemez (trigger), şikayetler admin'e.
- **Sorunlar:**
  - ✅ ~~**5.6-S1 [ORTA]**~~ (uygulama artık çağırmıyor; istemci rollerinden yetki kaldırıldı) `log_message` RPC'si anon dahil herkese açık; mesaj içeriğini (200 karakter) ve kullanıcı id'lerini Postgres loglarına yazıyor (loglarda kişisel veri, spam edilebilir).
  - ✅ ~~**5.6-S2 [DÜŞÜK]**~~ (`checkIfBlocked` silindi, `isUserBlocked` kaldı) `checkIfBlocked` ve `isUserBlocked` aynı işi yapıyor.

---

## 6. Admin

Tüm admin sayfaları rolü kendi içinde kontrol ediyor; `app/admin/layout.tsx` yok, kontrol bloğu ~25 kez kopyalanmış.

### 6.1 Admin paneli `/admin`
- **Dosyalar:** `app/admin/page.tsx`, `components/admin/AdminPanel.tsx`
- **İş:** Tüm kullanıcılar (service role, `ADMIN_USER_SELECT`), onay bekleyen / doğrulanmış / reddedilmiş sekmeleri, toplu işlemler,
  Spotlight ve rozet modalları, vergi levhası incelemesi, kurumsal e-posta durumu, ilanlar, başvurular, bildirim gönderimi.
- **Sorunlar:**
  - ✅ ~~**6.1-S1 [ORTA]**~~ (oturum kontrolü try dışında; bakım mesajı genelleştirildi) `redirect('/login')` `try` içinde; NEXT_REDIRECT yakalanıp "Bir Hata Oluştu" ekranı gösteriliyor.
  - ✅ ~~**6.1-S2 [DÜŞÜK]**~~ (2026-10-08: `/admin` sayfasında da PGRST116 çıkarıldı, sabit "21-23 Kasım" mesajı genel mesaja çevrildi) `PGRST116` rate limit sayılıyor; eski "21-23 Kasım bakım" mesajı sabit; başka statüdeki kullanıcılar hiçbir listede yok.
  - ✅ ~~**6.1-S4 [DÜŞÜK]**~~ (2026-10-09, yeni bulgu) Admin menüsünde "geçici" bir Dashboard bağlantısı marka paneline gidiyordu; yerine Mesajlar, Geri Bildirimler, Destek Talepleri.
  - ✅ ~~**6.1-S3 [ORTA]**~~ (toplu silme deleteUser kullanıyor; kendini/admini silme koruması PR #7) Toplu silme kendini veya başka bir admini silmeye karşı korumasız.

### 6.2 Admin aksiyonları (`app/admin/actions.ts`)

| Aksiyon | İş | Bilinen sorun |
|---|---|---|
| `verifyUser` / `rejectUser` / `updateAdminNotes` | statü ve not | ✅ rozet hatasında da sayfalar tazeleniyor |
| `manuallyAwardBadges` | — | **ölü** |
| `manuallyAwardSpecificBadge` | rozet ver (mavi tik → override) | — |
| `toggleUserSpotlight` | Spotlight aç/kapa, kullanıcıyı otomatik doğrular | ✅ hata metninden admin e-postası çıkarıldı |
| `verifyTaxId` | vergi onayı → `syncOfficialBusiness` | — |
| `resendVerificationEmail` / `forceVerifyEmail` | auth e-posta işlemleri | ✅ site URL'si yoksa influmatch.net |
| `resetVerifiedBadges` / `setBlueTickOverride` / `toggleBlueTick` | mavi/sarı tik | — |
| `deleteUser` | profil + auth silme | ✅ ~~**6.2-S1 [YÜKSEK]**~~ (ortak silme fonksiyonu; admin kendini ve diğer adminleri panelden silemez) profil silme hatası yalnızca loglanıyor (aktif anlaşma trigger'ı hatası yutuluyor), kendini/admini silme koruması yok |
| `getAllAdverts` / `deleteAdvertAdmin` | ilan yönetimi | dosya yolu `split('/').pop()` → alt klasördeki dosyalar artık kalıyor |
| `adminUpdateInstagramData` | Apify ile IG güncelle | ✅ ~~**6.2-S2 [ORTA]**~~ (kullanıcı yenilemesiyle aynı `refreshInstagramAccount`: kilit, geçmiş, profil ve mavi tik senkronu; doğrulanmamış hesabı doğrulamaz) her zaman `is_verified:true` yazıyor, `syncBlueTick` çağırmıyor |
| `adminManualConnectInstagram` | IG'yi elle bağla | ✅ hedef rol, kullanıcı adı çakışması, geçmiş satırı |
| `getAllApplications` / `getAdminUserCard` / `getTaxDocumentUrl` / `rejectTaxVerification` | okuma, imzalı URL, red | — |

### 6.3 Bildirim gönderimi
- **Dosyalar:** `components/admin/NotificationsPanel.tsx`, `app/actions/notifications.ts`
- **Sorunlar:** ✅ ~~**6.3-S1 [DÜŞÜK]**~~ (başlık/mesaj uzunluğu, tür, yalnızca site içi bağlantı, en fazla 5000 alıcı, 500'lük parçalar) Toplu gönderimde boyut sınırı yok, `link` doğrulanmıyor; "tüm kullanıcılar" sunucu props'undan geliyor.

### 6.4 Geri bildirim yönetimi `/admin/feedback`
- **Dosyalar:** `app/admin/feedback/{page,actions}.ts(x)`, `components/admin/FeedbackAdminPanel.tsx`
- **Sorunlar:** ✅ ~~**6.4-S1 [DÜŞÜK]**~~ (`updateFeedbackNote`; panelde not ekle/düzenle) `admin_notes` gösteriliyor ama yazan aksiyon yok.

### 6.5 Destek yönetimi `/admin/support`
- **Dosyalar:** `app/admin/support/{page,actions}.ts(x)`, `components/admin/SupportTicketsPanel.tsx`
- **Sorunlar:** ✅ ~~**6.5-S1 [ORTA]**~~ (kapatılmış talebin yeniden açılması düzeltildi; yanıtta kullanıcıya bildirim + e-posta, yanıt metni e-postaya konmuyor) `addAdminResponse` kapalı talebi bile `in_progress`'e çekiyor; kullanıcıya bildirim/e-posta gitmiyor.

### 6.6 Mesaj şikayetleri `/admin/messages`
- **Dosyalar:** `app/admin/messages/{page,actions}.ts(x)`, `components/admin/MessageReportsPanel.tsx`
- **Sorunlar:** ✅ ~~**6.6-S1 [YÜKSEK]**~~ (mesaj silinmiyor, içerik sabit metinle değiştiriliyor; orijinal içerik `message_reports.message_snapshot`ta saklanıyor) `deleteMessage` kullanıcı istemcisiyle siliyor; `messages` için DELETE politikası yok (ve silmeyi engelleyen trigger var) →
  0 satır silinip başarı dönüyor. Silme çalışsa bile `ON DELETE CASCADE` şikayet kaydını da siler (denetim izi kaybı).

### 6.7 API anahtar havuzu ekranı `/admin/api-keys`
- **Dosyalar:** `app/admin/api-keys/{page,data,actions}.ts(x)`, `components/admin/ApiKeysPanel.tsx`
- **İş:** Apify anahtarlarını ekle, sırala, kapat, sağlık kontrolü, test e-postası. Gizli anahtarlar maskeli.
- **Sorunlar:**
  - ✅ ~~**6.7-S1 [DÜŞÜK]**~~ (2026-10-10, kullanıcı kararı: Gemini tamamen kaldırıldı — `lib/gemini.ts` silindi; havuz, sağlık kontrolü, saatlik görev, admin ekranı ve ortam belgeleri yalnızca Apify. Tablodaki `provider` CHECK kısıtı ve canlıdaki 1 gemini satırı bırakıldı; kod bu satırları listelemiyor/kontrol etmiyor. 2026-10-10 itibarıyla satır canlıda hâlâ duruyor (1 adet); kullanıcı isterse SQL Editor'de siler: `DELETE FROM public.api_keys WHERE provider = 'gemini';`. `moveApiKey` kısmı 6.7-S2'ye ayrıldı) Gemini sağlayıcısı listede ama artık hiçbir modül kullanmıyor (bkz. 8.3-S2); `moveApiKey` transaction'sız.
  - ✅ ~~**6.7-S2 [DÜŞÜK]**~~ (2026-10-10: `public.move_api_key(p_id, p_direction)` SECURITY DEFINER SQL fonksiyonu tek ifadede sağlayıcının anahtarlarını kilitler, komşuyla yer değiştirir ve sırayı 10/20/30 diye yeniden yazar; yalnızca service role çalıştırabilir. Migration `20261010000002_move_api_key.sql` canlıya uygulandı, yetkiler ve geri alınan denemeyle davranış doğrulandı) (6.7-S1'den ayrıldı) `moveApiKey` transaction'sız; yarıda kalırsa sonraki sıralamada numaralar yeniden düzeliyor.

### 6.8 Manuel Instagram bağlama `/admin/manual-connect`
- **Dosya:** `app/admin/manual-connect/page.tsx`
- **Sorunlar:** ✅ ~~**6.8-S1 [ORTA]**~~ (sunucu kontrolü `app/admin/layout.tsx`; admin panelinde "Manuel Instagram Bağlama" bağlantısı. Aksiyon artık hedefin influencer olduğunu, kullanıcı adının başka hesapta olmadığını kontrol ediyor, geçmiş satırı yazıyor) Sayfada sunucu tarafı admin kontrolü yok (aksiyon kontrol ediyor); panelden bağlantı yok.

### 6.9 Vergi levhası inceleme
- **Dosya:** `components/admin/TaxVerificationReview.tsx` (AdminPanel içinde). Onay `verifyTaxId`, red `rejectTaxVerification`. Bilinen açık sorun yok.

---

## 7. Veri katmanı (Supabase)

### 7.1 Migration düzeni
- `supabase/schema.sql` (temel) + `supabase/migrations/`: **58 zaman damgasız** eski dosya (`add_*`, `fix_*`, `delete_*`, `test_*`; elle SQL Editor'a yapıştırılmak üzere,
  bazıları yalnızca tanı SELECT'i) + 20241129 → 20261007 zaman damgalı dosyalar. Migration çalıştırıcı yok.
- `supabase/cron/hourly_jobs.sql` — pg_cron + Vault, elle çalıştırılır.
- **Sorunlar:**
  - ✅ ~~**7.1-S1 [YÜKSEK]**~~ (2026-10-09: canlı şemadan katalog sorgularıyla tam temel üretildi, `20261009000000_schema_baseline.sql`: 26 tablo, kısıtlar, 99 indeks, 33 fonksiyon, 20 trigger, 74 politika, tablo/kolon/fonksiyon yetkileri, realtime, kovalar. Eski dosyalar `_archive/`. Yeni kurulum: temel + sonraki migration'lar, `supabase/README.md`. Önceki not: kısmen: bilinen sapmalar `20261007000011` ile kapatıldı, `20260316000001` artık influencer_id'yi kendisi ekliyor. Tam doğrulama için repo dosyalarını boş bir veritabanında sırayla çalıştıran bir deneme gerekir) Canlı DB repodan neredeyse kesin sapmış (bkz. 7.6); migration'lar sıfırdan sırayla oynatılamıyor (`20260316000001` var olmayan `influencer_id`'yi kullanıyor).
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
| `collaborations` | teklif/başvuru kabulünden doğan iş birliği (3.14) | taraflar ve admin okur; yazma yalnızca sunucu |
| `rate_cards` | influencer fiyat kartı (3.14) | sahibi, doğrulanmış marka ve admin okur; yazma yalnızca sunucu |
| `collaboration_agreements` / `collaboration_deliverables` / `collaboration_submissions` / `collaboration_payments` | anlaşma özeti, teslimatlar, taslak geçmişi, ödeme teyidi (3.18) | taraflar ve admin okur; yazma yalnızca sunucu |
| `offer_templates` | marka teklif şablonları (3.15) | sahibi okur; yazma yalnızca sunucu |
| `saved_adverts` / `advert_alerts` | kaydedilen ilanlar, ilan alarmları (3.15) | sahibi okur; yazma yalnızca sunucu |
| `advert_alert_runs` | alarm eşleştirmesi yapılan ilanlar (3.15) | yalnızca service role |

### 7.3 `users` koruma katmanı
- RLS: authenticated herkes okur; anon için SELECT politikası **yok**. Kolon bazlı gizlilik: email, phone, tax_id, tax_office, tax_office_city,
  admin_notes ve sonradan eklenen tüm kolonlar (blue_tick_override, corporate_email…) istemciye kapalı.
- Trigger'lar: `users_before_insert_guard` (güvenli değerler), `users_before_update_guard` (yazılabilir kolon beyaz listesi, vergi doğrulama,
  yasal bilgi değişince onay/sarı tik sıfırlama, kazanılmamış rozet gösterimini engelleme, web sitesi alan adı değişince kurumsal e-posta onayını düşürme),
  `check_user_deletion_integrity`, auth tarafında `handle_new_auth_user`, `on_auth_user_email_verified`, `sync_user_email_from_auth`.
- **Sorunlar:**
  - ✅ ~~**7.3-S1 [ORTA]**~~ (`20261008000001`: olmayan kolonlar listeden çıktı, mobil push için `push_token` eklendi; `push_token` artık hiçbir istemciye okunmuyor) Beyaz listede `push_notifications_enabled`, `website` var ama bu kolonlar yok; `push_token` ise ne kolon ne beyaz listede (mobil push hiç kaydedilmiyor).
  - ✅ ~~**7.3-S2 [YÜKSEK]**~~ (`/api/check-username` düzeldi; anon profil okuma kullanıcı kararıyla kapalı kalıyor) Anon SELECT politikası olmadığı için herkese açık profil ve `/api/check-username` (kayıt öncesi her zaman "müsait" der) çalışmıyor.
  - ✅ ~~**7.3-S3 [ORTA]**~~ (canlıda realtime yayınında yalnızca messages var; users yok, sızıntı yolu yok) `users` realtime yayınındaysa `postgres_changes` olayları kolon yetkisine bakmadan tüm satırı gönderebilir → gizli kolon sızıntısı riski (canlıda doğrulanmalı).

### 7.4 RPC'ler ve fonksiyonlar
- **Güvenlik denetimi (2026-10-07):** tetikleyici fonksiyonların RPC çağrı izni kaldırıldı; `get_my_private_profile` /
  `get_offer_contact_email` anon'a kapatıldı; `website_host` search_path sabitlendi (`20261007000014`). Açık kalanlar:
  `is_admin()` anon'a açık (RLS'te kullanılıyor, gerekli); `pg_net` public şemada (taşımak riskli);
  **Auth → sızdırılmış şifre koruması kapalı** (Supabase'de yalnızca Pro planında açılabiliyor; Free planda panelde görünmüyor — Pro'ya geçilince açılmalı).
- **Performans denetimi (2026-10-07):** 17 indekssiz yabancı anahtar indekslendi (`20261007000015`). Ertelenenler (mevcut
  ölçekte etkisiz, kural yeniden yazımı riskli): 66 politikada `auth.uid()` satır başına değerlendiriliyor (`(select auth.uid())`
  ile sarılmalı), 123 "çoklu permissive politika" (aynı işlem için birden çok kural; 7.7 temizliğiyle birlikte birleştirilmeli),
  15 kullanılmayan indeks (veri az, yanıltıcı).
- **2026-10-08:** `20261008000001` tüm politikalarda `auth.uid()` / `auth.role()` / `is_admin()` çağrılarını `(SELECT ...)` ile sarıyor
  (77 politika); `20261008000003` birebir kopya ve ölü 13 politikayı siliyor. Kalan çoklu permissive politikalar farklı koşullu
  (ör. teklifte gönderen/alıcı); birleştirmek okunabilirliği düşürür, ölçek gerektirene kadar bırakıldı.
- **Yeni bulgular (2026-10-08, `20261008000001` ile kapatıldı):**
  - ✅ ~~**7.4-S4 [YÜKSEK]**~~ `messages` üzerindeki ikinci INSERT kuralı ("User can send messages to their rooms") gönderen ve engel
    kontrolü yapmıyordu; permissive kurallar OR'landığı için odadaki taraf karşı taraf adına mesaj yazabiliyor ve engeli atlayabiliyordu.
  - ✅ ~~**7.4-S5 [ORTA]**~~ `track_analytics_event` içindeki hedefsiz `RETURNING id` yüzünden her çağrı hata veriyordu; kod tabloya
    doğrudan yazıyordu ve tablo herkese yazılabilirdi (marka analitiği şişirilebiliyordu). Fonksiyon düzeltildi, doğrudan yazım kapatıldı.
  - ✅ ~~**7.4-S6 [ORTA]**~~ `users` için "Public profiles are viewable by everyone" anon'a açıktı ve anon kolon yetkileri vardı:
    giriş yapmadan profiller API'den okunabiliyordu (kural 2'ye aykırı). Kural authenticated'a daraltıldı, anon okuma yetkisi kaldırıldı.
  - ✅ ~~**7.4-S8 [DÜŞÜK]**~~ (2026-10-09, `20261009000002`, kullanıcı çalıştırdı, canlıda doğrulandı) `restrict_social_accounts_columns` ve `protect_social_account_metrics`
    trigger'ları tabloda olmayan kolonlara (`following_count`, `verified_at`, `avg_likes`) yazıyordu; istemci UPDATE kuralı
    olmadığı için tetiklenmiyordu. Doğru kolonlarla yeniden yazıldı (kullanıcı SQL'i çalıştırınca ✅).
  - ✅ ~~**7.4-S9 [DÜŞÜK]**~~ (2026-10-09 canlıda doğrulandı: eski fonksiyonlar ve `message_logs` yok; temizlik SQL'i: `supabase/manual/2026-10-09_temizlik.sql` / `20261009000003`; ayrıca `messages` ve `social_accounts` üzerindeki tekrar eden trigger'lar ve boş `message_logs` tablosu. Kullanıcı çalıştırınca ✅) Kullanılmayan fonksiyonlar: `protect_user_critical_data`, `restrict_users_sensitive_columns` (trigger'ı yok),
    `log_message` (uygulama çağırmıyor). `offers` üzerinde aynı işi yapan iki trigger (`restrict_offers_trigger`,
    `secure_offers_trigger`). DROP gerektirdiği için toplu temizlik SQL'ine bırakıldı.
  - ✅ ~~**7.4-S7 [DÜŞÜK]**~~ `rooms` "System can create rooms" `WITH CHECK (true)`; `message_logs` herkese yazılabilirdi.
- Güvenli: `is_admin()`, `get_my_private_profile()`, `get_offer_contact_email()`, `award_user_badge()` (artık yalnızca admin/sunucu),
  `is_valid_tax_number()`, `website_host()`, `record_api_key_result()` (yalnızca service role).
- **Sorunlar:**
  - ✅ ~~**7.4-S1 [ORTA]**~~ (her iki RPC de anon'a kapalı) `track_analytics_event` ve `log_message` anon dahil herkese açık (bkz. 4.6-S1, 5.6-S1).
  - ✅ ~~**7.4-S2 [ORTA]**~~ (public şemasındaki tüm SECURITY DEFINER fonksiyonlarında search_path = public) SECURITY DEFINER trigger fonksiyonlarının çoğunda `search_path` sabitlenmemiş.
  - ✅ ~~**7.4-S3 [DÜŞÜK]**~~ (canlıda fonksiyon yok; repo `20261008000003` ile eşitlendi) `handle_delete_auth_user` boş taslak, trigger'ı yorumda.

### 7.5 Storage bucket'ları

| Bucket | Tanım | Politika | Risk |
|---|---|---|---|
| `avatars` | elle | public okuma; yazma ilk klasör = uid | web marka/influencer ve mobil yükleme yolları uymuyor |
| `advert-hero-images` | elle | yalnızca kendi `{uid}/` klasörüne yükler (2026-10-09_kapak_politikasi.sql); sahibi siler | eski dosyalar kökte |
| `feedback-images` | elle | aynı desen | destek ekleri de burada (public) |
| `tax-documents` | migration | özel; yalnızca kendi klasörüne INSERT | — |
| `chat-attachments` | `20261008000004` | gizli; okuma ve yükleme oda taraflarına | imzalı URL |

- **Sorunlar:**
  - ✅ ~~**7.5-S1 [YÜKSEK]**~~ (2026-10-09: "avatars insert" `2026-10-09_mobil_sikilastirma.sql` ile kaldırıldı, canlıda doğrulandı; kendi klasörüne yükleme "Users can manage their own avatar" ile sürüyor. Önceki not: ölü "Tam Yetki" politikaları 7 Ekim toplu SQL'iyle silindi (doğrulandı). Kalan tek iş: "avatars insert" yayındaki mobil sürüm public/<uid>/ yüklediği için mobil sürüm çıkınca kaldırılacak) `20260317000005` dosyası var olmayan `storage.policies` tablosundan DELETE yapıyor; dosyanın tamamı hata verip geri alınmış olabilir
    (avatars politikaları, users SELECT değişikliği ve `track_analytics_event` sertleştirmesi dahil). Canlıda kontrol edilmeli.
  - ✅ ~~**7.5-S2 [ORTA]**~~ (`20261008000004`: kova gizli, okuma yalnızca oda taraflarına; sohbet görselleri 1 saatlik imzalı bağlantıyla, admin raporlanan fotoğrafı 10 dk'lık bağlantıyla açıyor) `chat-attachments` için migration ve politika yazılmalı, özel bucket + imzalı URL'ye geçilmeli.

### 7.6 Şema kayması (kodda var, migration'da yok)
- ✅ ~~**7.6-S1 [YÜKSEK]**~~ (`20261007000011` ile repoya eklendi) `advert_applications.influencer_id` — politikalarda, web ve mobilde kullanılıyor, hiç oluşturulmamış.
- ✅ ~~**7.6-S2 [ORTA]**~~ (`20261007000011`) `social_accounts.verification_code`, `has_stats`, `last_scraped_at` — kod yazıyor; canlıda var olmalı, repoda yok.
- ✅ ~~**7.6-S3 [ORTA]**~~ (`20261007000011`) `users.role='admin'` — `schema.sql` CHECK yalnızca influencer/brand'e izin veriyor; hiçbir migration genişletmiyor.
- ✅ ~~**7.6-S4 [DÜŞÜK]**~~ (temel dosyası canlıyı birebir yansıtıyor; kodda geçen olmayan kolonlar 5.5-S1 ile kaldırılmıştı, mobil `feedback` 10.3-S8 ile düzeltildi) `feedback` tablosu (mobil), `rooms.last_message_at`, `messages.receiver_id`, `messages.is_read`, `advert_projects.brand_id`, `users.push_token`.

### 7.7 Çakışan migration'lar
- ✅ ~~**7.7-S1 [YÜKSEK]**~~ (advert_applications için `20261007000005` canlıda uygulandı) Permissive politikalar OR'lanıyor: `advert_applications` için "kabul edilmişse silinemez" kuralı eski serbest politika düşürülmediği için etkisiz;
  doğrulanmamış influencer da başvurabiliyor.
- ✅ ~~**7.7-S2 [ORTA]**~~ (`20261007000009` 7 Ekim toplu SQL'iyle uygulandı; gevşek kurallar silindi, doğrulandı) Eski `fix_advert_projects_rls.sql` uygulanmışsa doğrulanmamış markalar ilan açabilir.
- ✅ ~~**7.7-S3 [DÜŞÜK]**~~ (temel dosyasında `handle_new_auth_user` tek tanım; enum `spotlight_plan_enum` (ibasic, mbasic, ipro, mpro). Önceki not: koddaki `'basic'|'pro'` cast'i kaldırıldı; kalan iş fonksiyon geçmişini baseline migration'da tek tanıma indirmek, 7.1-S1) `handle_new_auth_user` 8 kez yeniden tanımlanmış; `spotlight_plan` CHECK → enum → enum geçişi kayıplı eşleme yapmış, kodda hâlâ `'basic'|'pro'` cast'i var.

---

## 8. Altyapı ve entegrasyonlar

### 8.1 API route'ları

| Route | Yetki | İş |
|---|---|---|
| `GET /api/auth/{instagram,tiktok}/login` · `callback` | oturum + state çerezi | OAuth bağlama (2.3) |
| `POST /api/mobile/verify-{instagram,tiktok}` | Bearer JWT | mobil bio doğrulama (2.1-S1: sınırsız) |
| `GET /api/cron/refresh-stats` | `Bearer CRON_SECRET` | günlük istatistik yenileme (2.2) |
| `GET /api/cron/hourly` | `Bearer CRON_SECRET` | anahtar sağlık kontrolü + e-posta, mavi tik taraması, iş birliği otomatik tamamlama (3.14), teklif süresi ve ilan alarmları (3.15) |
| `GET/POST/DELETE /api/mobile/offer-templates` · `GET/POST /api/mobile/saved-adverts` · `GET/POST/DELETE /api/mobile/advert-alerts` | Bearer JWT | teklif şablonları (marka), kaydedilen ilanlar ve alarmlar (influencer) (3.15) |
| `GET/POST /api/mobile/collaborations` · `GET/PUT /api/mobile/rate-card` | Bearer JWT | iş birliği listesi ve işlemleri, fiyat kartı (3.14) |
| `GET/POST /api/mobile/collaborations/[id]` | Bearer JWT | takip alanı: anlaşma özeti, teslimatlar, ödeme teyidi (3.18) |
| `GET /api/mobile/first-steps` | Bearer JWT | ilk adımlar kontrol listesi durumu (3.16) |
| `POST /api/award-badges` | admin | rozet verme (2.6-S1) |
| `GET /api/check-username` | yok | kullanıcı adı müsaitliği (7.3-S2) |
| `GET /api/test-welcome` | yok | 410 dönen ölü taslak |
| `GET /auth/callback` | — | e-posta bağlantısı; her zaman çıkış yaptırıyor (1.4-S1) |

### 8.2 Zamanlanmış işler
- **Vercel cron** (`vercel.json`): `refresh-stats` her gün 09:00 UTC.
- **Supabase pg_cron** (`supabase/cron/hourly_jobs.sql`): her saat `/api/cron/hourly`, gizli anahtar Vault'ta.
- **Sorunlar:**
  - ✅ ~~**8.2-S2 [ORTA]**~~ (2026-10-09, yeni bulgu) Saatlik ve günlük cron yeni Apify koşusunu 25. saniyeye kadar başlatıyordu; koşu 45 sn sürebildiği için görev 60 sn sınırını aşıyor, pg_net zaman aşımı alıyordu (8 Ekim 06:00 ve 09:00). Yeni koşu en geç 10. saniyede başlıyor.
  - ✅ ~~**8.2-S1 [YÜKSEK]**~~ (Spotlight kısmı) Süresi dolan Spotlight'ı kapatan bir iş yok (4.3-S1); `refresh-stats` zaman aşımı (2.2-S2).

### 8.3 API anahtar havuzu
- **Dosyalar:** `lib/api-keys.ts` (`withApiKey`, otomatik geçiş, bekleme süreleri), `lib/apify.ts`, `lib/api-key-health.ts` (`lib/gemini.ts` 2026-10-10'da silindi, 6.7-S1)
- **Sorunlar:**
  - ✅ ~~**8.3-S1 [DÜŞÜK]**~~ (anahtarlar duruma göre sıralanıyor: sağlıklılar önce, kredisi biten/hata verenler sona) `isKeyUsable` bekleme süresi olmayan `exhausted`/`error` anahtarları yine deniyor.
  - ✅ ~~**8.3-S2 [DÜŞÜK]**~~ (içerik üretme fonksiyonu ve tipleri kaldırıldı; yalnızca anahtar sağlık kontrolü kaldı) `generateGeminiContent` ve `@google/generative-ai` paketi kullanılmıyor (vergi kontrolü yerelde).
  - ✅ ~~**8.3-S3 [DÜŞÜK]**~~ (`fetchExternal` 50 sn, Resend 15 sn; Apify `?timeout=45` ile çalıştırmayı da durduruyor) `fetch` çağrılarında zaman aşımı yok.

### 8.4 E-posta (Resend)
- **Dosya:** `lib/email.ts` (`sendEmail`, `sendAdminAlertEmail`). Kullanım: admin uyarıları, kurumsal e-posta kodları.
- **İzleme:** `lib/resend-status.ts` — her gönderimde Resend kota başlıkları kaydedilir; anahtar, gönderici alan adı ve kota durumu `/admin/api-keys` sayfasında ve saatlik kontrolde.
- **Sorunlar:**
  - ✅ ~~**8.4-S1 [YÜKSEK]**~~ (kullanıcı kararı: ücretsiz planda kalınıyor; kota %80'i geçince bildirim e-postaları duruyor (site içi sürer), doğrulama/şifre e-postaları etkilenmiyor, admin uyarısı saatlik kontrolde) Ücretsiz plan günde 100, ayda 3000 e-posta. Kurumsal e-posta kodları ve admin uyarıları aynı kotayı paylaşıyor; kota dolunca markalara kod gitmez. İzleme ve uyarı eklendi, risk sürüyor (çözüm: ücretli plan veya ikinci sağlayıcı).
  - bkz. 3.11-S2 ve 5.4-S1 (kullanıcıya işlem e-postası yok).

### 8.5 Konfigürasyon
- `next.config.js`, `vercel.json`, `package.json`, `middleware.ts`
- **Sorunlar:**
  - ✅ ~~**8.5-S1 [ORTA]**~~ (yalnızca Supabase deposu ve Instagram/TikTok CDN'leri; optimize görseller 31 gün önbellekte) `images.remotePatterns hostname: '**'` → görsel optimizasyonu açık proxy (maliyet/kötüye kullanım).
  - ✅ ~~**8.5-S2 [ORTA]**~~ (main'de Next 14.2.35) Next 14.0.4 eski ve güvenlik yamaları eksik; yükseltilmeli.
  - ✅ ~~**8.5-S4 [DÜŞÜK]**~~ (2026-10-09, yeni bulgu) Vercel Speed Insights bileşeni çift eklemeyi düzeltirken tamamen kaldırılmıştı; ölçüm toplanmıyordu. Kök layout'a geri eklendi.
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
- **8.7-S1 [KRİTİK]** (kısmen: dosya silindi; anahtarın rocketapi.io panelinde iptali kullanıcıda, iptal edilince ✅ yap) `test-rocket-reels-debug.js` dosyasında canlı görünen bir RocketAPI anahtarı commit'lenmiş. Anahtar iptal edilip yenilenmeli,
  dosya silinmeli (git geçmişinde kalacağı için iptal şart).
- ✅ ~~**8.7-S2 [DÜŞÜK]**~~ (takipten çıkarıldı) `.env.local.txt` `.gitignore`'a rağmen takip ediliyor (yalnızca URL + anon key).
- ✅ ~~**8.7-S3 [DÜŞÜK]**~~ (başıboş dosyalar silindi) Başıboş dosyalar: `validate_json.js`, `fix_turkish.js`, `crop_icon.py`, boş `types.ts`, `tsc_output.txt`, `tasarim-sistemi-analizi.txt`.
- ✅ ~~**8.7-S5 [ORTA]**~~ (2026-10-09, yeni bulgu) Sunucu ve tarayıcı kayıtlarına `console.log` ile kişisel veri yazılıyordu (admin e-postası, kayıt yanıtı, onboarding formu, Spotlight güncellemesinde hedef e-posta). Tüm `console.log` çağrıları kaldırıldı (44), uyarı kayıtlarında e-posta yerine kimlik.
- ✅ ~~**8.7-S4 [ORTA]**~~ (JSON-LD, sitemap ve robots influmatch.net) Alan adı tutarsızlığı: sitemap/robots/JSON-LD `influmatch.com`, geri kalan her şey `influmatch.net`.

### 8.9 Ürün notu: dosya depolama ("Drive" yapısı)
- **8.9-N1** (2026-10-10, güncel karar: Cloudflare R2 ile kurulacak, Akademi videolarıyla birlikte Kasım'da; bkz. `docs/ROADMAP.md`) Siteye Drive benzeri bir dosya yapısı kurulacak (karar, 7 Ekim): görseller ve dosyalar (avatar, logo, ilan kapakları,
  sohbet ekleri, vergi belgeleri) için düzenli klasör yapısı ve daha düşük depolama/aktarım maliyeti. Bugünkü durum: Supabase
  Storage'da `avatars` (çoğu `{uid}/` klasöründe, eskiler kökte), `advert-hero-images` ve `feedback-images` (kökte, rastgele ad),
  `chat-attachments` (`{uid}/{oda}/...`), `tax-documents` (özel). Hepsi herkese açık URL ile servis ediliyor (vergi hariç),
  görsel boyutlandırma Vercel'de. Tasarımda düşünülecekler: yüklemede boyut/format küçültme (ör. WebP, en fazla 1080 px),
  kullanıcı/varlık bazlı klasörler, silinen kayıtların dosyalarının temizlenmesi (hesap silmede yapılıyor), gizli dosyalar için
  imzalı URL, gerekirse ucuz depolama (ör. Cloudflare R2) ve CDN.

### 8.8 Dokümanlar
- Kökteki `DEPLOYMENT.md`, `FINAL_DEPLOYMENT_CHECKLIST.md`, `SUPABASE_SETUP_CHECKLIST.md`, `TRIGGER_SETUP.md`, `SUPABASE_RLS_FIX.md`,
  `MIGRATION_INSTRUCTIONS.md`, `CLEAN_START_GUIDE.md`, `GITHUB_PUSH_GUIDE.md`, `VERCEL_FIX.md`, `VERCEL_ROOT_DIRECTORY_FIX.md`, `README.md`.
- ✅ ~~**8.8-S1 [DÜŞÜK]**~~ (eski 10 belge silindi; tek güncel rehber `docs/SETUP.md`, README ona bağlanıyor, `env.example` güncellendi) Hepsi eski; `VERCEL_FIX.md` ile `VERCEL_ROOT_DIRECTORY_FIX.md` çelişiyor; CRON_SECRET, Resend, anahtar havuzu, pg_cron, bucket'lar ve migration sırası anlatılmıyor.

---

## 9. Landing ve SEO

### 9.1 Ana sayfa
- **Dosyalar:** `app/page.tsx`, `components/landing/*` (Hero, PartnersSection, Spotlight, FeaturesSection, DetailedStatsSection, VerificationCTA,
  ValueProposition, FAQSection, BadgesSection, Footer)
- **Sorunlar:**
  - ✅ ~~**9.1-S1 [ORTA]**~~ (ana sayfa vitrini is_showcase_visible=true filtreliyor) Vitrin `is_showcase_visible`'ı yok sayıyor; gizlenmiş profiller ana sayfada çıkabilir.
  - ✅ ~~**9.1-S2 [ORTA]**~~ (2026-10-10, kullanıcı kararı: başlık "Desteklenen Platformlar", yalnızca Instagram ve TikTok; "Resmi Partner" etiketi kaldırıldı) PartnersSection TikTok, Instagram, Meta, YouTube, Google logolarını "partner" olarak gösteriyor (ortaklık izlenimi / marka hakkı riski).
  - ✅ ~~**9.1-S3 [DÜŞÜK]**~~ (Footer `/discover` → `/spotlight`; gizlilik linki zaten düzgün. 2026-10-10, kullanıcı kararı "rakamları kaldır": ana sayfadaki sabit etkileşim/güven/sıklık rakamları, "%100 / 50+ / 10x / Tam" kutuları ve örnek profil kartındaki sayılar kaldırıldı) Sabit pazarlama rakamları ("%5.2", "10K+", "50+", "%100"); Footer'da kırık linkler (`/discover`, `/legal/privacy`); production'da `console.log`.

### 9.2 Sitemap ve robots
- **Dosyalar:** `app/sitemap.ts`, `app/robots.ts`
- **Sorunlar:**
  - ✅ ~~**9.2-S1 [YÜKSEK]**~~ (profiller site haritasından çıkarıldı, robots `/profile/` engelliyor; varsayılan alan adı influmatch.net) `/profile/*` ilan ediliyor ama giriş istiyor (1.1-S1); sitemap gizli profilleri de listeliyor ve sınırsız.
  - ✅ ~~**9.2-S2 [DÜŞÜK]**~~ (`/verify-phone` çıkarıldı; `/chat/`, `/auth/`, `/feedback`, `/forgot-password` engellendi) robots var olmayan `/verify-phone`'u engelliyor, `/chat/`'i engellemiyor.

### 9.3 Statik ve ölü sayfalar
- `/spotlight` (fiyatlar), `/badges` (katalog), `/cekilis` (404'e yönlendiriyor).
- ✅ ~~**9.3-S1 [ORTA]**~~ (app/cekilis silindi) `app/cekilis/actions.ts`: `'use server'` dosyasında altı gerçek isim ve sabit 6 haneli PIN'ler. Kullanılmıyor; silinmeli.
- ✅ ~~**9.3-S2 [DÜŞÜK]**~~ (`[locale]` layout'u daha önce silindi) `app/[locale]/layout.tsx` yalnızca layout, sayfası yok, ikinci `<html>` üretir; next-intl yapılandırılmamış.

---

## 10. Mobil uygulama (`mobile-app/`)

### 10.1 Yığın ve ekranlar
- Expo SDK 54, React Native 0.81, React Navigation 7, NativeWind, supabase-js (AsyncStorage oturumu), expo-notifications.
- **Auth:** Login, ForgotPassword, RegisterRole, RegisterForm, VerifyEmail, Onboarding.
- **Influencer:** Dashboard, Discover, Proposals, Messages, Profile + Spotlight, Badges, Analysis, Verification, Statistics, MyProfile, InfluencerDetail.
- **Marka:** BrandDashboard, Discover, BrandAdverts, BrandMessages, BrandProfile + BrandVerification.
- **Ortak:** Settings, Feedback, AiAssistant.

### 10.2 Kimlik ve veri erişimi
- Supabase e-posta/şifre; okumalar anon key + kullanıcı JWT'si ile PostgREST'ten. Kritik yazımlar web'in sunucu uçlarından
  (`/api/mobile/*`: offers, messages, adverts, applications, brand-verification, push-token, forgot-password, verify-*,
  2026-10-10'dan beri profile, showcase, support, feedback, notifications). Doğrudan tabloya yazmaya devam eden: favoriler (RLS'li).
  Onboarding 2026-10-10'dan beri `/api/mobile/onboarding` (10.3-S23). `API_BASE` varsayılanı influmatch.net, geliştirmede `EXPO_PUBLIC_API_BASE`.
- `app.json` varsayılan slug/ad ("mobile-app").

### 10.3 Web kurallarıyla uyumsuzluklar
- ✅ ~~**10.3-S1 [YÜKSEK]**~~ (2026-10-09: mobilde `lib/routing.js` web paneliyle aynı kapı; doğrulanmış Instagram/TikTok yoksa zorunlu `SocialVerifyGate` ekranı. Sunucuda da ilan başvurusu ve teklif kabul/görüşme doğrulanmış hesap ister: `lib/creator-verification.ts`) Influencer sosyal doğrulama zorunluluğu mobilde yok (web'de de yalnızca arayüz kapısı; DB zorlamıyor).
- ✅ ~~**10.3-S2 [YÜKSEK]**~~ (2026-10-09: ekran web akışıyla yeniden yazıldı — kurumsal kimlik, kurumsal e-posta kodu, vergi levhası PDF/fotoğraf; `/api/mobile/brand-verification`, ortak `lib/brand-verification.ts`. Sahte "Başvuru alındı, 1-3 iş günü" mesajı ve doğrulanmamış fayda iddiaları kaldırıldı) Marka doğrulama ekranı: VKN/TCKN istemci kontrolü yok, vergi dairesi/il yok, vergi levhası yükleme yok, kurumsal e-posta yok;
  `verification_status` yazımı beyaz liste tarafından sessizce düşürülüyor.
- ✅ ~~**10.3-S3 [YÜKSEK]**~~ (brand_id kullanılıyor; kalp yalnızca markalara) Favoriler bozuk (`user_id` kolonu kullanılıyor, tablo `brand_id`); influencer'lara da kalp gösteriliyor.
- ✅ ~~**10.3-S4 [YÜKSEK]**~~ (2026-10-09: detay ekranı oda açmıyor; marka teklif gönderiyor, mevcut sohbet varsa "Sohbete git") Doğrudan sohbet engelleniyor (`InfluencerDetailScreen.js` bağlantısız oda açıyor).
- ✅ ~~**10.3-S5 [YÜKSEK]**~~ (influencer_user_id de gönderiliyor) İlana başvuru bozuk (`influencer_user_id` NOT NULL, yalnızca `influencer_id` gönderiliyor).
- ✅ ~~**10.3-S6 [ORTA]**~~ (`<uid>/…` yolu) Avatar yüklemeleri `public/<uid>/…` yoluna gidiyor, politika ihlali (MyProfile hariç).
- ✅ ~~**10.3-S7 [ORTA]**~~ (2026-10-09: sunucu her bildirimde push da gönderiyor (`lib/push.ts`, metin e-postadaki sade metin, mesaj içeriği yok); token `/api/mobile/push-token` ile kaydediliyor, aynı cihazdaki eski hesaptan kaldırılıyor, çıkışta siliniyor; bildirime dokununca ilgili sekme açılıyor. **Kullanıcı adımı:** `eas init` ile EAS proje kimliği ve Android için FCM kimlik bilgisi — bunlar olmadan cihaz token alamaz) Push token'ları ve bildirim tercihi hiç kaydedilmiyor (7.3-S1).
- ✅ ~~**10.3-S8 [ORTA]**~~ (`feedback_submissions`'a yazıyor, hata gösteriliyor) Geri bildirim var olmayan `feedback` tablosuna gidiyor ama başarı gösteriliyor.
- ✅ ~~**10.3-S9 [ORTA]**~~ (sahte güven skoru satırı kaldırıldı; 2026-10-09: kartlarda istatistik yok, kullanılmayan sosyal hesap sorgusu ve işlevsiz "Tümünü Gör" düğmesi kaldırıldı) Keşfette doğrulanmamış istatistikler ve sahte güven skoru (`75 + charCode % 22`).
- ✅ ~~**10.3-S10 [ORTA]**~~ (2026-10-09: AI asistan ekranı ve girişi kaldırıldı; şifre sıfırlama `/api/mobile/forgot-password` ile token_hash bağlantısı üretip web'in yeni şifre ekranına götürüyor (her cihazda çalışır, kayıtlı adresi ele vermez, adres başına 2 dk / günde 5); profil tamamlamada web'deki içerik üretici türü seçimi eklendi) AiAssistant ekranı sabit cevaplı sahte sohbet; şifre sıfırlama kırık (1.4-S1); signup `creator_type` göndermiyor.
- ✅ ~~**10.3-S12 [YÜKSEK]**~~ (2026-10-09, yeni bulgu) Mobilde teklif özelliği hiç yoktu: marka teklif gönderemiyor, influencer teklif göremiyordu. `Teklifler` sekmesi (iki rol), detay ekranında teklif formu; işlemler `/api/mobile/offers` üzerinden web ile aynı kodla (`lib/offers.ts`).
- ✅ ~~**10.3-S13 [ORTA]**~~ (2026-10-09, yeni bulgu) İki ayrı mesaj ekranı vardı; mesajlar doğrudan tabloya yazıldığı için engel kontrolü ve bildirim atlanıyordu, influencer ekranı belirli sohbeti açamıyordu. Ortak `MessagesScreen`, gönderim `/api/mobile/messages` (`lib/messages.ts`), gizli kovadaki fotoğraflar imzalı bağlantıyla.
- ✅ ~~**10.3-S14 [ORTA]**~~ (2026-10-09, yeni bulgu) Influencer detay ekranında sabit cümlelerden oluşan "Detaylı Profil Analizi" ve "Akıllı Algoritma" ibaresi, uyuşmayan rozet adları, eksik şehirde "ANKARA", olmayan kovadan avatar. Analiz kaldırıldı; rozetler web kataloğundan (`constants/badges.js` web ile eşitlendi).
- ✅ ~~**10.3-S11 [DÜŞÜK]**~~ (2026-10-09: ilan kaydı/durum/silme `/api/mobile/adverts` üzerinden `lib/adverts.ts` ile; kapak web ve mobilde `{uid}/` klasörüne, yükleme politikası `2026-10-09_kapak_politikasi.sql` ile daraltılıyor) İlan ekleme var olmayabilecek `brand_id` kolonu gönderiyor; kapak görseli klasörsüz.
- ✅ ~~**10.3-S15 [ORTA]**~~ (2026-10-09, yeni bulgu) Mobilde başvuru, başvuru durumu ve ilan işlemleri doğrudan tabloya yazıyordu: ilan açık mı / mükerrer mi kontrolü, kapak görseli doğrulaması ve bildirimler atlanıyordu; influencer "Başvuruyu İptal Et" düğmesi hiçbir şey yapmıyordu. Hepsi `/api/mobile/adverts`, `/api/mobile/applications` üzerinden web ile ortak `lib/adverts.ts`; geri çekme gerçek ve yalnızca bekleyen başvuruda. Mobil düzenleme web'de girilmiş platform/teslimat/açıklama alanlarını artık ezmiyor.
- ✅ ~~**10.3-S16 [YÜKSEK]**~~ (2026-10-09, yeni bulgu) `expo-constants`, `expo-device`, `expo-notifications` SDK 55 sürümlerindeydi (uygulama SDK 54): yerel derleme/push kırılır. SDK 54 sürümlerine çekildi, `expo-document-picker` eklendi, `package-lock.json` güncellendi. Cihazda kurulum: `npx expo install --check`.
- ✅ ~~**10.3-S17 [ORTA]**~~ (2026-10-09, yeni bulgu) Mobil giriş yönlendirmesi ve reddedilmiş hesap kontrolü kullanıcının değiştirebildiği `user_metadata`'ya (`is_onboarded`, `verification_status`) bakıyordu. Artık veritabanından (`lib/routing.js`), web paneliyle aynı kurallarla.

- ✅ ~~**10.3-S18 [YÜKSEK]**~~ (2026-10-10, yeni bulgu) MyProfile ekranı canlıda olmayan `users.portfolio_urls` kolonunu okuyordu; sorgu hata verdiği için profil formu hiç dolmuyordu, portfolyo kaydı da sessizce düşüyordu. Web'de olmayan portfolyo ve web sitesi alanları kaldırıldı; kayıt `/api/mobile/profile` ile web'in `lib/profile-update.ts` koduyla (kategori web listesinden seçiliyor).
- ✅ ~~**10.3-S19 [YÜKSEK]**~~ (2026-10-10, yeni bulgu) Mobil destek talepleri hep başarısızdı: konu serbest metindi (tablo yalnızca 4 konu kabul ediyor), Ayarlar'daki form öncelik göndermiyordu. Ortak `SupportTicketForm` web'deki konu/öncelik listeleriyle, `/api/mobile/support` → `lib/support.ts`.
- ✅ ~~**10.3-S20 [ORTA]**~~ (2026-10-10, yeni bulgu) Ayarlar'daki bildirim anahtarı canlıda olmayan `push_notifications_enabled` kolonuna yazıyordu (hiçbir şeyi değiştirmiyordu). Kaldırıldı; satır telefonun bildirim ayarlarını açıyor.
- ✅ ~~**10.3-S21 [ORTA]**~~ (2026-10-10, yeni bulgu) Mobil onboarding influencer kategorisini web anahtarı yerine etiket olarak ("Moda, Güzellik", çoklu) yazıyordu; keşif filtresi bu profilleri bulamıyordu. Mobil artık web listesinden tek anahtar yazıyor (`mobile-app/constants/categories.js`). Canlıda eski değerli 4 profil var ("Moda" 3, "Güzellik" 1); `lib/category-map.ts` bunları anahtara çevirerek eşliyor. İstenirse veri düzeltmesi: `UPDATE public.users SET category = 'fashion' WHERE category = 'Moda'; UPDATE public.users SET category = 'beauty' WHERE category = 'Güzellik';`
- ✅ ~~**10.3-S22 [ORTA]**~~ (2026-10-10, kullanıcı kararı) Profil düzenleme, vitrin modu, destek talebi, geri bildirim ve bildirim okundu işaretleme doğrudan tabloya yazıyordu (web doğrulamaları atlanıyordu, ör. vitrinde bağlı hesap kontrolü, avatar adresi, sosyal link kuralları). Hepsi web ile ortak sunucu koduna taşındı: `/api/mobile/{profile,showcase,support,feedback,notifications}` → `lib/{profile-update,showcase,support,feedback,notification-reads}.ts`. Marka profil alanları web'le aynı (Marka Adı = `full_name`, Şirket Ünvanı, Şehir, İnternet Sitesi; olmayan "Telefon" kaldırıldı). Vitrinden çıkmak artık onaysız hesapta da serbest (web'de de).
- ✅ ~~**10.3-S23 [ORTA]**~~ (2026-10-10: web ve mobil aynı sunucu kodu `lib/onboarding.ts` `saveOnboarding`; web `saveOnboardingProfile` ve mobil `POST /api/mobile/onboarding` çağırır. Kullanıcı adı, profil fotoğrafı, sosyal linkler (web kuralları + normalize), influencer en az bir hesap, marka web sitesi + kurumsal e-posta + vergi no/daire/il sunucuda doğrulanır; rol istemciden değil kayıttan alınır. Mobil formda ad soyad / marka adı, web sitesi, kurumsal e-posta, vergi dairesi ve ili eklendi; `company_legal_name` ve sahte rozet notu kaldırıldı (resmi unvan marka doğrulama ekranında); `is_onboarded` metadata yazımı kalktı) Mobil onboarding `users`'a doğrudan yazıyor: sosyal linkler web kurallarıyla doğrulanmıyor, marka `tax_id` gönderiyor (beyaz liste düşürüyor) ve `is_onboarded` auth metadata'ya yazılıyor. Web onboarding'in sunucu koduna taşınmalı.

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
| 11.9 | `lib/gemini.ts` (2026-10-10'da tamamen silindi), `@google/generative-ai`, `pg`, `xlsx`, `uuid` |
| 11.10 | `checkIfBlocked` (kopya), `MessagesPage` içindeki kullanılmayan `ChatWindow` importu |
| 11.11 | Kök dizindeki başıboş script ve notlar (8.7-S3), eski deploy dokümanları (8.8) |
| 11.12 | ✅ 2026-10-09 taraması: kullanılmayan dosya yok; kullanılmayan dışa açık değerler (`manuallyAwardBadges`, `USER_ROLE_LABELS`, kategori etiket listeleri, `getCategoryKey`, `profileCompletionFields`), 80 kullanılmayan import/değişken (`tsc --noUnusedLocals` temiz), ölü `fetchRoomId`, `handleSubscribe` (influencer), rol filtresi durumu kaldırıldı |

---

### 11.1 Bekleyen elle testler (kullanıcı yapacak)
- **T1** Marka doğrulama kilidi (1.8-S4, PR #17): doğrulanmış marka hesabıyla Keşfet, İlanlar, Favoriler, AI öneriler, Teklifler normal açılmalı;
  doğrulanmamış markada bu sayfalar kilit ekranı göstermeli, ana sayfa/profil/ayarlar/rozetler açık olmalı.
- **T2** Instagram hızlı doğrulama (PR #12): kodla hesap ekleyip "Kontrol et" süresi.

### 11.3 Elle çalıştırılacak SQL'ler (kullanıcı kararı: en sonda tek dosyada toplu gönderilecek)
- **Kural (kullanıcı, 2026-10-07):** risksiz şema düzeltmeleri (kısıt genişletme, indeks, idempotent kolon) doğrudan
  canlıya uygulanır ve migration dosyasına yazılır; uygulanamayanlar (DROP POLICY vb.) bu listede birikir ve en sonda
  sırasıyla toplu verilir.
- Canlıya doğrudan uygulananlar: `20261007000010` favoriler tekil indeksi; `20261007000011` başvuru `shortlisted`, ilan `paused`; `20261007000012` geri bildirimde admin rolü. `20261007000014` tetikleyici fonksiyonlarda EXECUTE kaldırıldı, iki RPC anon'a kapatıldı, `website_host` search_path. `20261007000015` 17 yabancı anahtar indeksi. `20261007000016` realtime yayınına 8 tablo. `20261010000001` iş birlikleri + fiyat kartı tabloları, RLS, RPC'ler, realtime, geriye dönük aktarım (3.14; execute_sql ile parça parça, RLS canlıda denendi). `20261010000000` okundu tablosu `room_reads` + metadata taşıması (5.3-S2; 2026-10-10, execute_sql ile, doğrulandı). `20261010000020` ücretsiz marka sınırları: `platform_settings`, `discovery_spins`, `brand_limit_for`, iki BEFORE tetikleyici, bayrak kapalı (3.17; 2026-10-10, execute_sql ile, rollback'li RLS/tetikleyici denemesiyle doğrulandı). `20261010000040` iş birliği takip alanı: dört tablo, `is_collaboration_party`, `brand_collaboration_reliability`, realtime (3.18; 2026-10-10, execute_sql ile parça parça, her tablo RLS + REVOKE ile aynı çağrıda; rollback'li denemeyle doğrulandı).
- 7 Ekim toplu SQL'i (kullanıcı çalıştırdı, 0 hata; canlıda doğrulandı): `20261007000008` geri bildirim görselleri DROP POLICY,
  `20261007000009` ilan kuralları temizliği, `20261007000013` ölü avatars "Tam Yetki" politikaları. Sohbet eki kuralı (`20261007000007`)
  oluşturulamadı; mevcut politika ALTER ile daraltıldı (`20261007000017`, canlıda).
- **Bekleyen tek SQL** (mobil sürüm çıktıktan sonra): `DROP POLICY "avatars insert" ON storage.objects;` (7.5-S1)

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
