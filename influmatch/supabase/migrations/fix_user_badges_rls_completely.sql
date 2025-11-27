-- Fix RLS policies for user_badges table to allow badge awarding
-- This migration ensures that the badge awarding system works properly
-- Creates the table if it doesn't exist, then sets up RLS policies

-- Create user_badges table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  badge_id text NOT NULL, -- References badge id from app/badges/data.ts
  earned_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, badge_id)
);

-- Add displayed_badges column to users table if it doesn't exist (array of badge IDs to show on cards, max 3)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'displayed_badges'
  ) THEN
    ALTER TABLE public.users
    ADD COLUMN displayed_badges text[] DEFAULT ARRAY[]::text[];
  END IF;
END $$;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON public.user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id ON public.user_badges(badge_id);

-- Enable RLS
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies on user_badges
DROP POLICY IF EXISTS "User badges are viewable by everyone" ON public.user_badges;
DROP POLICY IF EXISTS "User badges are viewable publicly" ON public.user_badges;
DROP POLICY IF EXISTS "Users can insert their own badges" ON public.user_badges;
DROP POLICY IF EXISTS "Admins can insert badges for any user" ON public.user_badges;
DROP POLICY IF EXISTS "Users can delete their own badges" ON public.user_badges;

-- Everyone can view badges (for profile pages)
CREATE POLICY "User badges are viewable by everyone"
  ON public.user_badges
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow public viewing as well (for profile pages that don't require auth)
CREATE POLICY "User badges are viewable publicly"
  ON public.user_badges
  FOR SELECT
  TO anon
  USING (true);

-- Users can insert their own badges (for manual operations if needed)
CREATE POLICY "Users can insert their own badges"
  ON public.user_badges
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins can insert badges for any user (for badge awarding system)
CREATE POLICY "Admins can insert badges for any user"
  ON public.user_badges
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.users 
      WHERE id = auth.uid() 
      AND (role = 'admin' OR email = 'admin@influmatch.net')
    )
  );

-- Users can delete their own badges
CREATE POLICY "Users can delete their own badges"
  ON public.user_badges
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Ensure the SQL function exists and has correct permissions
-- This function bypasses RLS using SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.award_user_badge(
  target_user_id uuid,
  badge_id_to_award text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if badge already exists
  IF NOT EXISTS (
    SELECT 1 
    FROM public.user_badges 
    WHERE user_id = target_user_id 
    AND badge_id = badge_id_to_award
  ) THEN
    -- Insert the badge (bypasses RLS due to SECURITY DEFINER)
    INSERT INTO public.user_badges (user_id, badge_id)
    VALUES (target_user_id, badge_id_to_award)
    ON CONFLICT (user_id, badge_id) DO NOTHING;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.award_user_badge(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_user_badge(uuid, text) TO anon;

-- Add constraint to ensure displayed_badges array has max 3 items (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'displayed_badges_max_length'
  ) THEN
    ALTER TABLE public.users
    ADD CONSTRAINT displayed_badges_max_length 
    CHECK (array_length(displayed_badges, 1) IS NULL OR array_length(displayed_badges, 1) <= 3);
  END IF;
END $$;

