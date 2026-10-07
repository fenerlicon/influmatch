-- Drop the constraint if it exists with a different name or state
ALTER TABLE public.social_accounts DROP CONSTRAINT IF EXISTS social_accounts_user_id_platform_key;

-- Add the unique constraint required for ON CONFLICT upserts
ALTER TABLE public.social_accounts 
ADD CONSTRAINT social_accounts_user_id_platform_key UNIQUE (user_id, platform);

-- Reload schema cache to be sure
NOTIFY pgrst, 'reload config';
