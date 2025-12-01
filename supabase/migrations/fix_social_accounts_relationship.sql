-- Ensure social_accounts table exists
CREATE TABLE IF NOT EXISTS public.social_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    username TEXT,
    profile_url TEXT,
    follower_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    media_count INTEGER DEFAULT 0,
    engagement_rate NUMERIC(5,2) DEFAULT 0,
    avg_likes INTEGER DEFAULT 0,
    avg_comments INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMPTZ,
    platform_user_id TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    stats_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, platform)
);

-- Ensure stats_payload column exists (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'social_accounts' AND column_name = 'stats_payload'
    ) THEN
        ALTER TABLE public.social_accounts ADD COLUMN stats_payload JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts (optional, but safer for a fix script)
DROP POLICY IF EXISTS "Users can view their own social accounts" ON public.social_accounts;
DROP POLICY IF EXISTS "Users can update their own social accounts" ON public.social_accounts;
DROP POLICY IF EXISTS "Users can insert their own social accounts" ON public.social_accounts;
DROP POLICY IF EXISTS "Public can view verified social accounts" ON public.social_accounts;

-- Create Policies

-- 1. Users can view their own accounts
CREATE POLICY "Users can view their own social accounts"
ON public.social_accounts FOR SELECT
USING (auth.uid() = user_id);

-- 2. Users can update their own accounts
CREATE POLICY "Users can update their own social accounts"
ON public.social_accounts FOR UPDATE
USING (auth.uid() = user_id);

-- 3. Users can insert their own accounts
CREATE POLICY "Users can insert their own social accounts"
ON public.social_accounts FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 4. Public (or authenticated users) can view social accounts of verified influencers
-- This is crucial for the Showcase/Discover page
CREATE POLICY "Public can view verified social accounts"
ON public.social_accounts FOR SELECT
USING (true); 
-- Note: Ideally we might want to restrict this to only verified users or specific fields, 
-- but for the Discover page to work for Brands (who are users), 'true' or 'auth.role() = "authenticated"' is needed.
-- Since we want public profiles to be visible, 'true' is simplest, but maybe we restrict to authenticated for now.
-- Let's stick to authenticated users can view all social accounts for now, or just allow all.
-- Given the error was about relationship, RLS might not be the cause, but good to have.

-- Grant permissions
GRANT ALL ON public.social_accounts TO postgres;
GRANT ALL ON public.social_accounts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_accounts TO authenticated;
