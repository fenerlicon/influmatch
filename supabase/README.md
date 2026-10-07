# Supabase şeması

## Klasörler

| Yol | İçerik |
|---|---|
| `migrations/20261009000000_schema_baseline.sql` | Canlı şemanın tam temeli (2026-10-09, katalogdan üretildi). |
| `migrations/2026100900000N_*.sql` ve sonrası | Temelden sonraki değişiklikler, sırayla. |
| `migrations/_archive/` | Temelden önceki eski migration'lar ve eski `schema.sql`. Yalnızca geçmiş için; **çalıştırılmaz**. Bir kısmı sıfırdan sırayla oynatılamıyordu (SYSTEM_MAP 7.1-S1). |
| `manual/` | Kullanıcının SQL Editor'de tek seferde çalıştırdığı toplu dosyalar (migration'ların birleşimi). |
| `cron/hourly_jobs.sql` | pg_cron + Vault saatlik görev kurulumu (gizli değer yer tutucuyla). |
| `email-templates/` | Auth e-posta şablonları. |
| `seed.sql` | Geliştirme verisi. |

## Yeni bir veritabanı kurmak

1. Boş Supabase projesinde SQL Editor'de `migrations/20261009000000_schema_baseline.sql` dosyasını çalıştırın.
2. Ardından `migrations/` altındaki sonraki dosyaları zaman damgası sırasıyla çalıştırın.
3. `cron/hourly_jobs.sql` dosyasını `BURAYA_CRON_SECRET` yerine gerçek değeri yazarak çalıştırın (değiştirilmiş hali commit edilmez).
4. Auth ayarları (e-posta onayı, OTP 6 hane, Passkeys, yönlendirme adresleri, şablonlar) panelden yapılır; bkz. `docs/SETUP.md`.

Temel dosyası canlıda zaten uygulanmış durumdadır; canlıda tekrar çalıştırmaya gerek yoktur
(çalıştırılırsa aynı durumu yeniden kurar).

## Yeni değişiklik eklemek

- Dosya adı `YYYYMMDDHHMMSS_kisa_ad.sql`. Tekrar çalıştırılabilir yazın (`IF NOT EXISTS`, `DROP ... IF EXISTS`, `CREATE OR REPLACE`).
- SQL Editor uyumu: fonksiyonlarda `DECLARE` kullanmayın, yorumlarda tek tırnak ve soru işareti kullanmayın
  (düzenli ifadede soru işareti gerekiyorsa `chr(63)`).
- Herkese açık yeni bir `users` kolonu eklerken aynı dosyada `GRANT SELECT (kolon) ON public.users TO authenticated;` yazın;
  yeni kolonlar varsayılan olarak gizli doğar.
- Riskli değişiklikler (DROP POLICY, veri silme, kısıt daraltma) `manual/` altındaki toplu dosyaya eklenir ve kullanıcıya verilir.
