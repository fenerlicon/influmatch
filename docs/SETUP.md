# Influmatch kurulum ve yayın rehberi

> Kökteki eski kurulum notlarının (`DEPLOYMENT.md`, `VERCEL_FIX.md`, `SUPABASE_SETUP_CHECKLIST.md` vb.) yerini alır.
> Sistemin ayrıntılı haritası `docs/SYSTEM_MAP.md`, çalışma kuralları kökteki `CLAUDE.md`.

## 1. Yerelde çalıştırma

```bash
npm ci
cp env.example .env.local   # değerleri doldurun; .env* dosyaları commit edilmez
npm run dev                  # http://localhost:3000
```

Doğrulama (PR öncesi):

```bash
npx tsc --noEmit -p .
npx next lint
npx next build               # NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY gerekli
```

Bir route silindiyse build öncesi `.next/types` klasörünü silin.

## 2. Ortam değişkenleri

Vercel'de (Production + Preview) ve yerelde `.env.local`'de tanımlanır. Şablon: `env.example`.

| Değişken | Zorunlu | Amaç |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | evet | Supabase istemcileri |
| `SUPABASE_SERVICE_ROLE_KEY` | evet | Sunucu işleri: doğrulama, istatistik, vergi, cron, hesap silme. Yalnızca sunucuda. |
| `NEXT_PUBLIC_SITE_URL` | evet | Yönlendirmeler, e-posta bağlantıları, sitemap (`https://influmatch.net`) |
| `CRON_SECRET` | evet | `/api/cron/*` uçları yalnızca `Authorization: Bearer <CRON_SECRET>` ile çalışır |
| `RESEND_API_KEY`, `EMAIL_FROM` | evet | Kurumsal e-posta kodları ve admin uyarıları. Resend'de influmatch.net alan adı doğrulanmış olmalı. |
| `ALERT_EMAIL_TO`, `ALERT_EMAIL_FROM` | hayır | Admin uyarılarının alıcısı/göndericisi (boşsa admin hesaplarına gider) |
| `RESEND_DAILY_LIMIT`, `RESEND_MONTHLY_LIMIT` | hayır | Kota izleme eşikleri (ücretsiz plan 100 / 3000) |
| `APIFY_API_TOKEN`, `GEMINI_API_KEY`, `GEMINI_MODEL` | hayır | Anahtar havuzu boşken bir kez aktarılır; asıl yönetim `/admin/api-keys` |
| `TAX_AUTO_APPROVE` | hayır | Vergi levhası otomatik onayı. Varsayılan **kapalı**; kapalı kalmalı. |
| `TIKTOK_VIDEO_SAMPLE` | hayır | TikTok etkileşim hesabında örnek video sayısı (varsayılan 1) |
| `SOCIAL_OAUTH_ENABLED` | hayır | `true` olmadan Instagram/TikTok OAuth uçları başlamaz (şu an kapalı) |
| `INSTAGRAM_CLIENT_ID/SECRET`, `TIKTOK_CLIENT_KEY/SECRET` | hayır | Yalnızca OAuth açılırsa |

Gizli değerler hiçbir dosyaya, commit'e ya da sohbete açık metin olarak yazılmaz.

## 3. Supabase

- **Proje:** `aiftdpagcnwqzzemtkwt`. Auth'ta e-posta onayı açık, OTP 6 hane, Passkeys açık.
  "Leaked password protection" Pro planda açılacak.
- **Şema:** `supabase/migrations/20261009000000_schema_baseline.sql` canlı şemanın tam temelidir; yeni bir veritabanı
  bu dosya + sonraki zaman damgalı migration'larla kurulur. Eski dosyalar `supabase/migrations/_archive/` altında
  (çalıştırılmaz). Ayrıntı ve yazım kuralları: `supabase/README.md`.
- **Değişiklik kuralı:** risksiz değişiklikler (indeks, kısıt genişletme, GRANT/REVOKE, idempotent kolon, ALTER POLICY
  ile daraltma) `supabase/migrations/<zaman damgası>_<ad>.sql` olarak yazılır. Yerel oturum canlıya migration
  uygulayamadığı için bunlar da `supabase/manual/` altında toplu SQL olarak kullanıcıya verilir; riskliler
  (DROP POLICY, veri silme, kısıt daraltma) her durumda böyle verilir.
  Herkese açık yeni bir `users` kolonu eklenirken aynı migration'da
  `GRANT SELECT (kolon) ON public.users TO authenticated;` yazılır (yeni kolonlar gizli doğar; giriş yapmamış
  ziyaretçi `users` okuyamaz).
- **Storage kovaları:**

  | Kova | Erişim | Yol |
  |---|---|---|
  | `avatars` | herkese açık okuma | `{uid}/…` |
  | `advert-hero-images` | herkese açık okuma | kök |
  | `feedback-images` | gizli; admin imzalı URL ile açar | `feedback-<uuid>`, `support-ticket-<uuid>` |
  | `chat-attachments` | gizli; okuma ve yükleme oda taraflarına, imzalı URL | `{oda}/{uid}/…` |
  | `tax-documents` | gizli | `{uid}/…` |

- **Realtime yayını:** messages, offers, advert_applications, rooms, dismissed_offers, notifications,
  support_tickets, message_reports, user_badges. `users` gizli kolonları yüzünden bilerek dışarıda.

## 4. Zamanlanmış işler

| İş | Tetikleyici | Ayar |
|---|---|---|
| `/api/cron/refresh-stats` (günlük istatistik yenileme) | Vercel cron, 09:00 UTC | `vercel.json`; Vercel `CRON_SECRET`'ı otomatik ekler |
| `/api/cron/hourly` (anahtar sağlığı, uyarı e-postası, Spotlight süresi, mavi tik) | Supabase pg_cron, saatte bir | `supabase/cron/hourly_jobs.sql` |

`hourly_jobs.sql` bir kez SQL Editor'de çalıştırılır: önce `BURAYA_CRON_SECRET` Vercel'deki değerle değiştirilir,
sonra dosya çalıştırılır. Değiştirilmiş hali **commit edilmez**. Gizli değer Vault'ta tutulur. Kontrol ve kaldırma
komutları dosyanın başında.

## 5. Yayın (Vercel)

- Proje `influmatch` (Hobby). Alan adı influmatch.net. `main`'e her birleştirme production'a çıkar.
- Akış: dalda çalış → push → PR → Vercel önizlemesi **READY** → PR'ı birleştir (merge commit).
  Önizleme hata verirse birleştirme.
- Görsel optimizasyonu yalnızca Supabase deposu ve Instagram/TikTok CDN'lerine açık (`next.config.js`).

## 6. Mobil uygulama

`mobile-app/` (Expo). Şu an donduruldu; web tamamlanınca web kurallarına göre güncellenecek (CLAUDE.md kural 3).
