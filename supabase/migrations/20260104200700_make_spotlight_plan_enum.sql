-- Create the custom ENUM type with the desired options
-- This enables a dropdown in the Supabase Table Editor
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'spotlight_plan_enum') THEN
        CREATE TYPE public.spotlight_plan_enum AS ENUM ('basic', 'plus', 'pro', 'elite');
    END IF;
END $$;

-- Alter the users table to use this ENUM type
-- This command converts the existing text column to the dropdown (enum) type
ALTER TABLE public.users 
    ALTER COLUMN spotlight_plan TYPE public.spotlight_plan_enum 
    USING spotlight_plan::public.spotlight_plan_enum;
