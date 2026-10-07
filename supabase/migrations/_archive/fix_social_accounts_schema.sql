-- Add updated_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'social_accounts' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.social_accounts ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Force schema cache reload by notifying pgrst (standard Supabase trick)
NOTIFY pgrst, 'reload config';
