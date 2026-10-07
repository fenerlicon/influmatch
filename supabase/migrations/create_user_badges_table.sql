-- Create user_badges table to track which badges users have earned
CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  badge_id text NOT NULL, -- References badge id from app/badges/data.ts
  earned_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, badge_id)
);

-- Add displayed_badges column to users table (array of badge IDs to show on cards, max 3)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS displayed_badges text[] DEFAULT ARRAY[]::text[];

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON public.user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id ON public.user_badges(badge_id);

-- Enable RLS
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Users can view all badges (for profile pages)
DROP POLICY IF EXISTS "User badges are viewable by everyone" ON public.user_badges;
CREATE POLICY "User badges are viewable by everyone"
  ON public.user_badges
  FOR SELECT
  USING (true);

-- Users can only manage their own badges
DROP POLICY IF EXISTS "Users can insert their own badges" ON public.user_badges;
CREATE POLICY "Users can insert their own badges"
  ON public.user_badges
  FOR INSERT
  -- Canlıdaki gibi yalnızca admin: kullanıcı kendine rozet (ör. mavi tik) ekleyemez.
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP POLICY IF EXISTS "Users can delete their own badges" ON public.user_badges;
CREATE POLICY "Users can delete their own badges"
  ON public.user_badges
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add constraint to ensure displayed_badges array has max 3 items
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'displayed_badges_max_length') THEN
    ALTER TABLE public.users
    ADD CONSTRAINT displayed_badges_max_length
    CHECK (array_length(displayed_badges, 1) IS NULL OR array_length(displayed_badges, 1) <= 3);
  END IF;
END $$;

