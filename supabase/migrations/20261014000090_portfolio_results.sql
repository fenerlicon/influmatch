-- Portfoyde is birligi sonuclari (SYSTEM_MAP 4.3-S7, 3.20-N6): Influencer Pro profilinde tamamlanan is birliklerinin olcumleri.
-- Iki kucuk ayar tablosu; okuma ve yazma yalnizca sunucu kodundan (lib/portfolio-results.ts, service role).
-- Istemci rollerine hicbir yetki verilmez (politika yok, SELECT dahil kapali).
-- Eklemeli degisiklik: yeni iki tablo.

-- 1) Influencerin portfoyunden gizledigi is birlikleri (is birligi basina bir satir)
CREATE TABLE IF NOT EXISTS public.portfolio_hidden_items (
  collaboration_id uuid PRIMARY KEY REFERENCES public.collaborations(id) ON DELETE CASCADE,
  influencer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  hidden_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_portfolio_hidden_items_influencer ON public.portfolio_hidden_items USING btree (influencer_id);
ALTER TABLE public.portfolio_hidden_items ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.portfolio_hidden_items FROM anon, authenticated;

-- 2) Marka tercihi: is birligi sonuclarinda markanin adi gorunsun mu (varsayilan HAYIR; satir yoksa da hayir)
CREATE TABLE IF NOT EXISTS public.brand_portfolio_settings (
  brand_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  show_name boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.brand_portfolio_settings ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.brand_portfolio_settings FROM anon, authenticated;
