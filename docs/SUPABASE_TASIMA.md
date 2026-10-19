# Supabase'i Frankfurt'a taşıma planı

> Durum: **plan** (2026-10-19). Bu belgedeki hiçbir adım henüz uygulanmadı. Canlıya dokunan her adım Arda'nın onayıyla,
> belirlenen kesinti penceresinde yapılır.

## 0. Neden, ne kazanılır

- Bugün: Supabase `aiftdpagcnwqzzemtkwt` **Singapur (ap-southeast-1)**, kullanıcılar Türkiye'de. Vercel fonksiyonları
  geçici olarak `sin1`'e alındı (PR 115, `vercel.json`); böylece sunucu ↔ veritabanı yakın, ama tarayıcı ↔ sunucu ve
  tarayıcı ↔ Supabase (Realtime, Storage, istemci sorguları, Auth) her istekte İstanbul–Singapur gidiş-dönüşü (~180–250 ms) ödüyor.
- Hedef: Supabase **Frankfurt (eu-central-1)** + Vercel fonksiyonları **`fra1`**. İstanbul–Frankfurt ~40–60 ms.
- Supabase bölge değiştirmeyi yerinde desteklemez: **yeni proje açılır, şema + veri + kullanıcılar + dosyalar taşınır,
  uygulama yeni projeye çevrilir.** Eski proje bir süre yedek olarak durur, sonra silinir.

Kısaltmalar: **ESKİ** = `aiftdpagcnwqzzemtkwt` (Singapur), **YENİ** = Frankfurt'ta açılacak proje (ref'i açılınca belli olur,
belgede `YENI_REF`).

---

## 1. Arda'nın yapması gerekenler (panel, ödeme, gizli değerler)

Bunları Claude yapamaz (ödeme, panel girişi, gizli anahtarlar). Sıra numaraları §4'teki takvime bağlı.

