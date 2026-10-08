# Devir notu (bulut oturumundan yerel Claude'a)

> Son güncelleme: 2026-10-09, PR #46 birleştikten sonra. Tüm işler `main`'de ve Vercel'de canlı, açık PR yok.
> Kurallar ve kararlar: kökteki `CLAUDE.md`. Numaralı sorun listesi: `docs/SYSTEM_MAP.md` (asıl kaynak).
> Bu belge "nerede kaldık" sorusunun cevabı; yeni oturumda kullanıcıya aynı şeyleri tekrar sorma.

## 1. Şu anki durum (kısa)

- **Web:** kararsız yapılabilecek tüm maddeler bitti; 2026-10-09 ürün kararları (bildirimler, doğrudan mesaj, sarı tikler,
  "Markayla görüş", kota, Resend) uygulandı (#37–#40).
- **Mobil (test aşaması, hedef web ile tam uyum):** 6 parça bitti ve birleşti (#41–#46):
  1. Teklifler + ortak mesaj ekranı (`/api/mobile/offers`, `/api/mobile/messages`).
  2. İlanlar + başvurular (`/api/mobile/adverts`, `/api/mobile/applications`, `lib/adverts.ts`).
  3. Doğrulama: influencer zorunlu sosyal doğrulama kapısı (`mobile-app/lib/routing.js`, `SocialVerifyGate`), marka kurumsal
     kimlik + kurumsal e-posta + vergi levhası (`/api/mobile/brand-verification`, `lib/brand-verification.ts`). Expo paketleri SDK 54'e eşitlendi.
  4. Push: her bildirim push olarak da gider (`lib/push.ts`, `/api/mobile/push-token`); metin e-postadaki sade metin.
  5. Sahte AI asistan kaldırıldı, mobil şifre sıfırlama (`/api/mobile/forgot-password`, token_hash bağlantısı), içerik üretici türü.
  6. DB sıkılaştırma: `social_accounts.verification_code` istemcilere kapalı, "avatars insert" kaldırıldı.
- **Canlı SQL:** bekleyen yok. 2026-10-08/09 dosyalarının hepsi (`supabase/manual/`) kullanıcı tarafından çalıştırıldı ve doğrulandı.
- Kullanıcı liste bitince çok hesapla toplu test yapacak (web + mobil). Ara testler istemiyor.

## 2. Sıradaki işler

1. **Kullanıcı adımları (mobil push):** Expo hesabında `eas init` (app.json'a `extra.eas.projectId` yazar) ve Android için
   FCM kimlik bilgisi. Bunlar olmadan cihaz push token alamaz; kod hazır. `npx expo install --check` ile paketler kurulmalı.
2. **Uygulama adı kararı verildi (2026-10-10):** "Influmatch", paket kimliği `net.influmatch.app`; `mobile-app/app.json`'a yazıldı
   (slug `influmatch`). `eas init` bu ayarlardan sonra çalıştırılmalı.
3. **Mobilde kalan küçük işler (istersen bak, karar gerektirmez):** bazı ekranlar `users` tablosuna doğrudan yazıyor
   (beyaz liste tetikleyicisi korumalı: izin dışı kolonlar sessizce düşer, ör. MyProfile `portfolio_urls`); destek/geri bildirim
   ve bildirim okundu işaretleme doğrudan tabloya. Güvenlik açığı değil; web ile tam aynı akış istenirse sunucu uçlarına taşınabilir.
4. **8.7-S1:** rocketapi.io anahtarının panelden iptali kullanıcıda; iptal edilince ✅.
5. **OAuth açılırsa:** 2.3-S2, 2.3-S3, 2.3-S4. **5.3-S2** (okundu bilgisi için `room_reads` tablosu) mesajlaşma tasarımıyla birlikte, acil değil.
6. **Takip panosu:** artifact başka hesapta; bu hesap (hello@socialartajans.com) erişemiyor. Erişimi olan oturum
   `scripts/tracker_sync.py` ile eşitlemeli. Kullanıcı panoyu bu hesapla paylaşırsa yerel oturum da yazabilir.
7. **Kuyruğun en sonu:** bölüm 8 ("ne kaldı" sorulunca hatırlat).
8. Kullanıcı daha sonra **strateji** konuşmak istiyor.

## 3. Kullanıcının verdiği kararlar (kronolojik, 6–7 Ekim 2026)

| Konu | Karar |
|---|---|
| Vergi levhası | Markalar için otomatik vergi levhası doğrulayıcı ilk öncelikti. Uygulandı: VKN/TCKN checksum, levha yerelde ayrıştırılıyor, admin inceleme ekranı var. **Dış yapay zekâ yok** (Gemini ücretsiz katmanı veriyi eğitimde kullanıyor; reddedildi). Otomatik onay **kapalı** (`TAX_AUTO_APPROVE`). |
| Influencer/UGC doğrulama | Kayıt aşamasında hesabı doğrulatmak (bio kodu) zorunlu. Uygulandı. |
| Mavi tik | Yeni kural: Spotlight × performans × güven eşiği (`lib/blue-tick-rules.ts`). Saatlik görev yeniden değerlendiriyor. |
| Çoklu API anahtarı | Apify (ve anahtar sağlığı için Gemini) çoklu anahtar havuzu kuruldu. Biten anahtarın yerine otomatik olarak diğeri geçiyor. Takip ekranı `/admin/api-keys`. Her saat kontrol edilip sorun varsa admin'e özet e-posta gidiyor. |
| Resend | Vercel'e eklendi. Günlük 100 / aylık 3000 e-posta sınırı "riskli" kategorisinde (8.4-S1). Durumu admin panelinde izleniyor. `EMAIL_FROM` gönderici adresidir (ör. `Influmatch <dogrulama@influmatch.net>`). Resend'de influmatch.net alan adı doğrulanmış olmalı, yoksa e-postalar yalnızca hesap sahibine gider. Kayıt e-postaları gidiyor (kullanıcı onayladı). |
| Kurumsal e-posta | Şirketler için sarı tik almak, şirket alan adıyla uyumlu bir e-postayı kodla doğrulamaya bağlı. Kayıt e-postası farklı olabilir. Uygulandı. |
| Sistem haritası | Tüm sistem numaralı haritaya döküldü (`docs/SYSTEM_MAP.md`). Takip panosu artifact'ta (CLAUDE.md'de link). |
| RocketAPI anahtarı | Repodan silindi. Anahtar rocketapi.io'ya ait ve git geçmişinde duruyor. Kullanıcı hesabı nereden aldığını hatırlamıyor. Uygulama artık kullanmıyor; iptal kullanıcıda. |
| Supabase ayarları | Passkeys açıldı. "Leaked password protection" ayarı Free planda görünmüyor, büyük ihtimalle Pro özelliği. Pro'ya geçilince açılacak. |
| Doğrudan mesaj (5.1-S1) | "Şimdilik kalsın, mantığını birlikte oturturuz." Bekliyor. |
| Profiller | **Giriş yapmadan görünmesin** (kesin). Site haritasında yok, robots engelliyor. |
| Arama motorları | Profiller indekslenmesin (yukarıdaki karar). |
| Bildirimler (5.4) | "Sayfaların yapısı değişirse yönlendirme uçları da değişir." Web düzenlemesi bitene kadar ertelendi. |
| Inflist | Ayrı bir proje değil, favoriler sayfasındaki adlandırılmış listeler. **Favorilerle aynı sayfada** kalacak (yapıldı). Şimdilik ücretsiz; ileride Spotlight'a dahil edilecek (3.13-N5). |
| Kodla doğrulayanlar (3.13) | OAuth yerine kodla doğrulayanların bazı verileri çekilemiyor; bu hesaplar dezavantajlı olmalı. Ücret ödemeyen markalar yalnızca kodla doğrulanmış hesaplara ulaşmalı ve tüm listeyi görmemeli. Sistem ihtiyaca göre belli oranda profil önermeli. **Tasarım/karar bekliyor**, kod yok. |
| Gönderisi olmayan hesaplar | İleride doğrulamada kabul edilmeyecek (3.13-N6). Şimdilik kabul ediliyor. |
| Drive yapısı | Görsel/dosya maliyeti için Drive benzeri depolama kurulacak (8.9-N1). Not alındı, iş başlamadı. |
| `@testermobilapp` | Mobil testleri için tutulan marka hesabı; silinmeyecek. |
| Mobil | Dondurma kararı (2026-10-07). Web bitince hatırlatılacak. PR #22'deki mobil düzeltmeler bir sonraki mobil sürümle çıkar. |
| Canlı DB | Risksiz düzeltmeleri Claude doğrudan uygular. Riskliler en sonda sırasıyla toplu SQL olarak verilir. Daha önce yapılan üç canlı değişiklik (shortlisted/paused CHECK'leri, favoriler tekil indeksi) kalıyor. |
| @supabase/ssr | Geçiş önerisi kabul edildi; yapıldı (PR #27). Giriş sorunsuz. |
| Test | Liste bitince toplu test. Ara testler istenmiyor. |
| Yetki (8 Ekim) | "Bana sormadan düzenleyebileceğin her şeyi düzenle, en iyi haliyle; parça parça yapabilirsin. Bana yalnızca soracağın işler kalsın." Ardından strateji konuşulacak. |
| Milyon Kulübü (8 Ekim) | Doğrulanmış hesapta 1 milyon+ takipçi. Uygulandı (saatlik görev). |
| Profil görüntülenme (8 Ekim) | Sayı kaydedilsin; yalnızca Spotlight sahibi influencer/UGC görür. Uygulandı. |
| Rozet eşikleri (8 Ekim) | Kabul: Hızlı Dönüş (mesaj yanıtı ort. < 2 saat), Jet Onay (başvuruya ort. ≤ 24 saat), Marka Elçisi (aynı markayla ≥ 3 kabul edilmiş iş), Elit Bütçe (≥ 50.000 TL). Trend Belirleyici, Dönüşüm Sihirbazı, Global, İletişim Uzmanı, Sadık Partner "yakında" kalır. |
| 5 Yıldız (8 Ekim) | İleriki bir güncellemede gelecek; **şimdilik dokunma**. |
| Doğru olmayan arayüz iddiaları + KVKK (8 Ekim) | Kuyruğun **en sonuna**. "Ne kaldı" sorulduğunda hatırlat (bölüm 8). |
| Bildirimler (9 Ekim) | Site içi + önemli olaylarda e-posta; mesaj e-postası saatte bir özet; kullanıcı tercihleri uygulanır. |
| Doğrudan mesaj (9 Ekim) | Açılmayacak; teklifsiz sohbet yolları kaldırılır. |
| Eski sarı tikler (9 Ekim) | Kurala uymayanınki geri alınır, markaya bildirim gider (33 markanın hiçbirinde kurumsal e-posta doğrulaması yoktu). |
| Beklet (9 Ekim) | Davranış aynı, buton "Markayla görüş". |
| Ücretsiz marka kotası (9 Ekim) | Şimdilik açık; yalnızca sayfalama. |
| Resend (9 Ekim) | Ücretsiz planda kal; doğrulama e-postaları öncelikli, %80 kotada bildirim e-postaları durur. |
| Mobil (9 Ekim) | Bu kararlar uygulanınca başlanır. |
| Çevrimiçi / son görülme (8 Ekim) | Admin panelinde her kullanıcı için. Uygulandı (dakikalık sinyal + son giriş zamanı). |

## 4. Karar bekleyenler

Hepsi 2026-10-09'da karara bağlandı (bölüm 3 ve CLAUDE.md kural 6). Kuyruğun en sonundakiler bölüm 8'de.

## 5. PR geçmişi (hepsi main'e birleşti)

| PR | Başlık |
|---|---|
| #1 | Install Vercel Speed Insights |
| #2 | Security hardening: privilege escalation, verification bypass, private data exposure |
| #3 | Verification hardening, API key pool, corporate email and live-data fixes |
| #4 | Fix dashboard crash for admin accounts after login |
| #5 | Defer broken accounts instead of stalling the stats refresh queue |
| #6 | Fix advert editing, brand social links, stats page, trust card, similar profiles |
| #7 | Web password reset, all-or-nothing account deletion, admin message removal |
| #8 | Unread badges, advert application rules, upload paths, dead links |
| #9 | Instagram verification fallback, sitemap without profiles |
| #10 | Server-side Spotlight checks, signup role and rate-limit fixes |
| #11 | Lists on the favorites page (free), Spotlight upsell, parallel stats refresh |
| #12 | Fix password reset on www, faster Instagram verification |
| #13 | Inbox query limits, verified account code regeneration, TikTok history, onboarding draft |
| #14 | Restrict image hosts, cache optimized images, remove dead code and unused deps |
| #15 | Normalize TikTok usernames before scraping |
| #16 | Harden server functions and RPCs, fix welcome message and admin redirect |
| #17 | Central brand verification lock, locked verified social links, chosen badges |
| #18 | Discovery requires a verified account, per-application chat rooms |
| #19 | Storage limits, chat attachment checks, verification card refresh |
| #20 | Open feedback and support attachments with signed URLs |
| #21 | Fix dashboard/onboarding loop, chat reloads and username check |
| #22 | Fix mobile data writes and close unfinished OAuth entry points |
| #23 | RLS for applications, advert policy cleanup, safe chat images, real TikTok engagement |
| #24 | Consistent trust score, safer favorites, shortlist fix, schema drift sync |
| #25 | Admin feedback role, function execute hardening, avatar policy cleanup plan |
| #26 | Idempotent migrations, email confirmation, FK indexes, small public-facing fixes |
| #27 | Move from auth-helpers-nextjs to @supabase/ssr without logging anyone out |
| #28 | Realtime for UI tables, external call timeouts, dead code removal |
| #29 | Clear a batch of small issues from the system map |
| #30 | Web fixes: delete re-auth, list validation, avatar URL check, realtime cleanup |
| #31–#36 | Web fix batches (badges, presence, profile views, cleanup, schema baseline) |
| #37–#40 | 2026-10-09 decisions: notifications, offer "Markayla görüş", yellow ticks, paging, offer payment type, cron budget |
| #41 | Mobile part 1: offers, shared messaging, influencer detail |
| #42 | Mobile part 2: adverts and applications |
| #43 | Mobile part 3: brand and creator verification |
| #44 | Mobile part 4: push notifications |
| #45 | Mobile part 5: fake screens, password reset, creator type |
| #46 | Mobile part 6: database hardening |

Canlı şemanın temeli `supabase/migrations/20261009000000_schema_baseline.sql`; önceki migration'lar `supabase/migrations/_archive/` altında; ne zaman, nasıl uygulandıkları SYSTEM_MAP 11.3'te.
Saatlik görev Supabase pg_cron ile çalışıyor. `supabase/cron/hourly_jobs.sql` repoda yer tutucuyla duruyor; gerçek secret yalnızca Supabase'de.

## 6. Açık maddeler (SYSTEM_MAP'ten, 2026-10-09)

Ayrıntı için haritadaki satıra bak. Bunların hiçbiri kendi başına yapılacak kod işi değil.

| ID | Seviye | Durum |
|---|---|---|
| 8.7-S1 | KRİTİK | Dosya silindi; rocketapi.io anahtarının iptali kullanıcıda. |
| 2.3-S2, 2.3-S3, 2.3-S4 | YÜKSEK/ORTA/DÜŞÜK | OAuth kapalı; açılırsa yapılacak. |
| 5.3-S2 | ORTA | Okundu bilgisi `room_reads` tablosuna; mesajlaşma tasarımıyla birlikte. |
| 4.3-S3 | DÜŞÜK | Ajans Spotlight sayfası notu (haritaya bak). |
| 2.9-S1, 3.5-S2, 9.1-S2, 9.1-S3 | — | 2026-10-10'da yapıldı (bölüm 8). 3.5-S2'de kategori eşleşmesi açık. |

## 7. Teknik notlar (tekrar keşfetmemek için)

- **Supabase:**
  - MCP `execute_sql` çoklu ifadede yalnızca son sonucu döndürür.
  - `storage.objects` üzerinde politika oluşturma, silme ve yeniden adlandırma yetkisi yok ("must be owner"). ALTER POLICY ... WITH CHECK/USING ise çalışıyor.
  - DROP POLICY gerekirse kullanıcıya SQL olarak ver.
- **Realtime yayını:**
  - Yayındaki tablolar: messages, offers, advert_applications, rooms, dismissed_offers, notifications, support_tickets, message_reports, user_badges.
  - `users` bilerek dışarıda (gizli kolonlar var).
- **`users` gizli kolonları:** tax_id gibi kolonlar istemci rolüne okunamaz. Bu yüzden onboarding upsert yerine ayrı update/insert yapıyor. Gizli alanları sunucu, admin istemcisiyle yazar.
- **Okunmamış mesaj sayısı:** `components/dashboard/useUnreadMessageCount.ts` içinde tek kanaldan izleniyor. Okundu bilgisi kullanıcı metadata'sında (5.3).
- **Dış çağrılar:** `lib/api-keys.ts` `fetchExternal` 50 sn zaman aşımıyla çalışıyor. Apify çağrıları `?timeout=45`, Resend 15 sn.
- **Hesap silme:** `lib/account-deletion.ts` `deleteAccountCompletely` storage dosyalarını da siliyor. Kullanıcıdan şifre tekrar isteniyor.
- **Avatar/logo adresi:** sunucuda `lib/avatar-url.ts` ile doğrulanıyor. Yalnızca `avatars/{uid}/` altındaki ya da zaten kayıtlı olan adres kabul ediliyor.
- **Ortak sunucu kodu deseni:** `lib/offers.ts`, `lib/messages.ts`, `lib/adverts.ts`, `lib/brand-verification.ts` fonksiyonları
  `(supabase, userId, ...)` alır. Web server action'ları çerez istemcisiyle, mobil `/api/mobile/*` uçları `getBearerContext(request)`
  (RLS'li, mobil JWT) ile aynı fonksiyonu çağırır. Mobil tarafta `mobile-app/lib/api.js` `apiRequest(path, {method, body})`.
- **`users` güncelleme koruması:** `users_before_update_guard` tetikleyicisi istemci güncellemesinde yalnızca beyaz listedeki
  kolonları geçirir (rol, onay, spotlight vb. sessizce düşer); onaylı markanın yasal bilgisi değişirse onay düşer.
- **Canlıya DDL:** bu ortamda `apply_migration` izin sisteminde engelli; SQL `supabase/manual/` altına yazılır, kullanıcı SQL Editor'de
  çalıştırır. SQL Editor uyumu: fonksiyonlarda DECLARE yok, yorumlarda kesme işareti ve soru işareti yok.
- **git push:** düz push sessizce asılı kalabiliyor; `GIT_TERMINAL_PROMPT=0 GCM_INTERACTIVE=never git -c credential.helper=
  -c "credential.helper=!gh auth git-credential" push ...`, sonra `git ls-remote` ile doğrula. Repoda GitHub auto-merge kapalı;
  önizleme yeşilse `gh pr merge <n> --merge`.
- **Mobil sözdizimi kontrolü:** `npx tsc --noEmit --allowJs --checkJs false --jsx preserve --noResolve --skipLibCheck <dosyalar>`
  (mobile-app içinde; node_modules kurulu değil).
- **Build:** `next build` için `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_ANON_KEY` gerekli. Route sildikten sonra `rm -rf .next/types` çalıştır.

## 8. Kuyruğun en sonu (kullanıcı kararı — "ne kaldı" sorulunca hatırlat)

- 2026-10-10'da karara bağlanıp yapılanlar: yapay zekâ iddiaları kaldırıldı (2.9-S1, 3.5-S2 metni), ortak logoları →
  "Desteklenen Platformlar" (9.1-S2), sabit rakamlar kaldırıldı (9.1-S3), yasal metin tek kaynak (1.7-S1), ajans sayfası
  kaldırıldı (4.3-S3).
- Bekleyen: KVKK / kullanıcı sözleşmesi / açık rıza metinlerinin hukuki içeriği **avukattan gelecek**; gelince
  `app/legal/page.tsx`'e yerleştirilir (Claude kendisi hukuki metin yazmaz).
- 5 Yıldız rozeti (puanlama sistemi) ileriki güncellemede.
- Ertelenenler: Drive yapısı (8.9-N1, "sonra"), kodla doğrulayanlara sınır (3.13-N2, OAuth açılınca), ücretsiz marka kotası
  (3.13-N3/N4, kullanıcı sayısı büyüyünce).
