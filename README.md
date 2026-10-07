# Influmatch - Doğrudan İşbirliği Platformu

Markalar ve Influencer/UGC üreticilerinin ajans olmadan doğrudan bir araya geldiği iki taraflı pazar yeri.

- Web: Next.js 14 (App Router, server actions), TypeScript, Tailwind CSS. Vercel'de yayında (influmatch.net).
- Veri: Supabase (Postgres + RLS, Auth, Storage, Realtime, pg_cron).
- Mobil: `mobile-app/` (Expo).

## Belgeler

- [docs/SETUP.md](./docs/SETUP.md): kurulum, ortam değişkenleri, Supabase, zamanlanmış işler, yayın
- [docs/SYSTEM_MAP.md](./docs/SYSTEM_MAP.md): numaralı sistem haritası ve açık sorunlar
- [docs/HANDOFF.md](./docs/HANDOFF.md): güncel durum ve verilen kararlar
- [CLAUDE.md](./CLAUDE.md): çalışma kuralları

## Hızlı başlangıç

```bash
npm ci
cp env.example .env.local
npm run dev
```

## Tasarım sistemi

- Arka plan: #0C0D10
- Vurgu rengi: Soft Gold (#D4AF37)
- Tema: Dark Premium