| # | Ne zaman | İş |
|---|---|---|
| A1 | Hazırlık | **Plan kararı** (§9): YENİ projeyi hangi planda açacağız. Org'da 2'den fazla Free proje açılamıyor; açılamazsa Pro'ya geç ya da kullanılmayan bir Free projeyi sil. |
| A2 | Hazırlık | Supabase panelinde **New project → Region: Central EU (Frankfurt) eu-central-1**, ad `influmatch-fra`. Güçlü bir DB şifresi belirle, şifre yöneticisine kaydet. Ref'i Claude'a söyle (ref gizli değil, şifre gizli). |
| A3 | Hazırlık | YENİ projede **Auth ayarları** (§5.5 listesi): Site URL, Redirect URL'ler, e-posta onayı, OTP 6 hane, Passkeys, oran sınırları. ESKİ panelden birebir kopyala (ekran görüntüsü al). |
| A4 | Hazırlık | YENİ projede **SMTP**: Resend (host `smtp.resend.com`, port 465, kullanıcı `resend`, şifre = Resend API anahtarı, gönderen ESKİ'deki ile aynı). API anahtarını sen gir. |
| A5 | Hazırlık | YENİ projede **e-posta şablonları**: ESKİ panelden (Auth → Email Templates) her şablonu (Confirm signup, Reset password, Magic link, Change email, Invite, Reauthentication) kopyala-yapıştır. `confirm-signup` repoda da var: `supabase/email-templates/confirm-signup.html`. |
| A6 | Hazırlık | Her iki projede **Storage → S3 Access Keys** oluştur (yalnızca taşıma için; sonra sil). Dosya kopyalama için gerekli (§5.4). Anahtarları sohbete yazma, kopyalama makinesinde ortam değişkeni olarak gir. |
| A7 | Hazırlık | Kopyalamayı çalıştıracak makineye **Docker Desktop + Supabase CLI** (ya da PostgreSQL 17 istemci araçları) ve **rclone** kur. İki projenin **Session pooler** bağlantı dizesini (Connect → Session pooler) bu makinede ortam değişkeni yap: `OLD_DB_URL`, `NEW_DB_URL`. |
| A8 | Hazırlık | Kesinti penceresini seç (§6; öneri: hafta içi 03:00–04:00 TSİ) ve mobil test kullanıcılarına haber ver. |
| A9 | Kesinti | **Vercel ortam değişkenleri** (Production + Preview): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` → YENİ değerler; `MAINTENANCE_MODE` aç/kapa. Değerleri kendin gir; Claude okumaz, yazdırmaz. |
| A10 | Kesinti | YENİ projede SQL Editor'de `supabase/cron/hourly_jobs.sql` dosyasını **gerçek `CRON_SECRET` ile** çalıştır (değiştirilmiş hali commit edilmez). |
| A11 | Kesinti sonrası | Yerel `.env.local` dosyalarını (tüm worktree'ler) YENİ değerlerle güncelle. |
| A12 | +14 gün | Her şey yolundaysa ESKİ projeyi **pause**, sonra sil (ödemeyi durdurur). S3 erişim anahtarlarını sil. |
| A13 | İsteğe bağlı | **DNS**: yalnızca §9'daki "özel alan adı" (`api.influmatch.net`) seçilirse: Supabase'in vereceği CNAME + TXT kayıtlarını alan adı panelinde ekle. Seçilmezse DNS işi yok (influmatch.net Vercel'de kalır). |

---

## 2. Envanter: Supabase adresinin geçtiği her yer

Repo taraması (2026-10-19, `main` = `db4a135`). `aiftdpagcnwqzzemtkwt` ve `supabase.co` için.

### 2.1 Sabit yazılmış adres / ref (değişmeli)

| Yer | Ne | Yapılacak |
|---|---|---|
| `next.config.js:11` | `images.remotePatterns` → `aiftdpagcnwqzzemtkwt.supabase.co` | YENİ host eklenir. Geçişte ikisi birlikte durur (Vercel görsel önbelleği ve eski adresli kayıtlar için), ESKİ silinince ESKİ satır kaldırılır. |
| `mobile-app/lib/supabase.ts:6-7` | URL **ve anon anahtarı** sabit yazılı | Hazırlık PR'ında `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`'e taşınır (varsayılan ESKİ değer), geçişte YENİ'ye çevrilir. Test kullanıcıları yeni derlemeyi alır. |
| `CLAUDE.md:19`, `docs/SETUP.md:48` | Proje ref'i belgede | Geçiş sonrası YENİ ref yazılır; bölge notu eklenir. |
| `supabase/migrations/20261009000000_schema_baseline.sql:4` | Yorumda ESKİ ref | Tarih notu; değişmez. |
| `vercel.json` | `"regions": ["sin1"]` | Geçişte `["fra1"]`. |

### 2.2 Ortam değişkeninden okunan (kod değişmez, değişken değişir)

`NEXT_PUBLIC_SUPABASE_URL` (13 yer), `NEXT_PUBLIC_SUPABASE_ANON_KEY` (6), `SUPABASE_SERVICE_ROLE_KEY` (1):
`utils/supabase/{server,client,admin}.ts`, `middleware.ts`, `lib/mobile-auth.ts`,
`app/dashboard/influencer/settings/actions.ts`, `lib/supabase/legacy-session-cookie.ts` ve aşağıdaki URL yardımcıları.

> `NEXT_PUBLIC_*` değişkenleri **derleme anında** koda gömülür: Vercel'de değiştirdikten sonra **yeniden derleme (redeploy) şart**.

### 2.3 Adresi önek olarak karşılaştıran kod (veritabanı yeniden yazılmazsa kırılır)

Bu dosyalar kayıtlı URL'nin `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/...` ile başlamasını bekler. Ortam değişkeni YENİ'ye
dönünce veritabanındaki ESKİ adresli kayıtlar eşleşmez. Bu yüzden **§5.3'teki URL yeniden yazımı zorunlu**:

| Dosya | Etki (yeniden yazılmazsa) |
|---|---|
| `lib/chat-image.ts` | Sohbetteki eski görseller görsel değil düz metin görünür, imzalı bağlantı üretilmez. |
| `lib/avatar-url.ts` | Profil kaydında mevcut avatar "izin verilmeyen adres" sayılabilir (yalnızca değişmemişse geçer). |
| `lib/attachment-url.ts` | Eski geri bildirim/destek ekleri reddedilir. |
| `components/ui/Avatar.tsx:40` | Eski avatarlar Next görsel optimizasyonundan geçmez (orijinal boyut iner). |
| `lib/account-deletion.ts` | Yol, hosttan bağımsız regex ile çıkarılıyor; etkilenmez. |
| `mobile-app/screens/MessagesScreen.js:21`, `mobile-app/utils/image.js:9` | Hosttan bağımsız (`supabase.co` + yol). Etkilenmez; §9'daki özel alan adı seçilirse `image.js` güncellenmeli. |

### 2.4 Veritabanında saklanan tam URL'ler

Şemadan (baseline + sonraki migration'lar) çıkan aday kolonlar:

| Tablo.kolon | İçerik |
|---|---|
| `public.users.avatar_url` | `avatars` kovası public URL'si (marka logosu da burada) |
| `public.advert_projects.hero_image` | `advert-hero-images` public URL'si |
| `public.messages.content` | Görsel mesaj: `![image](<…/chat-attachments/…>)` |
| `public.message_logs.content` | Mesaj kopyası (aynı biçim) |
| `public.feedback_submissions.image_url` | `feedback-images` URL'si |
| `public.support_tickets.file_url` | `feedback-images` URL'si |
| `auth.users.raw_user_meta_data` | Kayıtta yazılmışsa `avatar_url` |

Yol saklayanlar (`tax_verifications.file_path`, görev `proof_path`) host içermez, değişmez. Kesin liste §5.3'teki
keşif sorgusuyla ESKİ veritabanında çıkarılır (jsonb kolonlar dahil); bu tablo onunla karşılaştırılır.

### 2.5 Supabase'e bağlı olmayanlar (değişmez)

- Instagram/TikTok OAuth yönlendirmeleri `influmatch.net` üzerinden; Supabase Auth OAuth kullanılmıyor.
- `/auth/callback`, şifre sıfırlama bağlantıları `NEXT_PUBLIC_SITE_URL` (influmatch.net) üzerinden.
- Mobil simülatör proxy'si (`mobile-app/metro.config.js`) influmatch.net'e gider.
- Edge Function yok (repoda `supabase/functions` yok).
- Vercel `refresh-stats` cron'u (`vercel.json`) Vercel'de, değişmez.

---

## 3. Taşınacak bileşenler

| Bileşen | Kaynak | Yöntem |
|---|---|---|
| Şema (tablolar, RLS, kolon yetkileri, fonksiyonlar, tetikleyiciler, Realtime yayını) | ESKİ'nin **canlı** şeması | `supabase db dump` (§5.1). Repo dosyaları (`supabase/migrations/` + `supabase/manual/`) karşılaştırma için; SQL Editor'den elle uygulanmış her şey canlı dökümde zaten var. |
| Veri (public) | ESKİ | `supabase db dump --data-only` (§5.2) |
| Auth kullanıcıları + şifre hash'leri | ESKİ `auth.*` | Aynı veri dökümü. `auth.users.encrypted_password` bcrypt; taşınabilir, **kimse yeniden şifre almaz**. `auth.identities`, `auth.mfa_factors` (Passkeys) de gelir. |
| Storage kovaları | ESKİ `storage.buckets` | Veri dökümü (kova ayarları: public/gizli, boyut, MIME). |
| Storage dosyaları | ESKİ S3 | rclone (§5.4) + sahiplik düzeltmesi |
| pg_cron + Vault | `supabase/cron/hourly_jobs.sql` | Elle, gerçek secret ile (A10). `cron` ve `vault` şemaları dökümde **yoktur**. |
| Auth ayarları, şablonlar, SMTP | ESKİ panel | Elle (A3–A5) |
| API anahtarları | YENİ panel | Vercel + mobil (A9) |

---

## 4. Takvim (sıralı)

```
G-7 … G-2   Hazırlık PR'ı (Claude) · YENİ proje + ayarlar (Arda) · PROVA taşıması + önizlemede test
G-1         Prova sonuçlarının kontrolü, kesinti penceresinin teyidi
G (gece)    Kesinti: son veri kopyası → geçiş → doğrulama (hedef ≤ 60 dk)
G+1 … G+14  İzleme; ESKİ proje salt okunur yedek
G+14        ESKİ pause → sil
```

### 4.1 Hazırlık PR'ı (Claude, canlıyı etkilemez)

Ayrı bir PR, birleşmesi davranışı değiştirmez:

1. **Bakım modu**: `MAINTENANCE_MODE=true` ise `middleware.ts` her isteğe (statik dosyalar ve `/api/cron/*` hariç) 503 + kısa
   "Bakım çalışması, birazdan döneceğiz" sayfası döner. `/api/mobile/*` 503 JSON döner. Varsayılan kapalı. `MAINTENANCE_BYPASS` değeriyle eşleşen çerezi taşıyan tarayıcı
   bakım modunu atlar (geçiş sonrası duman testi için).
2. **Mobil yapılandırma**: `mobile-app/lib/supabase.ts` → `process.env.EXPO_PUBLIC_SUPABASE_URL ?? <ESKİ>` ve anon anahtar aynı şekilde.
3. **`next.config.js`**: `remotePatterns`'a host, `NEXT_PUBLIC_SUPABASE_URL`'den türetilerek eklenir + ESKİ host sabit kalır
   (geçişte iki host da optimize edilir; kod değişmeden YENİ'ye uyum).
4. **Taşıma betikleri** `scripts/supabase-tasima/` altında (gizli değer içermez, değerleri ortam değişkeninden okur):
   `dump.sh`, `restore.sh`, `url_rewrite.sql`, `storage_owner_fix.sql`, `verify.sql` (§5'teki içerik).

### 4.2 Prova (G-7 … G-2)

1. A1–A7 tamamlanır.
2. §5.1–§5.5 YENİ projeye uygulanır (ESKİ yalnızca okunur, canlı etkilenmez).
3. Vercel'de **yalnızca bir önizleme dalı** için (Preview, branch'e özel) ortam değişkenleri YENİ'ye çevrilir; o dalın
   önizlemesinde §7 duman testi yapılır. Production'a dokunulmaz.
4. Mobil: simülatör `EXPO_PUBLIC_SUPABASE_*` YENİ ile çalıştırılıp giriş + mesaj + görsel denenir.
5. Süreler not edilir (döküm, geri yükleme, dosya kopyası) → kesinti penceresinin gerçek süresi bilinir.

Provadan sonra YENİ'deki şema kalır; veri kesintide sıfırdan yüklenir (§6 adım 5), dosyalar rclone ile yalnızca fark kadar kopyalanır.

---

## 5. Teknik adımlar

Komutlar, A7'deki makinede Git Bash/WSL ile çalıştırılır. `OLD_DB_URL` / `NEW_DB_URL` Session pooler dizeleri
(`postgresql://postgres.<ref>:<şifre>@aws-0-<bölge>.pooler.supabase.com:5432/postgres`). Doğrudan bağlantı IPv6 olduğu için
ev ağından pooler kullanılır.

### 5.0 Ön kontrol (ESKİ'de, salt okunur)

```sql
SELECT version();                                   -- YENİ'nin Postgres sürümü >= ESKİ olmalı
SELECT extname, extversion FROM pg_extension ORDER BY 1;
SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY 2;
SELECT count(*) FROM auth.users;
SELECT bucket_id, count(*), pg_size_pretty(sum((metadata->>'size')::bigint)) FROM storage.objects GROUP BY 1;
SELECT jobid, jobname, schedule FROM cron.job;
SELECT name FROM vault.secrets;
SELECT pg_size_pretty(pg_database_size(current_database()));
```

Beklenen Realtime yayını: `advert_applications, dismissed_offers, message_reports, messages, notifications, offers, rooms,
support_tickets, user_badges, collaborations` + `20261010000040_collaboration_workspace.sql`'in eklediği tablolar.
Beklenen kovalar: `avatars`, `advert-hero-images` (public); `chat-attachments`, `feedback-images`, `tax-documents`, `task-proofs` (gizli).

YENİ projede, şemadan önce **Database → Extensions**: `pg_cron`, `pg_net` açılır (`uuid-ossp`, `pgcrypto` varsayılan açık).

### 5.1 Şema

Supabase'in resmî "Backup and restore using CLI" yolu:

```bash
supabase db dump --db-url "$OLD_DB_URL" -f roles.sql  --role-only
supabase db dump --db-url "$OLD_DB_URL" -f schema.sql
```

```bash
psql "$NEW_DB_URL" --single-transaction -v ON_ERROR_STOP=1 -f roles.sql -f schema.sql
```

Kontrol: `schema.sql` ile repodaki `supabase/migrations/*` arasında fark varsa (ör. SQL Editor'de elle uygulanmış ama dosyası
olmayan fonksiyon) not edilir ve **ayrı bir migration dosyası olarak repoya eklenir** — kaynak canlı döküm olduğu için taşımayı
engellemez, sadece repo eksiğini kapatır. `supabase/manual/*.sql` dosyaları canlıda uygulanmış durumda; dökümde zaten var,
ayrıca çalıştırılmaz.

### 5.2 Veri + Auth kullanıcıları

```bash
supabase db dump --db-url "$OLD_DB_URL" -f data.sql --use-copy --data-only \
  -x "storage.objects" -x "storage.buckets_vectors" -x "storage.vector_indexes"
```

```bash
psql "$NEW_DB_URL" --single-transaction -v ON_ERROR_STOP=1 \
  -c "SET session_replication_role = replica" -f data.sql
```

- `session_replication_role = replica` **zorunlu**: `on_auth_user_created` (auth.users → public.users) ve
  `on_auth_user_email_verified` tetikleyicileri ile `users` koruma tetikleyicileri geri yükleme sırasında çalışırsa
  çift kayıt / reddedilen güncelleme olur.
- Şifreler: `auth.users.encrypted_password` (bcrypt) olduğu gibi gelir. Doğrulama: §7'de eski şifreyle giriş.
- Dizi (sequence) değerleri dökümdeki `setval` ile gelir; §5.6'da kontrol edilir.
- `storage.objects` satırları bilerek dışarıda: dosyalar §5.4'te kopyalanınca YENİ'de oluşur, sahiplik sonra düzeltilir.

### 5.3 Veritabanındaki URL'lerin yeniden yazımı

Önce keşif (ESKİ'de salt okunur, provada YENİ'de de): hangi kolonda kaç satır ESKİ hostu içeriyor.

```sql
-- Sonuç: tablo, kolon, satır sayısı. Yalnızca SELECT çalıştırır.
CREATE TEMP TABLE _url_hits(tbl text, col text, n bigint);
DO $d$
DECLARE r record; cnt bigint;
BEGIN
  FOR r IN
    SELECT table_schema, table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema IN ('public','auth')
      AND data_type IN ('text','character varying','jsonb','json')
  LOOP
    EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I::text LIKE %L',
                   r.table_schema, r.table_name, r.column_name, '%aiftdpagcnwqzzemtkwt.supabase.co%') INTO cnt;
    IF cnt > 0 THEN INSERT INTO _url_hits VALUES (r.table_schema||'.'||r.table_name, r.column_name, cnt); END IF;
  END LOOP;
END $d$;
SELECT * FROM _url_hits ORDER BY 1, 2;
```

Sonra YENİ'de, veri yüklendikten hemen sonra (aynı oturumda tetikleyiciler kapalı):

```sql
SET session_replication_role = replica;
DO $d$
DECLARE r record; old_host text := 'aiftdpagcnwqzzemtkwt.supabase.co'; new_host text := 'YENI_REF.supabase.co';
BEGIN
  FOR r IN
    SELECT table_schema, table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema IN ('public','auth')
      AND data_type IN ('text','character varying','jsonb','json')
  LOOP
    IF r.data_type IN ('jsonb','json') THEN
      EXECUTE format('UPDATE %I.%I SET %I = replace(%I::text, %L, %L)::%s WHERE %I::text LIKE %L',
        r.table_schema, r.table_name, r.column_name, r.column_name, old_host, new_host, r.data_type,
        r.column_name, '%'||old_host||'%');
    ELSE
      EXECUTE format('UPDATE %I.%I SET %I = replace(%I, %L, %L) WHERE %I LIKE %L',
        r.table_schema, r.table_name, r.column_name, r.column_name, old_host, new_host,
        r.column_name, '%'||old_host||'%');
    END IF;
  END LOOP;
END $d$;
RESET session_replication_role;
```

Ardından keşif sorgusu YENİ'de tekrar çalıştırılır: **sonuç boş olmalı**. Tetikleyiciler kapalı olduğu için `updated_at`
alanları değişmez (sıralama ve "son güncelleme" bozulmaz).

### 5.4 Storage dosyaları

rclone, iki projenin S3 uç noktasıyla (A6). `~/.config/rclone/rclone.conf`:

```ini
[eski]
type = s3
provider = Other
endpoint = https://aiftdpagcnwqzzemtkwt.supabase.co/storage/v1/s3
region = ap-southeast-1
access_key_id = <A6, ESKİ>
secret_access_key = <A6, ESKİ>

[yeni]
type = s3
provider = Other
endpoint = https://YENI_REF.supabase.co/storage/v1/s3
region = eu-central-1
access_key_id = <A6, YENİ>
secret_access_key = <A6, YENİ>
```

```bash
for b in avatars advert-hero-images chat-attachments feedback-images tax-documents task-proofs; do
  rclone copy "eski:$b" "yeni:$b" --metadata --transfers 8 --checksum -P
  rclone check "eski:$b" "yeni:$b" --one-way
done
```

- Provada tamamı, kesintide yalnızca fark kopyalanır (`copy` var olanı atlar).
- Dosya yolları aynı kalır (`{uid}/…`, `{oda}/{uid}/…`); yol tabanlı RLS politikaları olduğu gibi çalışır.
- **Sahiplik**: S3 ile yüklenen nesnelerin `owner` alanı boş olur. `feedback-images` ve `advert-hero-images` güncelleme/silme
  politikaları `auth.uid() = owner` kullanıyor. Düzeltme:

```bash
# ESKİ'den sahiplik listesi
psql "$OLD_DB_URL" -c "\copy (SELECT bucket_id, name, owner, owner_id FROM storage.objects) TO 'owners.csv' CSV"
```

```sql
-- YENİ'de
CREATE TEMP TABLE _owners(bucket_id text, name text, owner uuid, owner_id text);
\copy _owners FROM 'owners.csv' CSV
UPDATE storage.objects o SET owner = w.owner, owner_id = w.owner_id
FROM _owners w WHERE o.bucket_id = w.bucket_id AND o.name = w.name
  AND (o.owner IS DISTINCT FROM w.owner OR o.owner_id IS DISTINCT FROM w.owner_id);
```

Kontrol: kova başına `count(*)` ve toplam boyut §5.0'daki değerlerle aynı.

### 5.5 Panel ayarları (A3–A5'in kontrol listesi)

ESKİ panelden birebir kopyalanır, Claude provada ikisini yan yana karşılaştırır:

- **Auth → URL Configuration**: Site URL `https://influmatch.net`; Redirect URLs: `https://influmatch.net/**`,
  `https://www.influmatch.net/**` (varsa), Vercel önizleme deseni (ESKİ'de ne varsa), `http://localhost:3000/**`.
- **Auth → Providers → Email**: e-posta onayı açık, OTP uzunluğu 6, OTP süresi, "Secure email change", şifre kuralları.
- **Passkeys / WebAuthn**: açık; RP ID ve izinli kökenler ESKİ ile aynı (`influmatch.net`). Kayıtlı passkey'ler
  `auth` dökümüyle gelir, RP ID aynıysa çalışmaya devam eder.
- **Rate limits** (e-posta/saat, OTP, token yenileme) ESKİ ile aynı.
- **SMTP** (A4) ve **şablonlar** (A5). Şablonlardaki bağlantılar `{{ .SiteURL }}` / `{{ .ConfirmationURL }}` / `{{ .TokenHash }}`
  ile kurulduğu için host değişikliğinden etkilenmez; elle yazılmış bir `supabase.co` adresi varsa düzeltilir.
- **Auth Hooks**: ESKİ'de tanımlı hook varsa aynısı (beklenen: yok).
- **Realtime → Settings**: ESKİ ile aynı (public erişim / kanal ayarları). Yayın tabloları şema dökümüyle gelir, §5.0 sorgusu YENİ'de tekrarlanır.
- **API → Data API**: açık şemalar (`public`) ve "max rows" ESKİ ile aynı.
- **Storage → Settings**: genel dosya boyutu sınırı, görsel dönüştürme (mobil `render/image` kullanıyor; plan izin veriyorsa açık).
- **Database → Network restrictions / SSL**: ESKİ'de ne varsa.

### 5.6 Doğrulama sorguları (YENİ, veri sonrası)

```sql
-- Tablo satır sayıları (aynı sorgu ESKİ'de de çalıştırılıp karşılaştırılır)
SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY 1;  -- önce ANALYZE;
SELECT count(*) FROM auth.users; SELECT count(*) FROM auth.identities; SELECT count(*) FROM auth.mfa_factors;
-- Dizilerin tablo maksimumunun üstünde olduğu
SELECT sequencename, last_value FROM pg_sequences WHERE schemaname = 'public';
-- auth.users ile public.users eşleşmesi
SELECT count(*) FROM auth.users a LEFT JOIN public.users u ON u.id = a.id WHERE u.id IS NULL;   -- ESKİ ile aynı olmalı
```

Kesin satır sayısı karşılaştırması için `pg_stat` yerine her tabloda `count(*)` (veri küçük, saniyeler sürer).

---

## 6. Kesinti günü (G), adım adım

Hedef süre ≤ 60 dk. Provada ölçülen süreler buraya yazılır.

| # | Kim | Adım |
|---|---|---|
| 1 | Arda | Vercel Production: `MAINTENANCE_MODE=true` → Redeploy. Site bakım sayfası gösterir. |
| 2 | Claude | ESKİ'de saatlik görevi durdur: `SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'influmatch-hourly';` |
| 3 | Claude | ESKİ'yi yazmaya kapat (mobil uygulama Supabase'e doğrudan yazdığı için): `ALTER DATABASE postgres SET default_transaction_read_only = on;` + `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'postgres' AND pid <> pg_backend_pid() AND usename IN ('authenticator','authenticated','anon');` Geri almak: `… = off`. |
| 4 | Claude | Son döküm: §5.2 `data.sql` + §5.4 `owners.csv`. |
| 5 | Claude | YENİ'de provadan kalan veriyi temizle: `SET session_replication_role = replica;` sonra `public` şemasındaki tüm tablolar + `auth.users` için tek `TRUNCATE … CASCADE` (liste `pg_tables`'tan üretilir; `storage.objects` hariç). |
| 6 | Claude | §5.2 geri yükleme → §5.3 URL yeniden yazımı → keşif sorgusu boş mu. |
| 7 | Claude | §5.4 `rclone copy` (fark) + `rclone check` + sahiplik düzeltmesi. |
| 8 | Claude | §5.6 doğrulama; ESKİ ile sayılar aynı değilse **dur → §8 geri dönüş**. |
| 9 | Arda | A10: YENİ'de `hourly_jobs.sql` (gerçek secret). |
| 10 | Arda | A9: Vercel Production + Preview → YENİ URL ve anahtarlar; `MAINTENANCE_MODE` hâlâ `true`. |
| 11 | Claude | **Geçiş PR'ı**nı birleştir: `vercel.json` → `"regions": ["fra1"]`, `next.config.js` YENİ host, `CLAUDE.md`/`docs/SETUP.md` YENİ ref + bölge, mobil varsayılan URL/anahtar YENİ. Bu birleştirme yeni derlemeyi başlatır. |
| 12 | Claude | Yeni derleme READY → bakım modundayken `MAINTENANCE_BYPASS` çereziyle §7 duman testi. |
| 13 | Arda | Test geçerse `MAINTENANCE_MODE=false` → Redeploy. **Site açık.** |
| 14 | Claude | `x-vercel-id` başlığında `fra1::fra1` görüldüğünü doğrula; ilk saatte Vercel ve Supabase loglarını izle. Saat başında cron'un çalıştığını (`cron.job_run_details`, `/admin/api-keys` "Son otomatik kontrol") doğrula. |
| 15 | Arda | Mobil test kullanıcılarına yeni derleme / Expo güncellemesi. |

**Not — oturumlar:** `@supabase/ssr` çerez adı proje ref'inden türetilir (`sb-<ref>-auth-token`) ve JWT imza anahtarı yeni
projede farklıdır. Sonuç: **herkes bir kez yeniden giriş yapar** (şifre aynı, sıfırlama gerekmez). Mobilde de aynı.
`lib/supabase/legacy-session-cookie.ts` ESKİ ref'li çerezi okumaz; zararsız, kalabilir.

---

## 7. Duman testi (prova ve G günü)

Çok hesapla (influencer, marka, admin, `@testermobilapp`):

1. Eski şifreyle giriş (e-posta + şifre) ve passkey ile giriş.
2. Yeni kayıt → onay e-postası Resend'den gelir → `/auth/callback` → onboarding.
3. Şifre sıfırlama e-postası + yeni şifreyle giriş (web ve mobil `/api/mobile/forgot-password`).
4. Profil fotoğrafı değiştirme (yeni URL YENİ host), eski avatarlar görünüyor ve Next optimizasyonundan geçiyor.
5. İlan oluşturma + kapak görseli; eski ilan kapakları görünüyor.
6. Teklif gönderme, sohbet, **eski sohbet görselleri görsel olarak** açılıyor, yeni görsel gönderme, Realtime ile anlık mesaj.
7. Bildirimler anlık düşüyor (Realtime `notifications`).
8. Vergi levhası yükleme + admin imzalı URL ile açma; görev kanıtı yükleme (`task-proofs`).
9. Destek talebi + ek; admin ekte imzalı URL.
10. Admin paneli: `/admin/api-keys` anahtar listesi, kullanıcı listesi.
11. Hesap silme (test hesabıyla): dosyalar YENİ kovalardan silinir.
12. `/api/cron/hourly` el ile (CRON_SECRET ile) 200 döner.

---

## 8. Geri dönüş planı

| Ne zaman | Nasıl | Veri kaybı |
|---|---|---|
| Adım 1–12 arası (site henüz açılmadı) | ESKİ: `ALTER DATABASE postgres SET default_transaction_read_only = off;` + `hourly_jobs.sql` ile cron'u tekrar kur. Vercel env'leri ESKİ'ye geri, geçiş PR'ını revert et (regions `sin1`), `MAINTENANCE_MODE=false`, redeploy. | Yok (ESKİ'ye bu sürede yazılmadı). |
| Site açıldıktan sonra ilk ~2 saat, kritik hata | Önce **düzeltmeyi dene**. Olmazsa bakım modu → YENİ'den ESKİ'ye **ters yönde** §5.2 + §5.3 (host ters) + §5.4 fark kopyası → yukarıdaki satır. | Yok, ama 30–60 dk ek kesinti. |
| Sonrası | Geri dönüş yerine ileri düzeltme. ESKİ, G+14'e kadar salt okunur yedek olarak durur (pause değil; salt okunur). | — |

Ön koşul: ESKİ proje G+14'e kadar **silinmez ve pause edilmez**; Vercel'deki ESKİ değerler bir yerde (şifre yöneticisi) not edilir.

---

## 9. Maliyet ve kararlar (Arda)

Fiyatlar 2026-10 itibarıyla Supabase fiyat sayfasından **tekrar doğrulanmalı**:

- **Bugünkü plan**: Free görünüyor (`docs/SETUP.md`: "Leaked password protection Pro planda açılacak").
- **Seçenek 1 — Free'de kal**: YENİ Frankfurt projesi Free açılabilir (org başına 2 aktif Free proje sınırı; taşıma süresince
  ESKİ + YENİ = 2). Free proje 7 gün hareketsizlikte uyutulur (canlıda sorun değil), günlük yedek ve PITR yok.
- **Seçenek 2 — Pro (öneri, satış öncesi zaten gerekecek)**: ~25 $/ay, 10 $ işlem kredisi bir Micro örneği karşılar. Taşıma süresince
  ESKİ + YENİ iki proje ≈ ek ~10 $ (gün bazında). Günlük yedek, leaked password protection, daha yüksek kotalar, görsel dönüştürme.
  Pro'ya YENİ projede geçmek yeterli; ESKİ Free kalabilir.
- **Seçenek 3 — Özel alan adı (`api.influmatch.net`)**: ~10 $/ay eklenti (Pro gerekir). Adres bir daha değişmez, gelecekte taşıma
  URL yeniden yazımı gerektirmez. Seçilirse: DNS (A13), `next.config.js` hostu, `mobile-app/utils/image.js` koşulu ve §5.3'teki
  `new_host` buna göre. Şimdilik **gerekli değil**; satış sonrası düşünülebilir.
- **Vercel**: `fra1` Hobby planda seçilebilir, ek maliyet yok.

Açık kararlar: plan (1/2), özel alan adı (evet/hayır), kesinti tarihi.

---

## 10. Taşıma sonrası

- `vercel.json` → `"regions": ["fra1"]` (geçiş PR'ında). `docs/HANDOFF.md`'de `sin1` geçici çözümüne dair not varsa güncellenir.
- `CLAUDE.md`, `docs/SETUP.md`: YENİ ref + bölge; `.claude` ve MCP yapılandırmalarında ESKİ ref varsa güncellenir.
- G+14: `next.config.js`'ten ESKİ host satırı çıkarılır, ESKİ proje pause → silinir, S3 anahtarları silinir (A12).
- Kalıcı iyileştirme (ayrı iş): veritabanında tam URL yerine **kova içi yol** saklamak (`avatar_url`, `hero_image`, sohbet görselleri);
  böylece bir sonraki taşımada ya da özel alan adına geçişte URL yeniden yazımı gerekmez.
