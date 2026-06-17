-- Add creator_type column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS creator_type text CHECK (creator_type IN ('influencer', 'ugc', 'both')) DEFAULT 'influencer';
