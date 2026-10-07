# Devir notu (bulut oturumundan yerel Claude'a)

> Tarih: 2026-10-07, PR #30 birleştikten sonra. `main` = `88fd1fa` + bu belge.
> Kurallar ve kararlar: kökteki `CLAUDE.md`. Numaralı sorun listesi: `docs/SYSTEM_MAP.md`.
> Bu belge "nerede kaldık" sorusunun cevabı; yeni oturumda kullanıcıya aynı şeyleri tekrar sorma.

## 1. Şu anki durum (kısa)

- Web düzeltmeleri numaralı listeden yürüyor. Başta ~209 madde vardı. Kalan açık maddeler aşağıda (bölüm 6).
- Tüm işler `main`'de ve Vercel'de canlı. Açık PR yok. Çalışma dalı `claude/web-fixes-batch` = `main`.
- Kullanıcı liste bitince çok hesapla toplu test yapacak. Ara testler istemiyor.
- Mobil uygulama donduruldu (bkz. CLAUDE.md kural 3). Web bitince kullanıcıya **hatırlat**.
- **Bekleyen toplu SQL (2026-10-08):** `supabase/manual/2026-10-08_toplu.sql` (RLS performansı, erişim açıkları, profil
  görüntülenmeleri, çevrimiçi durumu, kopya politikalar). Kullanıcı SQL Editor'de çalıştırınca ilgili PR birleştirilir.
  Yerel oturum canlıya migration uygulayamıyor (izin sistemi "production deploy" diye engelliyor); okuma sorguları çalışıyor.
- Mobil sürüm sonrası çalıştırılacak SQL:
  `DROP POLICY "avatars insert" ON storage.objects;` Bu SQL yalnızca yeni mobil sürüm yayınlandıktan sonra çalıştırılacak.

## 2. Sıradaki önerilen işler (sırayla)

1. **Supabase performans uyarıları:**
   - 66 RLS politikasında `auth.uid()` satır başına çalışıyor; `(select auth.uid())` yapılmalı.
   - 123 tabloda/rolde birden çok permissive politika var.

   Bunlar politika yeniden yazımı demek. ALTER POLICY ile koşul değiştirmek risksiz sayılabilir, ama tek tek canlıda doğrula.
   Birleştirme gerektirenler (DROP POLICY) toplu SQL'e girer. Bkz. SYSTEM_MAP 7.4.
2. **7.1-S1 tam şema (baseline) migration'ı:** canlı şemayı okuyup repoya tek bir temel dosya çıkar.
   Eski migration'lar çakışıyor, ayrıntı 7.1 ve 7.7'de.
