-- Update RLS policy for messages to check blocking status
-- Drop existing policy
DROP POLICY IF EXISTS "Users can send messages in their rooms" ON public.messages;

-- Create new policy that checks blocking
CREATE POLICY "Users can send messages in their rooms"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.rooms
      WHERE rooms.id = messages.room_id
      AND (rooms.brand_id = auth.uid() OR rooms.influencer_id = auth.uid())
      -- Check that the recipient hasn't blocked the sender
      AND NOT EXISTS (
        SELECT 1 FROM public.user_blocks
        WHERE (
          -- Check if recipient (brand) blocked sender
          (rooms.brand_id = user_blocks.blocker_user_id AND auth.uid() = user_blocks.blocked_user_id)
          OR
          -- Check if recipient (influencer) blocked sender
          (rooms.influencer_id = user_blocks.blocker_user_id AND auth.uid() = user_blocks.blocked_user_id)
        )
      )
      -- Also check that sender hasn't blocked the recipient
      AND NOT EXISTS (
        SELECT 1 FROM public.user_blocks
        WHERE (
          -- Check if sender blocked recipient (brand)
          (auth.uid() = user_blocks.blocker_user_id AND rooms.brand_id = user_blocks.blocked_user_id)
          OR
          -- Check if sender blocked recipient (influencer)
          (auth.uid() = user_blocks.blocker_user_id AND rooms.influencer_id = user_blocks.blocked_user_id)
        )
      )
    )
  );

