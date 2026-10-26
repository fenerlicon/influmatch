# Supabase bölge taşıma planı: Singapur → Frankfurt

> Karar (2026-10-26, kullanıcı): taşıma **Kasım'da** yapılır (SYSTEM_MAP 3.22-N1 / 3.22-N3). Bu belge yalnızca plandır; taşıma henüz yapılmadı.
> Neden: kullanıcılar Türkiye'de; veritabanı Singapur'da (`ap-southeast-1`), web fonksiyonları bu yüzden `sin1`'de. Frankfurt
> (`eu-central-1`) + Vercel `fra1` ile hem veritabanı hem fonksiyonlar kullanıcıya yakın olur.
> Supabase'de bir projenin bölgesi sonradan değiştirilemez: **yeni proje açılır, her şey taşınır, uygulama yeni projeye çevrilir.**
> "doğrulanacak" yazan komut / bayrak / davranış, taşıma günü Supabase belgesinden kontrol edilmeden çalıştırılmaz.

## 0. Özet sıra

1. Hazırlık (taşımadan günler önce): yeni proje, plan/maliyet, araçlar, prova.
2. Bakım penceresi başlar: yazmalar durur, saatlik görev durur.
3. Veritabanı (rol + şema + veri, auth dahil) dökümü → yeni projeye yükleme.
4. Depolama dosyaları kopyalanır (`scripts/storage-copy.mjs`).
5. Veritabanındaki eski depolama adresleri yeni adrese çevrilir.
6. Auth ayarları, Vault, pg_cron, Realtime yeni projede kurulur / kontrol edilir.
7. Vercel ortam değişkenleri + `vercel.json` (`fra1`) + `next.config.js` + mobil sabitler → yeni yayın.
8. Doğrulama listesi → bakım biter.
9. Eski proje 2 hafta salt okunur yedek olarak durur, sonra duraklatılır.

## 1. Kim ne yapar

