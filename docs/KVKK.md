# KVKK teknik envanteri (2026-10-26)

> **Bu belge hukuki görüş değildir.** Kodun ve veritabanı şemasının okunmasıyla çıkarılmış teknik bir envanterdir: sistem hangi
> kişisel veriyi nerede tutuyor, kime gönderiyor, hangi hakları teknik olarak karşılıyor. Yasal metinleri (aydınlatma, açık rıza,
> çerez politikası, kullanıcı sözleşmesi) **avukat yazar**; Claude yasal metin yazmaz, değiştirmez (CLAUDE.md, tek kaynak `app/legal/page.tsx`).
> Numaralı maddeler `docs/SYSTEM_MAP.md` bölüm 14'te. Canlı veritabanına bu oturumda erişilemedi (Supabase bağlantısı yetkisiz);
> şema bilgisi `supabase/migrations/` dosyalarından.

İlgili mevzuat (kontrol listesi için anıldı): 6698 sayılı KVKK; Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar
Hakkında Tebliğ; Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ; VERBİS (Veri Sorumluları Sicili) Yönetmeliği; KVKK md. 9
(yurt dışına aktarım, 2024 değişikliği: yeterlilik kararı / standart sözleşme + Kurul'a bildirim / bağlayıcı şirket kuralları);
Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik (saklama ve imha politikası);
KVKK Çerez Uygulamaları Hakkında Rehber; 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun ve Ticari İletişim ve Ticari
Elektronik İletiler Hakkında Yönetmelik (İYS); 5651 sayılı Kanun (yer sağlayıcı trafik bilgisi).

---

## 1. Neler var

### 1.1 Hangi veriyi nerede tutuyoruz

| Veri | Nerede | Kim okuyabilir |
|---|---|---|
| Hesap: e-posta, şifre (hash), son giriş, kayıt metadata'sı (rol, ad, davet kodu, onaylanan metin sürümü) | Supabase Auth (`auth.users`) | Kullanıcı kendisi; sunucu (service role) |
| Profil: ad / marka adı, kullanıcı adı, avatar, biyografi, şehir, kategori, sosyal bağlantılar, rozetler, müsaitlik, Spotlight planı | `public.users` | Giriş yapmış herkes (herkese açık kolonlar); giriş yapmamış ziyaretçi okuyamaz (kural 2) |
| Gizli profil alanları: e-posta kopyası, vergi no (VKN **veya şahıs şirketinde TCKN**), vergi dairesi/il, ticari unvan, kurumsal e-posta, admin notu, push token, e-posta tercihleri | `public.users` (kolon yetkisiyle istemcilere kapalı) | Sahibi kendi satırının bir kısmını; sunucu; admin |
| Vergi levhası dosyası + ondan okunan bilgiler | Storage `tax-documents/{uid}/` (gizli) + `tax_verifications` | Sahibi (kayıt); admin 10 dk imzalı bağlantıyla. Dosya **yerelde** ayrıştırılır, dış servise gitmez (kural 1) |
| Kurumsal e-posta doğrulama kodu | `corporate_email_verifications` (yalnızca hash) | Yalnızca sunucu |
| Sosyal hesaplar (kullanıcı adı, platform kimliği, takipçi, etkileşim, özet istatistik) + geçmiş | `social_accounts`, `social_account_history` | Giriş yapmış kullanıcılar (doğrulanmış hesap kartı); yazım yalnızca sunucu |
| Teklifler, ilanlar, başvurular (ön yazı, yanıtlar), iş birlikleri, anlaşma özeti, teslimatlar, ödeme teyidi, kampanyalar, gönderi ölçümleri | ilgili tablolar | Yalnızca taraflar + admin (RLS); kabul edilen teklifte karşı tarafın **hesap e-postası** açılır (`get_offer_contact_email`) |
| Mesajlar ve sohbet görselleri | `messages`, `rooms`, Storage `chat-attachments/{oda}/{uid}/` (gizli, imzalı bağlantı) | Odanın iki tarafı; şikâyet edilen mesajı admin |
| Destek talepleri, geri bildirimler ve ekleri | `support_tickets`, `feedback_submissions`, Storage `feedback-images` (gizli) | Sahibi + admin |
| Şikâyetler, engellemeler | `message_reports` (şikâyet edilen mesajın kopyası dahil), `user_blocks` | Bildiren + admin / engelleyen |
| Bildirimler | `notifications` | Sahibi |
| Görev kanıtları (story ekran görüntüsü), davet kodları | Storage `task-proofs/{uid}/` (gizli), `task_submissions`, `invite_codes`, `user_invites` | Sunucu + admin |
| Davranış verisi: son görülme, profil görüntüleme (kim kimi, günde bir), ilan görüntüleme olayları, okundu bilgisi | `user_activity`, `profile_views`, `analytics_events`, `room_reads` | Sunucu; profil sahibi yalnızca sayı görür |
| Push token (cihaz) | `users.push_token` | Yalnızca sunucu |
| Rıza kayıtları (yeni) | `consent_records` | Yalnızca sunucu |
| Hassas erişim günlüğü (yeni) | `privacy_audit_log` | Yalnızca sunucu |
| Tarayıcıda | Supabase oturum çerezleri (`sb-*`), `im_cookie_consent` (12 ay), şifre sıfırlama çerezleri (`im_pw_reset_req` 1 saat, `im_pw_recovery` 15 dk), OAuth durum çerezi (kapalı özellik); localStorage: onboarding taslağı, çerez tercihi eşitleme işareti | Kullanıcının tarayıcısı |
| IP adresi | Uygulama **kendi tablosunda IP tutmuyor**. Supabase Auth denetim kayıtları ve Vercel istek kayıtları IP içerir (servis sağlayıcı tarafı). | Servis sağlayıcı panelleri |

Gereksiz veri toplanmıyor: doğum tarihi, telefon, adres, IBAN / banka bilgisi, kimlik kartı **alınmıyor** (aydınlatma metni bunları sayıyor, bkz. bölüm 3).

### 1.2 Veri işleyenler ve yurt dışı aktarım

| Sağlayıcı | Ne gidiyor | Konum | Not |
|---|---|---|---|
| **Supabase** (veritabanı, Auth, Storage, Realtime) | Tüm veriler | **Singapur** (ap-southeast-1) | Yurt dışı aktarım. Taşıma kararı bekliyor (3.22-N3, Frankfurt). |
| **Vercel** (barındırma, sunucu fonksiyonları, cron, kayıtlar) | Her istek (IP, URL, oturum çerezi), sunucu kayıtları | Fonksiyonlar `sin1` (Singapur); şirket ABD | Yurt dışı aktarım. |
| **Vercel Speed Insights** | Sayfa adresi, cihaz/ağ performans ölçümü | ABD | Yalnızca çerez bandında "Tümünü kabul et" sonrası. Çerez kullanmıyor. |
| **Resend** (e-posta) | Alıcı e-posta adresi, e-posta içeriği (bildirim metni, doğrulama kodu) | ABD | Yurt dışı aktarım. |
| **Expo push → Apple APNs / Google FCM** | Push token, bildirim başlığı ve metni (ör. marka adı, teklif bildirimi; mesaj içeriği gönderilmez) | ABD | Yurt dışı aktarım. Mobil henüz mağazada değil. |
| **Apify** (kazıma) | Kullanıcının bağladığı Instagram/TikTok **kullanıcı adı**, teslimat / görev gönderi bağlantıları; dönüş herkese açık profil istatistikleri | AB şirketi, altyapı büyük ihtimalle ABD | Kişinin kendi hesabının herkese açık verisi; yine de işleyen sayılır. |
| Google Fonts | — | — | **Gitmiyor**: `next/font` yazı tiplerini derlemede kendi sunucumuzdan veriyor. |
| Analitik / reklam (Google Analytics, Meta Pixel vb.) | — | — | **Yok.** |
| Ödeme (Iyzico, Stripe) | — | — | **Yok**; ödeme platform üzerinden yapılmıyor. |

### 1.3 Haklar (md. 11) — teknik karşılık

- **Erişim / kopya:** bu turda eklendi: "Verilerimi indir" (web Ayarlar → Güvenlik → Verilerin; mobil Ayarlar → Verilerin). Bkz. bölüm 4.
- **Düzeltme:** profil, şirket bilgisi, sosyal bağlantılar, e-posta tercihleri kullanıcı tarafından düzenlenebiliyor (web + mobil).
  Kullanıcı adı ve hesap e-postası değiştirilemiyor (destek talebiyle).
- **Silme:** web Ayarlar'da şifre tekrar sorularak tam silme (`lib/account-deletion.ts`: giriş kilidi → dosyalar → profil → giriş kaydı);
  admin de silebiliyor. Mobilde bu turda eklendi.
- **İtiraz / bilgi talebi:** destek talebi formu ve `destek@influmatch.net` var; KVKK başvurusu için ayrı kanal / kayıt / 30 gün takibi yok (bölüm 2).
- **Pazarlama izni:** Ayarlar'da ayrı, **varsayılan kapalı** "Pazarlama iletileri" anahtarı var; şu an hiç pazarlama e-postası gönderilmiyor.
  Bildirim e-postalarının sonunda tercihlerin nereden kapatılacağı yazıyor.

### 1.4 Güvenlik tedbirleri (mevcut)

- RLS bütün tablolarda; yeni tablolar istemci rollerine kapalı doğuyor, yazımlar sunucuda service role ile ve kodda taraf kontrolüyle.
- Service role anahtarı yalnızca sunucu kodunda (istemci bileşeni ve mobil uygulamada yok).
- Gizli kovalar (vergi, sohbet, destek, görev) imzalı kısa süreli bağlantıyla; vergi levhası yalnızca imzalı yükleme adresiyle.
- `users` gizli kolonları kolon yetkisiyle kapalı; `users` Realtime yayınında değil.
- Giriş yapmadan profil yok, profiller arama motorlarına kapalı.
- Kayıtlara (`console.log`) kişisel veri yazılmıyor (8.7-S5).
- Hesap silmede şifre tekrar soruluyor; silinen hesap giriş yapamıyor.
- Vergi levhası dış yapay zekâya / üçüncü tarafa gitmiyor; otomatik onay kapalı.

---

## 2. Neler eksik

| No | Eksik | Durum |
|---|---|---|
| 14.2-S1 | Kullanıcının kendi verisini indirebilmesi (erişim hakkı) | ✅ bu turda |
| 14.5-S1 | Mobilde uygulama içi hesap silme (App Store / Google Play şartı) | ✅ bu turda |
| 14.3-S1 | Rıza kaydı (kim, ne zaman, hangi metin sürümü) | ✅ bu turda (SQL çalıştırılınca kayıt başlar) |
| 14.4-S1 | Admin'in vergi levhası / özel ek açmasının günlüğü | ✅ bu turda |
| 14.3-S4 | Çerez tercihini sonradan değiştirme bağlantısı, reddet = kabul et eşitliği, politika sürümü | ✅ bu turda |
| 14.2-S4 | KVKK başvuruları için kanal + kayıt + 30 gün takibi (Başvuru Tebliği) | Karar / avukat |
| 14.4-S5 | Saklama ve imha süreleri ve bunları uygulayan otomatik işler (bildirimler, mesajlar, profil görüntülemeleri, analitik, süresi geçmiş doğrulama kodları, şikâyet kopyaları, vergi levhası dosyası onaydan sonra, günlükler) | Karar (süreler) |
| 14.4-S2 | Admin hesaplarında iki adımlı doğrulama (Supabase MFA) | Sahibin işi |
| 14.4-S3 | Şifre en az uzunluğu web'de 6, mobilde 8; sızdırılmış şifre koruması kapalı (Pro planda) | Karar + Supabase ayarı |
| 14.6-N9 | Yaş kontrolü yok (sözleşme "18 yaşından büyük" diyor; influencer'lar reşit olmayabilir) | Karar |
| 14.5-S2 | Mobil izin açıklamaları (iOS fotoğraf erişimi vb.) Türkçe değil; App Store gizlilik etiketi ve Play "Veri güvenliği" formu doldurulmadı | Mağaza yayınından önce |
| 14.4-S7 | Admin kullanıcı listesinde gizli alanların (e-posta, vergi no) görüntülenmesi günlüklenmiyor | Açık |
| 14.4-S6 | RLS / güvenlik danışmanı (advisors) bu oturumda çalıştırılamadı | Sonraki oturum |
| — | VERBİS kaydı, işleyen sözleşmeleri (DPA), yurt dışı aktarım için standart sözleşme + Kurul'a bildirim | Sahibin işi (bölüm 6) |

---

## 3. Neler yanlış / tutarsız (yasal metin ↔ sistem)

Metinler **değiştirilmedi**; aşağıdaki liste avukata verilecek. Kaynak: `app/legal/page.tsx` (2026-10-26 hâli).

**Gizlilik / KVKK aydınlatma sekmesi**
1. "İşlenen kişisel veriler" toplanmayanları sayıyor: doğum tarihi, T.C. kimlik numarası (fatura için), telefon, ikamet adresi,
   IBAN / banka hesap bilgisi. Sistem bunları almıyor. **Ancak** şahıs şirketi markada vergi no alanına **TCKN** girilebiliyor
   (vergi levhası doğrulaması bunu kabul ediyor) — bu ayrıca belirtilmeli.
2. "Cihaz bilgileri, IP, giriş-çıkış logları": uygulama IP tutmuyor; servis sağlayıcıların (Supabase Auth, Vercel) kayıtlarında var.
   Push token (cihaz) tutuluyor. Son görülme ve profil görüntüleme kaydı tutuluyor; metinde yok.
3. Amaçlar: "ödeme hizmetlerinin sağlanması, finansal mutabakat" ve "fatura kesimi" — platform ödeme almıyor/aracılık etmiyor
   (kullanıcı sözleşmesi md. 5 de bunu söylüyor). Spotlight ücretli olunca ödeme kuruluşu eklenecek; metin o zaman yazılmalı.
4. "Kişisel verileriniz açık rızanız olmaksızın üçüncü kişilerle paylaşılmaz": veriler işleyenlere ve **yurt dışına** gidiyor
   (Supabase Singapur, Vercel / Resend / Expo-Apple-Google ABD, Apify). Yurt dışı aktarımdan hiç söz edilmiyor.
   "Iyzico, Stripe" anılıyor, kullanılmıyor.
5. Kabul edilen teklifte karşı tarafa hesap e-postası açılıyor (metin "iletişim bilgileri paylaşılabilir" diyor — uyumlu, ama
   hangi bilginin açıldığı netleşmeli). Profil bilgileri (ad, şehir, sosyal hesap, istatistik, rozet, müsaitlik, iş birliği sonuçları)
   giriş yapmış tüm kullanıcılara görünüyor; metinde yok.
6. Veri sorumlusu "Influmatch Teknoloji ve Medya Hizmetleri": şirket henüz kurulmadı (ROADMAP: 1 Ocak). Unvan, adres, MERSİS / VKN,
   iletişim (KEP dahil) yok.
7. Aydınlatma Tebliği'nin istediği bölümler yok ya da eksik: hukuki sebepler (md. 5/6), toplama yöntemi, aktarılan alıcı grupları ve
   amaçları, md. 11 haklarının tamamı (yalnızca 3'ü sayılmış), başvuru yöntemi (Başvuru Tebliği: yazılı, KEP, kayıtlı e-posta, sistemdeki
   e-posta; 30 gün), saklama süresi.
8. "Aleyhinize çıkan otomatik analiz": sistemde otomatik değerlendirmeler var — güven skoru, mavi tik kuralı, liyakat sıralaması,
   keşif çarkı, gönderisiz hesabın doğrulanmaması, vergi levhası ön kontrolü (otomatik onay kapalı). Metinde adlandırılmalı mı, avukata.
9. Gönderi ölçümü (sonuç raporu) ve görev ölçümü için kullanıcının herkese açık gönderi verisi Apify ile alınıyor; portföyde marka adı
   markanın iznine bağlı. Metinde yok.

**Kullanıcı sözleşmesi sekmesi**
10. "Kullanıcı 18 yaşından büyük olduğunu beyan eder": kayıtta yaş sorulmuyor / beyan alınmıyor (tek onay kutusu "Kullanım Koşulları ve
    Gizlilik Politikası'nı okudum ve kabul ediyorum").
11. "Devam eden bir İşbirliği varsa hesap kapatılamaz": sistem bunu engellemiyor; hesap silinince taraf olduğu teklif, sohbet,
    iş birliği kayıtları **karşı taraf için de** siliniyor (veritabanında CASCADE). Ürün kararı + metin uyumu gerekir.
12. Mesaj tablosunda "adli kayıt sebebiyle silinemez" kuralı var (kullanıcı silemez), fakat hesap silinince mesajlar da siliniyor.
    5651 / delil saklama ihtiyacı ile KVKK silme hakkı arasındaki denge avukata.

**Çerez politikası sekmesi**
13. "Analitik çerezler (Google Analytics vb.)" ve "Pazarlama çerezleri": sitede **yok**. Kullanılan tek isteğe bağlı araç Vercel Speed
    Insights (çerez bırakmıyor, onaydan sonra yükleniyor) ve adı geçmiyor. Kullanılan çerezlerin listesi (ad, amaç, süre, taraf) yok:
    bölüm 1.1 "Tarayıcıda" satırı.
14. "Çerez yönetimi: tarayıcı ayarlarından": artık sitede de "Çerez tercihleri" bağlantısı var.

**Kayıt onayı ve çerez bandı**
15. Kayıt formunda aydınlatma, kullanıcı sözleşmesi ve gizlilik **tek kutuda** "okudum ve **kabul ediyorum**". Aydınlatma "kabul"
    edilen bir metin değil, bilgilendirmedir; açık rıza gerekiyorsa (ör. yurt dışı aktarım için standart sözleşme yoksa, pazarlama)
    ayrı, işaretsiz, hizmet şartına bağlanmamış bir kutu olmalı. Teknik altyapı hazır (rıza türü + sürüm kaydı); metin ve kutular avukattan.
16. Çerez bandı metni geçici yazıldı, avukat onayından geçmedi (`components/consent/CookieConsent.tsx`).

---

## 4. Bu turda yapılanlar (`claude/kvkk`)

- **Verilerimi indir** (`lib/data-export.ts`): web `POST /api/account/export` (Ayarlar → Güvenlik → **Verilerin** → İndir), mobil
  `POST /api/mobile/account/export` (Ayarlar → Verilerin; paylaşım penceresiyle kaydedilir). Kullanıcı başına 10 dakikada bir, her
  indirme günlüğe yazılır. **Başkasının kişisel verisi girmez:** sohbette yalnızca kullanıcının yazdığı mesajlar (gelenler sayı olarak),
  ilana gelen başvurular / profil görüntüleyenler / davet edilenler yalnızca sayı, karşı taraflar yalnızca kimlik numarasıyla.
  Admin notu, doğrulama kodu hash'i, inceleyen admin kimliği, push token dışarıda.
- **Hesap silme boşlukları kapandı** (`lib/account-deletion.ts`): kullanıcının taraf olduğu odaların sohbet görselleri, destek ve
  geri bildirim ekleri, ilan kapakları (`{uid}/` ve eski kök), sosyal hesaplar (giriş kaydı silinemezse de) silinir; dosya listesi
  profil silinmeden önce çıkarılır, depolama listesi sayfalanır.
- **Mobil uygulama içi hesap silme:** Ayarlar → Verilerin → Hesabı sil (şifre tekrar), `POST /api/mobile/account/delete`, web ile aynı kod.
- **Rıza kayıtları** (`consent_records`, `lib/consent.ts`): kayıt anında onaylanan metin sürümü (web + mobil metadata `legal_consent_version`,
  `auth.users` tetikleyicisi sunucu saatiyle yazar), çerez tercihi (giriş yapmış kullanıcı, `/api/consent`), pazarlama e-postası izni
  verme / geri alma. Sürüm sabitleri `lib/consent-shared.ts` (mobil kopya `mobile-app/constants/consent.js`).
- **Hassas erişim günlüğü** (`privacy_audit_log`, `lib/privacy-audit.ts`): admin'in vergi levhası (`app/admin/tax-document-actions.ts`)
  ve özel ek (sohbet / destek / geri bildirim) açması, kullanıcıların veri indirmesi.
- **Çerez bandı:** "Yalnızca zorunlu" ve "Tümünü kabul et" eşit görünümde; alt bilgide ve Ayarlar'da **Çerez tercihleri** bandı yeniden
  açar; izin geri alınınca sayfa yenilenir (yüklenmiş ölçüm betiği kalmaz); çerez değeri politika sürümünü taşır, sürüm değişince yeniden sorulur.
  Bant metni değiştirilmedi.
- **Veritabanı:** `supabase/migrations/20261026000050_kvkk_consent_audit.sql` (iki tablo, istemcilere kapalı, + tetikleyici). Canlıya
  **uygulanmadı** (Supabase bağlantısı yetkisiz); sahibin çalıştıracağı dosya `supabase/manual/2026-10-26_kvkk.sql`. Kod tablolar yokken de
  çalışır (yalnızca kayıt tutulmaz; indirme sınırı bellekte).

---

## 5. Avukata gidecek liste

1. **Aydınlatma metni** (Aydınlatma Tebliği'ne göre): veri sorumlusu kimliği (şirket kurulunca), veri kategorileri (bölüm 1.1 tablosu
   esas alınmalı; toplanmayanlar çıkmalı, TCKN-vergi no durumu), amaçlar (ödeme amaçları çıkmalı ya da ödeme gelince eklenmeli), hukuki
   sebepler, toplama yöntemi (form, mobil uygulama, kazıma ile herkese açık sosyal medya verisi, çerezler), alıcı grupları (diğer kullanıcılar
   — profil ve kabul edilen teklifte e-posta; işleyenler; yetkili kurumlar), yurt dışı aktarım, md. 11 hakları ve başvuru yöntemi, saklama süreleri.
2. **Açık rıza metni(leri):** hangi işlemler için gerekli (yurt dışı aktarım — md. 9'daki standart sözleşme yoluna gidilmezse; pazarlama
   iletisi; varsa diğerleri). Her biri ayrı, işaretsiz, hizmete şart koşulmamış kutu. Teknik altyapı hazır; kutu metinleri ve sayısı avukattan.
   Kayıt formundaki birleşik "okudum ve kabul ediyorum" kutusunun ayrılması (sözleşme kabulü / aydınlatmayı okudum / açık rıza).
3. **Çerez politikası:** gerçek çerez listesi (bölüm 1.1), Speed Insights, GA / pazarlama çerezi ibarelerinin kaldırılması, bant metni.
4. **Yurt dışı aktarım (md. 9, 2024):** Supabase (Singapur), Vercel, Resend, Expo / Apple / Google, Apify için aktarım dayanağı
   (standart sözleşme + 5 iş günü içinde Kurul'a bildirim mi, açık rıza mı). Bölge taşıma (Frankfurt) kararı bunu değiştirmez (AB de yurt dışı).
5. **Saklama ve imha politikası:** her veri grubu için süre (hesap silindikten sonra ne kalır; mesajlar, şikâyet kopyaları, vergi levhası
   dosyası, rıza kayıtları — silmeden sonra ispat için tutulmalı mı —, erişim günlükleri, bildirimler, analitik, servis sağlayıcı kayıtları),
   periyodik imha aralığı. Sistemdeki "mesajlar adli kayıt, silinemez" kuralı ile hesap silme çelişkisi; 5651 trafik bilgisi saklama.
6. **VERBİS:** kayıt yükümlülüğü (çalışan sayısı / ciro eşiği, yurt dışı yerleşik değil; ana faaliyet özel nitelikli veri değil) — şirket
   kurulunca değerlendirilmeli.
7. **İşleyen sözleşmeleri:** Supabase, Vercel, Resend, Apify, Expo DPA'ları yeterli mi; Türkçe / KVKK eki gerekli mi.
8. **Kullanıcı sözleşmesi:** 18 yaş beyanı ve doğrulama yöntemi; "devam eden iş birliği varken hesap kapatılamaz" maddesi (sistem uygulamıyor);
   silme sonrası karşı tarafın iş kayıtları.
9. **Ticari elektronik ileti:** pazarlama e-postası ve ileride haftalık özet / kampanya duyurusu gönderilecekse İYS kaydı, onay metni, ret bağlantısı.
   "Platform güncellemeleri" (destek yanıtı, hesap onayı, ilan kaldırma) bilgilendirme sayılır mı.
10. **Otomatik karar:** güven skoru, mavi tik, liyakat sıralaması, keşif çarkı, gönderisiz hesap reddi — md. 11/1-g kapsamında itiraz yolu.
11. **Veri indirme kapsamı:** admin notları (kullanıcı hakkında iç not) erişim hakkına dahil mi (şu an dışarıda); dosyaların kendisi
    (yalnızca adları listeleniyor) verilmeli mi.
12. **Çocuklar:** reşit olmayan influencer'lar için veli onayı gerekip gerekmediği.

---

## 6. Sahibinin karar / iş listesi

**Kararlar (Claude bekliyor, karar gelince uygular)**
- [ ] **Yaş politikası** (14.6-N9): alt sınır kaç (18? 16 + veli onayı?), nasıl sorulacak (doğum tarihi mi, "18 yaşından büyüğüm" kutusu mu).
- [ ] **Saklama süreleri** (14.4-S5): avukatın imha politikası gelince otomatik silme işleri saatlik göreve eklenir.
- [ ] **Hesap silme ve süren iş birliği** (14.2-S3): aktif iş birliği / kabul edilmiş teklif varken silme engellensin mi; karşı tarafın kayıtları
      silinsin mi anonimleştirilsin mi.
- [ ] **KVKK başvuru kanalı** (14.2-S4): destek formuna "KVKK başvurusu" konusu + 30 gün takibi mi, ayrı e-posta mı (`kvkk@`), KEP mi.
- [ ] **Bölge taşıma** (3.22-N3): Supabase'i Frankfurt'a, fonksiyonları `fra1`'e taşıma (yeni proje + veri / depolama / auth taşıma).
- [ ] **Şifre politikası** (14.4-S3): en az 8 karakter her yerde (web 6 diyor) — onay verilirse web formu ve Supabase ayarı birlikte.

**Sahibin kendi işleri**
- [ ] `supabase/manual/2026-10-26_kvkk.sql` dosyasını SQL Editor'de çalıştır (rıza kayıtları ve erişim günlüğü bundan sonra başlar).
- [ ] Avukata bölüm 3 ve 5'i ilet; gelen metinler `app/legal/page.tsx`'e yerleştirilince `lib/consent-shared.ts` (+ mobil kopya) sürümleri
      metnin tarihine çekilir.
- [ ] Şirket kurulunca (1 Ocak) veri sorumlusu bilgileri; VERBİS yükümlülüğünü avukatla kontrol et.
- [ ] İşleyen sözleşmeleri (DPA): Supabase, Vercel, Resend, Apify, Expo panellerinden imzala / indir, sakla.
- [ ] Yurt dışı aktarım için standart sözleşme gerekiyorsa imzalandıktan sonra 5 iş günü içinde Kurul'a bildirim.
- [ ] Admin hesaplarında Supabase MFA (iki adımlı doğrulama) aç (14.4-S2).
- [ ] Supabase Pro'ya geçince "Leaked password protection" aç; yedekleme / PITR planı.
- [ ] Mağaza yayınından önce (14.5-S2): App Store gizlilik etiketi, Google Play "Veri güvenliği" formu (bölüm 1.1–1.2 tabloları esas).
      Google Play ayrıca uygulama dışından açılabilen bir hesap silme bağlantısı istiyor: web Ayarlar → Güvenlik girişle açılıyor; girişsiz
      bir talep sayfası gerekip gerekmediğine karar ver.
- [ ] Canlı veritabanı: `claude/kvkk` birleşmeden önce ya da hemen sonra SQL'i çalıştır (14.7-S1).
