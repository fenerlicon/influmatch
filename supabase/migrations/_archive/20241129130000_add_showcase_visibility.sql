-- Add is_showcase_visible column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_showcase_visible BOOLEAN DEFAULT true;

-- Update existing users to have is_showcase_visible = true (or copy from spotlight_active if desired, but default true is safer for visibility)
UPDATE public.users SET is_showcase_visible = true WHERE is_showcase_visible IS NULL;
