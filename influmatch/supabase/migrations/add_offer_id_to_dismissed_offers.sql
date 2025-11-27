-- Add offer_id column to dismissed_offers table to support influencer dismissing offers
ALTER TABLE public.dismissed_offers
ADD COLUMN IF NOT EXISTS offer_id uuid REFERENCES public.offers(id) ON DELETE CASCADE;

-- Make receiver_user_id nullable since influencers will use offer_id instead
ALTER TABLE public.dismissed_offers
ALTER COLUMN receiver_user_id DROP NOT NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_dismissed_offers_offer_id ON public.dismissed_offers(offer_id);

-- Update unique constraint to allow both receiver_user_id and offer_id patterns
-- First, drop the existing unique constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'dismissed_offers_user_id_receiver_user_id_key'
  ) THEN
    ALTER TABLE public.dismissed_offers
    DROP CONSTRAINT dismissed_offers_user_id_receiver_user_id_key;
  END IF;
END $$;

-- Add new unique constraint that allows either receiver_user_id or offer_id
-- We'll use a partial unique index approach
DROP INDEX IF EXISTS dismissed_offers_user_receiver_unique;
CREATE UNIQUE INDEX IF NOT EXISTS dismissed_offers_user_receiver_unique 
ON public.dismissed_offers(user_id, receiver_user_id) 
WHERE receiver_user_id IS NOT NULL;

DROP INDEX IF EXISTS dismissed_offers_user_offer_unique;
CREATE UNIQUE INDEX IF NOT EXISTS dismissed_offers_user_offer_unique 
ON public.dismissed_offers(user_id, offer_id) 
WHERE offer_id IS NOT NULL;

