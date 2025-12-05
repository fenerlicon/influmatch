-- Create favorites table
CREATE TABLE IF NOT EXISTS public.favorites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    brand_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    influencer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(brand_id, influencer_id)
);

-- Enable RLS
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Policies

-- Brand can see their own favorites
CREATE POLICY "Brands can view their own favorites"
ON public.favorites FOR SELECT
USING (auth.uid() = brand_id);

-- Brand can add favorites
CREATE POLICY "Brands can add favorites"
ON public.favorites FOR INSERT
WITH CHECK (auth.uid() = brand_id);

-- Brand can remove favorites
CREATE POLICY "Brands can remove their own favorites"
ON public.favorites FOR DELETE
USING (auth.uid() = brand_id);

-- Influencers can view who favorited them (for counting)
-- Note: Depending on privacy, maybe we only allow counting via a secure view or function, 
-- but RLS allowing select is simplest for "count(*)" queries if the user has permission to see the table.
-- The prompt says "Sizi Favorileyen Marka Sayısı", so they need to count.
CREATE POLICY "Influencers can view favorites targeting them"
ON public.favorites FOR SELECT
USING (auth.uid() = influencer_id);
