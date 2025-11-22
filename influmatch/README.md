# Influmatch - Doğrudan İşbirliği Platformu

Markalar ve Influencer'ların ajans olmadan doğrudan bir araya geldiği iki taraflı pazar yeri.

## Teknolojiler

- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Supabase (PostgreSQL)

## Kurulum

```bash
npm install
npm run dev
```

Proje [http://localhost:3000](http://localhost:3000) adresinde çalışacaktır.

## Çevre Değişkenleri

Supabase istemcisinin çalışabilmesi için `.env.local` dosyasında aşağıdaki değişkenlerin tanımlı olması gerekir. `env.example` dosyasını kopyalayarak başlayabilirsiniz:

```bash
cp env.example .env.local   # Windows PowerShell: copy env.example .env.local
```

Ardından Supabase projenizdeki `Project URL` değerini `NEXT_PUBLIC_SUPABASE_URL` değişkenine, `anon public` anahtarını da `NEXT_PUBLIC_SUPABASE_ANON_KEY` değişkenine yazın.

## Proje Yapısı

```
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Landing page
│   └── globals.css         # Global styles
├── components/
│   └── landing/
│       ├── Hero.tsx        # Hero section
│       ├── Spotlight.tsx   # Featured influencers
│       └── ValueProposition.tsx  # Value cards
└── package.json
```

## Tasarım Sistemi

- **Arka Plan:** #0C0D10
- **Vurgu Rengi:** Soft Gold (#D4AF37)
- **Tema:** Dark Premium

## 🚀 Deployment

Production'a deploy etmek için detaylı talimatlar için [DEPLOYMENT.md](./DEPLOYMENT.md) dosyasına bakın.

### Hızlı Başlangıç (Vercel)

1. Vercel hesabınıza giriş yapın
2. GitHub repository'nizi import edin
3. Environment variables'ları ekleyin:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (opsiyonel)
4. Supabase migrations'ları production database'e uygulayın
5. Deploy!

Daha fazla bilgi için [DEPLOYMENT.md](./DEPLOYMENT.md) dosyasını okuyun.

