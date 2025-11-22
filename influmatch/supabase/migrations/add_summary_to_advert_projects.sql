-- Add missing columns to advert_projects table if they don't exist
-- This migration ensures all required columns exist in the advert_projects table

DO $$ 
BEGIN
    -- Check if brand_id exists, if so use it, otherwise create brand_user_id
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' 
               AND table_name = 'advert_projects' 
               AND column_name = 'brand_id') THEN
        -- brand_id already exists, ensure it has foreign key
        IF EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_schema = 'public' AND table_name = 'users') THEN
            IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                           WHERE constraint_schema = 'public' 
                           AND table_name = 'advert_projects' 
                           AND constraint_name = 'advert_projects_brand_id_fkey') THEN
                ALTER TABLE public.advert_projects 
                ADD CONSTRAINT advert_projects_brand_id_fkey 
                FOREIGN KEY (brand_id) REFERENCES public.users(id) ON DELETE CASCADE;
            END IF;
        END IF;
    ELSE
        -- Add brand_user_id column (foreign key to users table)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_schema = 'public' 
                       AND table_name = 'advert_projects' 
                       AND column_name = 'brand_user_id') THEN
            ALTER TABLE public.advert_projects ADD COLUMN brand_user_id uuid NOT NULL;
            -- Add foreign key constraint if users table exists and constraint doesn't exist
            IF EXISTS (SELECT 1 FROM information_schema.tables 
                       WHERE table_schema = 'public' AND table_name = 'users') THEN
                IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                               WHERE constraint_schema = 'public' 
                               AND table_name = 'advert_projects' 
                               AND constraint_name = 'advert_projects_brand_user_id_fkey') THEN
                    ALTER TABLE public.advert_projects 
                    ADD CONSTRAINT advert_projects_brand_user_id_fkey 
                    FOREIGN KEY (brand_user_id) REFERENCES public.users(id) ON DELETE CASCADE;
                END IF;
            END IF;
        END IF;
    END IF;

    -- Add title column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'advert_projects' 
                   AND column_name = 'title') THEN
        ALTER TABLE public.advert_projects ADD COLUMN title text;
    END IF;

    -- Add summary column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'advert_projects' 
                   AND column_name = 'summary') THEN
        ALTER TABLE public.advert_projects ADD COLUMN summary text;
    END IF;

    -- Add description column (some tables use this instead of summary)
    -- Check if it exists and if it's NOT NULL, if so we need to handle existing rows
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'advert_projects' 
                   AND column_name = 'description') THEN
        -- First add as nullable
        ALTER TABLE public.advert_projects ADD COLUMN description text;
        -- Update existing rows with empty string
        UPDATE public.advert_projects SET description = '' WHERE description IS NULL;
        -- Then make it NOT NULL if needed (uncomment if required)
        -- ALTER TABLE public.advert_projects ALTER COLUMN description SET NOT NULL;
        -- ALTER TABLE public.advert_projects ALTER COLUMN description SET DEFAULT '';
    END IF;

    -- Add category column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'advert_projects' 
                   AND column_name = 'category') THEN
        ALTER TABLE public.advert_projects ADD COLUMN category text;
    END IF;

    -- Add brand_name column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'advert_projects' 
                   AND column_name = 'brand_name') THEN
        ALTER TABLE public.advert_projects ADD COLUMN brand_name text;
    END IF;

    -- Add platforms column (array)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'advert_projects' 
                   AND column_name = 'platforms') THEN
        ALTER TABLE public.advert_projects ADD COLUMN platforms text[] DEFAULT array[]::text[];
    END IF;

    -- Add deliverables column (array)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'advert_projects' 
                   AND column_name = 'deliverables') THEN
        ALTER TABLE public.advert_projects ADD COLUMN deliverables text[] DEFAULT array[]::text[];
    END IF;

    -- Add budget_currency column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'advert_projects' 
                   AND column_name = 'budget_currency') THEN
        ALTER TABLE public.advert_projects ADD COLUMN budget_currency text DEFAULT 'TRY';
    END IF;

    -- Add budget_min column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'advert_projects' 
                   AND column_name = 'budget_min') THEN
        ALTER TABLE public.advert_projects ADD COLUMN budget_min numeric(12,2);
    END IF;

    -- Add budget_max column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'advert_projects' 
                   AND column_name = 'budget_max') THEN
        ALTER TABLE public.advert_projects ADD COLUMN budget_max numeric(12,2);
    END IF;

    -- Add location column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'advert_projects' 
                   AND column_name = 'location') THEN
        ALTER TABLE public.advert_projects ADD COLUMN location text;
    END IF;

    -- Add hero_image column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'advert_projects' 
                   AND column_name = 'hero_image') THEN
        ALTER TABLE public.advert_projects ADD COLUMN hero_image text;
    END IF;

    -- Add deadline column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'advert_projects' 
                   AND column_name = 'deadline') THEN
        ALTER TABLE public.advert_projects ADD COLUMN deadline date;
    END IF;

    -- Add status column with check constraint
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'advert_projects' 
                   AND column_name = 'status') THEN
        ALTER TABLE public.advert_projects ADD COLUMN status text DEFAULT 'open';
        -- Add check constraint if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                       WHERE constraint_schema = 'public' 
                       AND table_name = 'advert_projects' 
                       AND constraint_name = 'advert_projects_status_check') THEN
            ALTER TABLE public.advert_projects ADD CONSTRAINT advert_projects_status_check 
                CHECK (status IN ('open', 'paused', 'closed'));
        END IF;
    END IF;

    -- Add created_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'advert_projects' 
                   AND column_name = 'created_at') THEN
        ALTER TABLE public.advert_projects ADD COLUMN created_at timestamptz DEFAULT timezone('utc'::text, now());
    END IF;

END $$;

