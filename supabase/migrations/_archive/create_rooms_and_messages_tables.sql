-- Create rooms table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  influencer_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  offer_id uuid REFERENCES public.offers(id) ON DELETE CASCADE,
  advert_application_id uuid REFERENCES public.advert_applications(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CHECK (
    (brand_id IS NOT NULL AND influencer_id IS NOT NULL) OR
    (offer_id IS NOT NULL) OR
    (advert_application_id IS NOT NULL)
  )
);

-- Enable RLS for rooms
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Users can view rooms they are part of
CREATE POLICY "Users can view their rooms"
  ON public.rooms
  FOR SELECT
  USING (
    auth.uid() = brand_id OR
    auth.uid() = influencer_id
  );

-- Users can insert rooms (but only if they are brand or influencer in that room)
CREATE POLICY "Users can insert rooms they are part of"
  ON public.rooms
  FOR INSERT
  WITH CHECK (
    auth.uid() = brand_id OR
    auth.uid() = influencer_id
  );

-- Create messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS for messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages in rooms they are part of
CREATE POLICY "Users can view messages in their rooms"
  ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rooms
      WHERE rooms.id = messages.room_id
      AND (rooms.brand_id = auth.uid() OR rooms.influencer_id = auth.uid())
    )
  );

-- Users can insert messages in rooms they are part of (and they must be the sender)
CREATE POLICY "Users can send messages in their rooms"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.rooms
      WHERE rooms.id = messages.room_id
      AND (rooms.brand_id = auth.uid() OR rooms.influencer_id = auth.uid())
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON public.messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_rooms_brand_id ON public.rooms(brand_id);
CREATE INDEX IF NOT EXISTS idx_rooms_influencer_id ON public.rooms(influencer_id);
CREATE INDEX IF NOT EXISTS idx_rooms_offer_id ON public.rooms(offer_id);
CREATE INDEX IF NOT EXISTS idx_rooms_advert_application_id ON public.rooms(advert_application_id);

