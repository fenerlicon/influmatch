-- Create user_blocks table for blocking users
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocker_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(blocker_user_id, blocked_user_id),
  CHECK (blocker_user_id != blocked_user_id)
);

-- Enable RLS
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

-- Users can block other users
CREATE POLICY "Users can block other users"
  ON public.user_blocks
  FOR ALL
  USING (auth.uid() = blocker_user_id)
  WITH CHECK (auth.uid() = blocker_user_id);

-- Users can view their own blocks
CREATE POLICY "Users can view their own blocks"
  ON public.user_blocks
  FOR SELECT
  USING (auth.uid() = blocker_user_id OR auth.uid() = blocked_user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker_user_id ON public.user_blocks(blocker_user_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_user_id ON public.user_blocks(blocked_user_id);