| İş | Kullanıcı (proje sahibi) | Claude |
|---|---|---|
| Yeni proje açma (aynı organizasyon, bölge **Frankfurt / eu-central-1**), plan seçimi, maliyet onayı | ✅ | — |
| Veritabanı şifresi, bağlantı adresleri, service role anahtarı (yalnızca kendi bilgisayarında, ortam değişkeninde) | ✅ | asla görmez / yazdırmaz |
| `pg_dump` / `supabase db dump` + `psql` ile döküm ve yükleme (kendi bilgisayarından; Postgres istemcisi gerekir) | ✅ komutu çalıştırır | komutları hazırlar, çıktıyı yorumlar |
| `scripts/storage-copy.mjs` çalıştırma (anahtarlar ortam değişkeninde) | ✅ | betiği hazırlar / düzeltir |
| Auth ayarları (Site URL, yönlendirme adresleri, e-posta şablonu, SMTP, OTP, Passkeys) Dashboard'dan | ✅ | listeyi hazırlar, MCP ile okunabilenleri karşılaştırır |
| Vault + pg_cron (`supabase/cron/hourly_jobs.sql`, gerçek `CRON_SECRET` ile SQL Editor'de) | ✅ | dosyayı günceller (yer tutucuyla) |
| Vercel ortam değişkenlerini değiştirme | ✅ (ya da Vercel MCP onayıyla Claude; değer asla açık metin yazılmaz) | değişken listesini verir |
| Kod değişiklikleri (`vercel.json` `fra1`, `next.config.js`, mobil sabitler, belgeler) PR ile | — | ✅ |
| Yeni projeye Supabase MCP ile doğrulama sorguları (tablo sayıları, politikalar, yayın, cron) | — | ✅ (MCP izin verirse) |
| Mobil: yeni sürüm (Expo Go / geliştirme yapısı); mağazada değil, eski sürümle uyum gerekmez | ✅ (cihazda dener) | ✅ sabitleri değiştirir |

## 2. Hazırlık (taşımadan önce)

1. **Plan ve maliyet (kullanıcı):** yeni proje aynı organizasyonda açılır. Ücretsiz planda organizasyon başına etkin proje
   sınırı var (doğrulanacak: o günkü sınır); eski proje taşıma sonrası 2 hafta açık kalacağı için iki proje aynı anda açık
   olabilmeli. Gerekirse taşıma ayı Pro plana geçilir (Pro'da "Leaked password protection" da açılır, HANDOFF bölüm 3).
2. **Yeni proje:** bölge `Central EU (Frankfurt)`, güçlü veritabanı şifresi (parola yöneticisinde). Proje kimliği (`<YENI_REF>`) not edilir.
3. **Eklentiler:** yeni projede `pg_cron`, `pg_net`, `pgcrypto`, `uuid-ossp` (baseline başındaki liste) etkin olmalı:
   Dashboard → Database → Extensions. `pg_cron` / `pg_net` döküm yüklemeden **önce** açılır.
4. **Araçlar (kullanıcının bilgisayarı):** Supabase CLI (güncel), Postgres istemcisi (`psql`, sürümü sunucuyla uyumlu; doğrulanacak),
   Node 20+ ve repo kökünde `npm ci` (depolama betiği için).
5. **Postgres sürümü:** eski ve yeni projenin Postgres ana sürümü aynı olmalı ya da yeni proje daha yeni olmalı
   (Dashboard → Settings → Infrastructure). Farklıysa döküm yükleme provada denenir.
6. **Prova (önerilir):** bakım penceresinden önce aynı adımlar boş bir deneme projesine (ya da yeni projeye) uygulanır; sorun
   çıkan adım düzeltilir, sonra yeni proje sıfırlanıp asıl taşıma yapılır. Prova verisi gerçek kişisel veri içerir: deneme
   projesi aynı organizasyonda, iş bitince silinir (KVKK, CLAUDE.md kural 1: veri üçüncü tarafa gitmez; Supabase zaten veri işleyen).
7. **Taşıma öncesi bekleyen SQL:** `supabase/manual/` altında henüz çalıştırılmamış dosya kalmamalı (HANDOFF "Canlı SQL").
   Kalan varsa ya önce eskiye uygulanır ya da bilinçli olarak yeni projeye sonradan uygulanır; listesi taşıma notuna yazılır.
8. **Şema kayması (drift) riski:** canlı şema yalnızca migration dosyalarından gelmiyor (MCP ile parça parça uygulananlar, SQL Editor'de
   çalıştırılan `supabase/manual/` dosyaları). Bu yüzden yeni proje **migration'larla değil, canlının dökümüyle** kurulur.
   Migration klasörü kayıt olarak kalır; taşımadan sonra baseline yenilemesi ayrı iş (bkz. bölüm 10).

## 3. Bakım penceresi (yazmaları durdurma)

Gece saatinde (ör. Türkiye saatiyle 02:00–04:00) 1–2 saatlik pencere; kullanıcılara bir gün önce site içi duyuru.
Uygulamada bugün bir "bakım modu" anahtarı **yok**. İki seçenek:

- **A (önerilen, Claude hazırlar):** küçük bir bakım bayrağı (ör. Vercel ortam değişkeni `MAINTENANCE_MODE=1` iken middleware
  bütün sayfalara bakım sayfası, `/api/*` uçlarına 503 döner; `/api/cron/*` da durur). Taşımadan önce ayrı PR ile eklenir.
- **B (kodsuz):** eski veritabanını salt okunur yapmak: `ALTER DATABASE postgres SET default_transaction_read_only = on;`
  (yeni bağlantılarda geçerli; açık bağlantılar için Dashboard'dan veritabanı yeniden başlatma). Yazmaya çalışan kullanıcı hata görür.
  Geri alma: `ALTER DATABASE postgres SET default_transaction_read_only = off;` (doğrulanacak: Supabase'in kendi rolleri için etkisi).

Her iki seçenekte ek olarak eski projede saatlik görev durdurulur (SQL Editor):

```sql
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'influmatch-hourly';
```

Vercel'deki günlük `refresh-stats` cron'u pencere sırasında çalışmaz (09:00 UTC); pencere bu saate denk getirilmez.

## 4. Veritabanı taşıma (rol + şema + veri, auth kullanıcıları dahil)

Kaynak: Supabase belgesi **"Migrating within Supabase"** ve **"Backup and Restore using the CLI"** (Database → Backups bölümü).
Belgenin o günkü hali esas alınır; aşağıdaki komutlar o belgedeki akışın özetidir (bayraklar doğrulanacak).

Bağlantı adresleri Dashboard → Connect'ten alınır (eski ve yeni için **Session pooler** ya da doğrudan bağlantı; IPv6 sorunu
olursa pooler). Şifreli adresler yalnızca terminal ortam değişkeninde tutulur:

```bash
export OLD_DB_URL='postgresql://...eski...'   # dosyaya / commit'e yazılmaz
export NEW_DB_URL='postgresql://...yeni...'

# 1) Roller, şema, veri (auth şeması dahil; doğrulanacak: CLI sürümünde auth verisinin data dökümüne girdiği)
supabase db dump --db-url "$OLD_DB_URL" -f roles.sql --role-only
supabase db dump --db-url "$OLD_DB_URL" -f schema.sql
supabase db dump --db-url "$OLD_DB_URL" -f data.sql --use-copy --data-only

# 2) Yeni projeye tek işlemde yükleme; veri yüklenirken tetikleyiciler kapalı (session_replication_role = replica),
#    yoksa auth.users eklenirken on_auth_user_created tetikleyicisi public.users satırlarını ikinci kez açmaya çalışır.
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql \
  --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "$NEW_DB_URL"
```

Notlar:

- **Auth kullanıcıları ve şifreler:** `auth.users` satırları (bcrypt şifre özetleri dahil) veriyle gelir; kullanıcılar aynı şifreyle
  girer. Yeni projenin **JWT anahtarı farklıdır**: bütün oturumlar düşer, herkes (web + mobil) bir kez yeniden giriş yapar.
  Passkey kayıtları ve MFA faktörleri (`auth` şemasındaki tablolar) veriyle gelir ama passkey'ler alan adına / proje ayarına bağlı
  olabilir: doğrulanacak; çalışmazsa kullanıcı passkey'i yeniden ekler.
- **Döküm dosyaları gizli veri içerir** (e-posta, vergi bilgisi, şifre özetleri): yalnızca kullanıcının bilgisayarında, iş bitince silinir;
  hiçbir yere yüklenmez, Claude'a / sohbete yapıştırılmaz.
- **Kapsam:** `public` (bütün tablolar, fonksiyonlar, tetikleyiciler, RLS politikaları, kolon yetkileri, GRANT/REVOKE'lar),
  `auth` verisi, `storage.buckets` ve `storage.objects` **satırları** (dosyaların kendisi değil, bkz. bölüm 5),
  `public` üzerindeki `auth.users` tetikleyicileri (`on_auth_user_created`, `on_auth_user_email_verified`, davet `on_auth_user_invite`).
  Yükleme sonunda `session_replication_role` oturumla birlikte sıfırlanır.
- **storage.objects politikaları:** baseline'daki depolama politikaları (sohbet ekleri, vergi belgeleri, avatarlar...) şema dökümüyle gelir.
  MCP'den `storage.objects` politikası oluşturulamıyor ("must be owner", HANDOFF bölüm 7); döküm yükleme kullanıcının
  bağlantısıyla yapıldığı için sorun beklenmez, yine de bölüm 8'deki sorguyla sayısı karşılaştırılır.
- **Realtime yayını:** `supabase_realtime` yayınındaki tablolar (HANDOFF bölüm 7 listesi) şema dökümüyle gelmeyebilir
  (doğrulanacak). Gelmezse yeni projede SQL Editor'de, eksik her tablo için:
  `ALTER PUBLICATION supabase_realtime ADD TABLE public.<tablo>;`
- **Sıralar (sequence):** veri dökümü sıra değerlerini de taşır; bölüm 8'deki kontrol `setval` gerekip gerekmediğini gösterir.
- **Hata olursa:** `--single-transaction` sayesinde yeni proje yarım kalmaz; hata satırı düzeltilip komut tekrar çalıştırılır.

## 5. Depolama dosyaları

Veri dökümü dosyaları taşımaz. Kovalar: `avatars`, `advert-hero-images` (herkese açık), `chat-attachments`, `feedback-images`,
`tax-documents`, `task-proofs` (gizli). Betik: `scripts/storage-copy.mjs` (bütün kovaları gezer, eksik kovayı aynı ayarlarla açar,
her dosyayı indirip yeniye `upsert` ile yükler; hiçbir şey silmez, tekrar çalıştırılabilir).

```bash
OLD_SUPABASE_URL=https://<ESKI_REF>.supabase.co OLD_SERVICE_ROLE_KEY=... \
NEW_SUPABASE_URL=https://<YENI_REF>.supabase.co NEW_SERVICE_ROLE_KEY=... \
node scripts/storage-copy.mjs --dry-run      # önce sayım
# sonra aynı komut --dry-run olmadan
```

- Anahtarlar yalnızca o terminal oturumunda; komut geçmişine düşmemesi için `read -s` ile okunabilir.
- Betiğin sonunda kova başına dosya sayısı yazar; bölüm 8'de eski/yeni `storage.objects` sayısıyla karşılaştırılır.
- Bakım penceresinden önce bir kez çalıştırılıp pencere içinde yeniden çalıştırılırsa yalnızca kısa bir tekrar kalır
  (değişmeyen dosyalar da yeniden yüklenir; dosya sayısı az olduğu için sorun değil).

## 6. Veritabanındaki eski depolama adresleri

Bazı kolonlar dosyanın **tam adresini** (`https://<ESKI_REF>.supabase.co/storage/v1/object/public/...`) saklıyor. Kod adresi
`NEXT_PUBLIC_SUPABASE_URL` ile karşılaştırdığı için (`lib/chat-image.ts`, `lib/avatar-url.ts`, `lib/attachment-url.ts`,
`components/ui/Avatar.tsx`) taşımadan sonra eski adresler tanınmaz. Yeni projede, veri yüklemesinden sonra SQL Editor'de
(`<ESKI_REF>` / `<YENI_REF>` yerine gerçek kimlikler; tetikleyiciler kapalıyken):

```sql
SET session_replication_role = replica;
UPDATE public.users SET avatar_url = replace(avatar_url, 'https://<ESKI_REF>.supabase.co/', 'https://<YENI_REF>.supabase.co/')
  WHERE avatar_url LIKE 'https://<ESKI_REF>.supabase.co/%';
UPDATE public.advert_projects SET hero_image = replace(hero_image, 'https://<ESKI_REF>.supabase.co/', 'https://<YENI_REF>.supabase.co/')
  WHERE hero_image LIKE 'https://<ESKI_REF>.supabase.co/%';
UPDATE public.messages SET content = replace(content, 'https://<ESKI_REF>.supabase.co/', 'https://<YENI_REF>.supabase.co/')
  WHERE content LIKE '![image](https://<ESKI_REF>.supabase.co/%';
UPDATE public.feedback_submissions SET image_url = replace(image_url, 'https://<ESKI_REF>.supabase.co/', 'https://<YENI_REF>.supabase.co/')
  WHERE image_url LIKE 'https://<ESKI_REF>.supabase.co/%';
UPDATE public.support_tickets SET file_url = replace(file_url, 'https://<ESKI_REF>.supabase.co/', 'https://<YENI_REF>.supabase.co/')
  WHERE file_url LIKE 'https://<ESKI_REF>.supabase.co/%';
SET session_replication_role = origin;
```

Sonra eski adres kalmadığı kontrol edilir (Claude taşıma gününden önce bütün tablo/kolonları tarayan bir sorgu hazırlar;
yeni bir kolon eklendiyse listeye girer).

## 7. Yeni projede elle kurulacaklar

Döküme girmeyen ya da proje ayarı olanlar (Dashboard):

- **Auth → URL Configuration:** Site URL `https://influmatch.net`, yönlendirme adresleri eski projedekiyle aynı
  (www, önizleme adresleri, mobil şifre sıfırlama bağlantısı). Eski projeden ekran görüntüsüyle karşılaştır.
- **Auth → Providers / Sign In:** e-posta onayı açık, OTP 6 hane, Passkeys açık (SETUP bölüm 3). OAuth kapalı (mağaza yayınından sonra).
- **Auth → Email Templates:** `supabase/email-templates/confirm-signup.html` ve eski projedeki diğer şablonlar.
- **Auth → SMTP:** eski projede özel SMTP (Resend) tanımlıysa aynı ayar; gönderici alan adı değişmez.
- **Auth → Rate limits** ve **Attack protection:** eski projeyle aynı değerler.
- **Vault + pg_cron:** `supabase/cron/hourly_jobs.sql` yeni projede SQL Editor'de, `BURAYA_CRON_SECRET` gerçek değerle değiştirilerek
  (değiştirilmiş hali kaydedilmez / commit edilmez). Vault gizli değerleri dökümle taşınmaz (şifreleme anahtarı projeye özel; doğrulanacak),
  bu yüzden yeniden oluşturulur. Kontrol: `SELECT jobname, schedule FROM cron.job;`
- **Database → Extensions:** bölüm 2.3'teki liste.
- **API ayarları:** `public` dışındaki şemaların API'ye açılmadığı (eskiyle aynı) kontrol edilir.
- **Edge Functions:** repoda yok (`supabase/functions` klasörü yok); eski projede Dashboard'dan bakılır, varsa ayrıca taşınır.
- **Veritabanı webhook'ları / ek cron işleri:** eski projede `cron.job` ve Database → Webhooks listesi kontrol edilir; repoda yalnızca `influmatch-hourly` var.

## 8. Uygulama tarafı değişiklikler

**Vercel (Production + Preview) ortam değişkenleri** (değerler yeni projenin Dashboard → Settings → API sayfasından; açık metin yazılmaz):

| Değişken | Yeni değer |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<YENI_REF>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yeni anon (publishable) anahtar |
| `SUPABASE_SERVICE_ROLE_KEY` | yeni service role (secret) anahtar |
| `CRON_SECRET` | değişmez (Vault'a aynısı yazılır) |

`NEXT_PUBLIC_*` değişkenleri yapı anında koda gömülür: değiştirdikten sonra **yeniden yayın** gerekir.

**Kod (Claude, tek PR, taşıma günü birleştirilir):**

- `vercel.json`: `"regions": ["fra1"]` (bugün `sin1`).
- `next.config.js` `images.remotePatterns`: yeni Supabase alan adı (eski adres bir süre kalabilir, zararsız).
- `mobile-app/lib/supabase.ts`: yeni adres ve anon anahtar (anon anahtar herkese açık değerdir, uygulamaya gömülüdür).
- Belgeler: `CLAUDE.md` (proje kimliği), `docs/SETUP.md`, `docs/HANDOFF.md`, SYSTEM_MAP 3.22-N1/N3, `supabase/README.md`.
- Supabase MCP ve takip panosu notlarındaki proje kimliği.

**Mobil:** test aşamasında, mağazada değil: Expo Go / geliştirme yapısı yeni sabitlerle yeniden başlatılır. Kayıtlı push token'ları
`users.push_token` ile taşınır; cihaz yeniden girişte token'ı tekrar kaydeder.

## 9. Doğrulama listesi (bakım bitmeden)

Claude yeni projeye MCP ile (izin verilirse) ya da kullanıcı SQL Editor'de çalıştırır; eski projede aynı sorgular, sonuçlar yan yana:

- [ ] Tablo satır sayıları: `public` şemasındaki her tablo için `count(*)` (eski = yeni). Özellikle `users`, `auth.users`, `messages`,
      `offers`, `collaborations`, `user_badges`, `platform_settings`, `api_keys`.
- [ ] `auth.users` sayısı = `public.users` sayısı (eskideki farkla aynı).
- [ ] Politika sayısı: `SELECT schemaname, count(*) FROM pg_policies GROUP BY 1;` (public + storage).
- [ ] Tetikleyiciler: `SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal;` ve `auth.users` üzerindeki üç tetikleyici.
- [ ] Fonksiyon sayısı (`public` şeması) ve kolon yetkileri (`information_schema.column_privileges`, `users` için).
- [ ] Realtime: `SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY 1;` (HANDOFF listesiyle aynı).
- [ ] Depolama: kova başına `SELECT bucket_id, count(*) FROM storage.objects GROUP BY 1;` eski = yeni = betik çıktısı.
- [ ] Eski depolama adresi kalmadı (bölüm 6 kontrol sorgusu 0 satır).
- [ ] Sıralar: kimlik sütunu sıra kullanan tablo varsa `max(id)` ≤ sıranın son değeri.
- [ ] Saatlik görev: `SELECT * FROM cron.job;` → `influmatch-hourly`; ilk çalışmadan sonra `net._http_response` 200.
- [ ] Web (yeni yayın): giriş (eski şifreyle), kayıt + e-posta kodu, şifre sıfırlama e-postası, profil fotoğrafı görünür ve yüklenir,
      sohbette eski görseller açılır, yeni görsel gönderilir, teklif gönder / kabul et, bildirim zili canlı güncellenir (Realtime),
      admin paneli açılır, vergi levhası yükleme (imzalı adres), `/admin/api-keys` kontrolü çalışır.
- [ ] Mobil: giriş, mesajlaşma + görsel, push token kaydı, bildirim.
- [ ] Vercel fonksiyon bölgesi `fra1` (yayın ayrıntısında); Supabase Dashboard'da bölge Frankfurt.
- [ ] Gecikme: bir sayfanın sunucu süresi taşımadan önceki ölçümle karşılaştırılır (Speed Insights).

Hepsi tamamsa bakım bayrağı kapatılır / duyuru kaldırılır.

## 10. Geri dönüş (rollback) planı

Taşıma sırasında eski proje **silinmez, değiştirilmez** (yalnızca salt okunur yapılır ve saatlik görevi durdurulur). Bu yüzden:

- **Pencere içinde sorun çıkarsa:** Vercel ortam değişkenleri eski değerlere döner, `vercel.json` / `next.config.js` / mobil PR'ı
  geri alınır (ya da önceki yayın "Promote/Rollback" ile geri getirilir), eski veritabanında `default_transaction_read_only = off`,
  `hourly_jobs.sql` eski projede yeniden çalıştırılır. Pencere içinde yeni projeye yazılmış veri yoksa kayıp yok.
- **Yayından sonra (yeni projeye yazılmaya başlandıktan sonra) sorun çıkarsa:** geri dönmek yeni verinin kaybı demektir; önce sorunu
  yeni projede düzeltmek tercih edilir. Zorunluysa yeni projeden ters yönde aynı döküm/yükleme akışı (bölüm 4–6) uygulanır.
- Eski proje taşıma sonrası **2 hafta** duraklatılmadan tutulur (yedek ve karşılaştırma için), sonra kullanıcı kararıyla duraklatılır.
  Silme ayrı karar.

## 11. Taşımadan sonra

- `supabase/migrations/` için yeni baseline: yeni projenin dökümünden `20261101000000_schema_baseline.sql` benzeri tek dosya
  (eski baseline + sonrakiler `_archive/`'e), böylece drift kapanır.
- SYSTEM_MAP 3.22-N1 / 3.22-N3 ✅, HANDOFF ve SETUP güncellenir; takip panosu eşitlenir.
- KVKK kayıtlarında (docs/KVKK.md) veri işleme yeri "AB (Frankfurt)" olarak güncellenir (KVKK belgesi ayrı oturumun işi; not düşülür).
