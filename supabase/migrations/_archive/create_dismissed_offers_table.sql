-- Create dismissed_offers table to track which offers/influencers brands have dismissed
CREATE TABLE IF NOT EXISTS public.dismissed_offers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, receiver_user_id)
);

-- Enable RLS
ALTER TABLE public.dismissed_offers ENABLE ROW LEVEL SECURITY;

-- Users can manage their own dismissed offers
CREATE POLICY "Users can insert their own dismissed offers"
  ON public.dismissed_offers
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own dismissed offers"
  ON public.dismissed_offers
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dismissed offers"
  ON public.dismissed_offers
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_dismissed_offers_user_id ON public.dismissed_offers(user_id);
CREATE INDEX IF NOT EXISTS idx_dismissed_offers_receiver_user_id ON public.dismissed_offers(receiver_user_id);