3. **Küçük kalanlar:**
   - 7.4-S3 boş `handle_delete_auth_user` (DROP FUNCTION → toplu SQL'e)
   - 4.1-S3 mantığı olmayan rozetler (katalogdan kaldırmak arayüzü değiştirir; kullanıcıya sor)
   - 4.5-S3 / 4.6-S2 analitik olayları (`analytics_events` marka odaklı; influencer profili görüntülenmesi için kimin okuyacağı tasarlanmalı)
   - 7.3-S1 (DB beyaz listesi; canlı erişim gerekiyor)
4. 2026-10-08 yerel oturumda yapılanlar (PR'da): 1.1-S2 admin layout'u, 1.11-S1 ek adresi doğrulaması,
   2.11-S1 influencer vitrini ortak kaynağa bağlandı, 2.12-S2 başvuruyu geri çekme, 3.6-S4 / 3.8-S3 realtime filtreleri,
   7.7-S3 kod cast'i, 8.8-S1 tek kurulum rehberi (`docs/SETUP.md`).
   **Yerel oturumun Influmatch Supabase projesine MCP erişimi yok**; 1. ve 2. maddeler (canlı DB) erişim
   kurulunca ya da bulut oturumunda yapılmalı.
5. Karar bekleyenlere (bölüm 4) kullanıcı karar verdikçe geç.

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
| Çevrimiçi / son görülme (8 Ekim) | Admin panelinde her kullanıcı için. Uygulandı (dakikalık sinyal + son giriş zamanı). |

## 4. Karar bekleyenler (kullanıcı: "biraz daha beklesin") — kendi başına uygulama

- **5.4-S1 / 3.6-S2 / 3.8-S3 / 1.9-S5 bildirimler ve e-postalar:** yeni teklif, teklif durumu, başvuru ve mesaj bildirimleri. Web sayfa yapısı oturunca yapılacak.
- **5.1-S1 doğrudan mesaj:** butonu kaldırmak mı, kurala izin vermek mi?
- **3.13-N1…N4 ücretsiz marka erişimi:** kota, OAuth ayrımı. Ürün tasarımı gerekiyor.
- **9.1-S2 ana sayfa ortak logoları:** TikTok/Meta/Google logoları resmi ortaklık izlenimi veriyor.
- **3.11-S1 eski sarı tikler:** kuraldan önce sarı tik almış ~33 marka. Tiklerini geri almak mı, bırakmak mı?
- **2.13-S1 teklif "Beklet":** davranış bilinçli görünüyor; kullanıcı onayı bekleniyor.
- **2.9-S1 / 2.9-S2 "AI analiz" metni ve seviyeler:** yerel kural motoru "AI" diye sunuluyor.
- **4.3-S2 / 4.3-S3 Spotlight fiyatları ve menü** (fiyatlar iş kararı).

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

Canlı şemanın temeli `supabase/migrations/20261009000000_schema_baseline.sql`; önceki migration'lar `supabase/migrations/_archive/` altında; ne zaman, nasıl uygulandıkları SYSTEM_MAP 11.3'te.
Saatlik görev Supabase pg_cron ile çalışıyor. `supabase/cron/hourly_jobs.sql` repoda yer tutucuyla duruyor; gerçek secret yalnızca Supabase'de.

## 6. Açık maddeler (SYSTEM_MAP'ten, 2026-10-07)

Ayrıntı ve bağlam için haritadaki ilgili satıra bak. "NOT" satırları ürün notudur, kod işi değildir.

| ID | Seviye | Özet |
|---|---|---|
| 1.9-S5 | ORTA | `email_notifications` tercihleri kaydediliyor ama hiçbir kod bu tercihlere göre e-posta göndermiyor (bkz. 5.4). |
| 2.1-S8 | DÜŞÜK | (canlıda kontrol edildi: jeton kolonu yok; okunabilen doğrulama kodu başkasının biyografisine yazılamayacağı için işe yaramaz. Düşük) `social_accounts` SELECT herkese açık (`USING(true)`, tüm kolonlar); `verification_code` okunabilir. |
| 2.3-S2 | YÜKSEK | (OAuth kapatıldığı için etkisiz; açılmadan önce `user.info.profile` kapsamı + `username` alanı gerekli. Canlıda OAuth ile bağlanmış hesap yok) TikTok OAuth kullanıcı adı yerine `display_name` kaydediyor, `syncBlueTick` çağırmıyor; sonraki yenileme yanlış he… |
| 2.3-S3 | ORTA | Meta yolu `platform_user_id`'yi Graph business id ile yazıyor (Apify IG pk yazıyor) → aynı IG hesabı iki kullanıcıya bağlanabilir. `last_scraped_at` set edilmiyor, diğer kullanıcılarla çakışma kontrolü yok. |
| 2.3-S4 | DÜŞÜK | Token'lar saklanmıyor (OAuth kazımaya göre bir şey katmıyor); `video.list` kapsamı kullanılmıyor. |
| 2.6-S2 | DÜŞÜK | Tamamlama doğrulanmış hesapları değil elle girilen `social_links`'i sayıyor; `phone`/`email` görevleri hiç üretilmiyor. |
| 2.9-S1 | ORTA | "AI analiz" yerel kural motoru + rastgele karıştırma + sahte 800 ms gecikme; LLM yok. Pazarlama dili yanıltıcı. |
| 2.9-S2 | ORTA | Her marka ücretsiz BRAND_PRO seviyesini alıyor; seviye eşlemesi dosyalar arasında farklı (`ipro`/`mpro`, eski `pro`/`elite`). |
| 2.9-S3 | DÜŞÜK | ("TikTok Resmi Entegrasyonu Aktif" → "Herkese açık TikTok profilinden alındı") `match_score` / `profile_coach` "Çok yakında" ile kapalı; `statsPayload.changes` hiç yazılmıyor; "TikTok Resmi Entegrasyonu Aktif" yazısı yanlış. |
| 2.13-S1 | ORTA | (bilinçli görünüyor: teklif beklemede kalır, görüşmek için sohbet açılır; ürün kararı bekliyor) "Beklet" durumu kaydedilmiyor ama sohbet odası yine açılıyor. |
| 3.2-S2 | ORTA | (ertelendi: <100 influencer; 3.13-N4 "ücretsiz markaya kota" tasarımıyla birlikte yapılacak) Her şey tek seferde yükleniyor (sayfalama yok); "1,2K" gibi metin istatistikler istemcide ayrıştırılıyor. |
| 3.5-S2 | DÜŞÜK | "%95+ uyumlu" sabit iddia; marka ve influencer kategorileri farklı listelerden geldiği için eşleşme genelde boş havuza düşüyor; sınırsız `.in('id', ids)`. |
| 3.6-S2 | YÜKSEK | Influencer'a yeni teklif için bildirim veya e-posta gitmiyor (bkz. 5.4-S1). |
| 3.8-S3 | ORTA | Başvuru durumu değişince influencer'a bildirim yok; realtime kanal filtresiz ve anon istemciyle farklı join kullanıyor. |
| 3.11-S1 | ORTA | Bu kuraldan önce verilmiş sarı tikler otomatik geri alınmadı (karar bekliyor). |
| 4.1-S3 | DÜŞÜK | Katalogda verme mantığı olmayan rozetler: `brand-ambassador`, `lightning-fast`, `five-star`, `trendsetter`, `million-club`, `conversion-wizard`, marka v1.2/v1.3 rozetleri. |
| 4.2-S2 | DÜŞÜK | (ölü `profile/badges/actions.ts` dosyaları silindi) `influencer/profile/badges/actions.ts` (`updateDisplayedBadges`) ölü; marka rozet sayfası kazanılanları göstermiyor. |
| 4.3-S2 | ORTA | Fiyatlar birden çok yerde sabit; seviye eşlemesi tutarsız (bkz. 2.9-S2); plan sayfaları metadata rolünü okuyor. |
| 4.3-S3 | DÜŞÜK | `/dashboard/influencer/spotlight` menüde yok; `/dashboard/spotlight/agency` statik "Çok Yakında". |
| 4.5-S3 | DÜŞÜK | `view_profile` / `click_profile` analitik olayları hiç gönderilmiyor. |
| 4.6-S2 | DÜŞÜK | Yalnızca `view_advert` izleniyor; influencer tarafında analitik yok. |
| 5.1-S1 | YÜKSEK | Doğrudan sohbet başlatma bozuk: `MessagesPage.tsx` `offer_id`/`advert_application_id` olmadan oda ekliyor, `restrict_rooms_insert` trigger'ı reddediyor; `?userId=` ile mevcut oda yoksa yalnızca konsola hata düşüyor. Mobilde de aynı (10.3-S4). |
| 5.3-S2 | ORTA | (canlıda ölçüldü: en büyük metadata 550 bayt, en çok 4 oda anahtarı; acil değil, mesajlaşma tasarımıyla birlikte `room_reads` tablosuna taşınacak) Sistem B her mesaj sayısı değişiminde metadata yazıyor; her oda için bir anahtar ekleyerek JWT/çerezi şişiriyo… |
| 5.4-S1 | YÜKSEK | Yeni teklif, teklif durumu, yeni başvuru, başvuru durumu, yeni mesaj, destek yanıtı için hiçbir bildirim ya da e-posta üretilmiyor. Tek üreticiler admin paneli ve Spotlight bildirimi. |
| 6.1-S2 | DÜŞÜK | (PGRST116 artık rate limit sayılmıyor; bakım mesajı genelleştirildi) `PGRST116` rate limit sayılıyor; eski "21-23 Kasım bakım" mesajı sabit; başka statüdeki kullanıcılar hiçbir listede yok. |
| 7.1-S1 | YÜKSEK | (kısmen: bilinen sapmalar `20261007000011` ile kapatıldı, `20260316000001` artık influencer_id'yi kendisi ekliyor. Tam doğrulama için repo dosyalarını boş bir veritabanında sırayla çalıştıran bir deneme gerekir) Canlı DB repodan neredeyse kesin sapmış (bkz.… |
| 7.3-S1 | ORTA | Beyaz listede `push_notifications_enabled`, `website` var ama bu kolonlar yok; `push_token` ise ne kolon ne beyaz listede (mobil push hiç kaydedilmiyor). |
| 7.4-S3 | DÜŞÜK | `handle_delete_auth_user` boş taslak, trigger'ı yorumda. |
| 7.5-S1 | YÜKSEK | Ölü "Tam Yetki" politikaları silindi. Kalan tek iş: mobil sürüm çıkınca `DROP POLICY "avatars insert"`. |
| 7.5-S2 | ORTA | `chat-attachments` bucket'ı migration'da yok (yükleme kuralı `20261007000017` ile daraltıldı); özel bucket + imzalı URL'ye geçilmeli. |
| 7.6-S4 | DÜŞÜK | `feedback` tablosu (mobil), `rooms.last_message_at`, `messages.receiver_id`, `messages.is_read`, `advert_projects.brand_id`, `users.push_token`. |
| 7.7-S3 | DÜŞÜK | `handle_new_auth_user` 8 kez yeniden tanımlanmış; `spotlight_plan` CHECK → enum → enum geçişi kayıplı eşleme yapmış, kodda hâlâ `'basic'\|'pro'` cast'i var. |
| 8.4-S1 | YÜKSEK | Ücretsiz plan günde 100, ayda 3000 e-posta. Kurumsal e-posta kodları ve admin uyarıları aynı kotayı paylaşıyor; kota dolunca markalara kod gitmez. İzleme ve uyarı eklendi, risk sürüyor (çözüm: ücretli plan veya ikinci sağlayıcı). |
| 9.1-S2 | ORTA | PartnersSection TikTok, Instagram, Meta, YouTube, Google logolarını "partner" olarak gösteriyor (ortaklık izlenimi / marka hakkı riski). |
| 9.1-S3 | DÜŞÜK | (Footer `/discover` → `/spotlight`; gizlilik linki zaten düzgün) Sabit pazarlama rakamları ("%5.2", "10K+", "50+", "%100"); Footer'da kırık linkler (`/discover`, `/legal/privacy`); production'da `console.log`. |
| 10.3-S1 | YÜKSEK | Influencer sosyal doğrulama zorunluluğu mobilde yok (web'de de yalnızca arayüz kapısı; DB zorlamıyor). |
| 10.3-S2 | YÜKSEK | Marka doğrulama ekranı: VKN/TCKN istemci kontrolü yok, vergi dairesi/il yok, vergi levhası yükleme yok, kurumsal e-posta yok; |
| 10.3-S4 | YÜKSEK | Doğrudan sohbet engelleniyor (`InfluencerDetailScreen.js` bağlantısız oda açıyor). |
| 10.3-S7 | ORTA | Push token'ları ve bildirim tercihi hiç kaydedilmiyor (7.3-S1). |
| 10.3-S9 | ORTA | (sahte güven skoru satırı kaldırıldı; kullanılmıyordu) Keşfette doğrulanmamış istatistikler ve sahte güven skoru (`75 + charCode % 22`). |
| 10.3-S10 | ORTA | AiAssistant ekranı sabit cevaplı sahte sohbet; şifre sıfırlama kırık (1.4-S1); signup `creator_type` göndermiyor. |
| 10.3-S11 | DÜŞÜK | İlan ekleme var olmayabilecek `brand_id` kolonu gönderiyor; kapak görseli klasörsüz. |
| 3.13-N1 | NOT | Kod (bio) ile doğrulayan Instagram/TikTok hesaplarının belli verileri çekilemiyor: kazıma yalnızca herkese açık |
| 3.13-N2 | NOT | OAuth yerine kod ile doğrulayanlar dezavantajlı olmalı. Seçenekler: güven skorunda tavan, mavi tik/rozet yok, |
| 3.13-N3 | NOT | Ücret ödemeyen markalar yalnızca kod ile doğrulanmış influencer/UGC'lere ulaşabilsin; OAuth ile bağlanmış |
| 3.13-N4 | NOT | Ücret ödemeyen markalar tüm listeyi göremesin. Sistem markanın ihtiyacını (kategori, bütçe, ilanlar, hedef kitle) |
| 3.13-N5 | NOT | Listeler (Inflist) şimdilik tüm doğrulanmış markalara ücretsiz; ileride Spotlight'a dahil edilecek |
| 3.13-N6 | NOT | İleride gönderisi olmayan Instagram/TikTok hesapları doğrulamada kabul edilmeyecek (bugün 2.1-S2 düzeltmesiyle |
| 8.9-N1 | NOT | Siteye Drive benzeri bir dosya yapısı kurulacak (karar, 7 Ekim): görseller ve dosyalar (avatar, logo, ilan kapakları, |
| 10.4-N1 | NOT | `@testermobilapp` (marka, auth e-postası geçici bir test adresi) mobil uygulama testleri için bilinçli olarak tutuluyor; silinmeyecek (karar, 7 Ekim). |

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
- **Build:** `next build` için `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_ANON_KEY` gerekli. Route sildikten sonra `rm -rf .next/types` çalıştır.

## 8. Kuyruğun en sonu (kullanıcı kararı, 8 Ekim — "ne kaldı" sorulunca hatırlat)

- Arayüzdeki doğru olmayan iddialar: marka AI sayfasındaki "Yapay zeka algoritmamız … %95+ uyumlu" (3.5-S2, 2.9-S1),
  ana sayfadaki "Resmi Entegrasyon Ortaklarımız" platform logoları (9.1-S2), sabit "%5.2", "10K+", "50+", "%100" rakamları (9.1-S3).
- KVKK / kullanıcı sözleşmesi / açık rıza metinleri: `lib/legal-constants.ts` ile `app/legal/page.tsx` iki ayrı sürüm (1.7-S1);
  metinler kısa, avukat incelemesi önerildi.
- 5 Yıldız rozeti (puanlama sistemi) ileriki güncellemede.

