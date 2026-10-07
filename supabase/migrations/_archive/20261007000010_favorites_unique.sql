-- Bir marka aynı influencer'ı favorilere yalnızca bir kez ekleyebilir (3.3-S1).
-- Canlıda tekrar eden satır yok (2026-10-07 kontrol edildi). Listeler ayrı tabloda
-- (favorite_list_items) tutulduğu için favorites.list_id bu kısıtı etkilemiyor.
CREATE UNIQUE INDEX IF NOT EXISTS favorites_brand_influencer_unique
  ON public.favorites (brand_id, influencer_id);
