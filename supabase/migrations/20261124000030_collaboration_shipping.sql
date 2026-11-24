-- Barter teslimat adresi (kullanici karari 2026-11-24): barter is birliklerinde influencer urunun gonderilecegi adresi girer.
-- Marka adresi yalnizca anlasma ozeti iki tarafca onaylandiktan sonra gorur. Tablo istemcilere tamamen kapali; okuma / yazma
-- sunucuda (lib/collaboration-shipping.ts, service role), taraf + kural kontrolunden sonra. Yeni tablo (risksiz, kural 4).
CREATE TABLE IF NOT EXISTS public.collaboration_shipping (
  collaboration_id uuid PRIMARY KEY REFERENCES public.collaborations(id) ON DELETE CASCADE,
  influencer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_name text NOT NULL CHECK (char_length(recipient_name) BETWEEN 2 AND 120),
  phone text NOT NULL CHECK (phone ~ '^\+[1-9][0-9]{7,14}$'),
  address_line text NOT NULL CHECK (char_length(address_line) BETWEEN 5 AND 300),
  district text NOT NULL CHECK (char_length(district) BETWEEN 2 AND 80),
  city text NOT NULL CHECK (char_length(city) BETWEEN 2 AND 80),
  postal_code text CHECK (postal_code IS NULL OR postal_code ~ '^[0-9]{5}$'),
  note text CHECK (note IS NULL OR char_length(note) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_collaboration_shipping_influencer ON public.collaboration_shipping (influencer_id, updated_at DESC);
ALTER TABLE public.collaboration_shipping ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.collaboration_shipping FROM anon, authenticated;
