-- Ensure username column has a unique constraint
-- First, check if there are any duplicate usernames and handle them
DO $$
DECLARE
  duplicate_count integer;
BEGIN
  -- Count duplicate usernames (excluding NULL values)
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT username, COUNT(*) as cnt
    FROM public.users
    WHERE username IS NOT NULL
    GROUP BY username
    HAVING COUNT(*) > 1
  ) duplicates;

  -- If there are duplicates, we need to make them unique
  -- We'll append a number to make them unique
  IF duplicate_count > 0 THEN
    -- Update duplicate usernames by appending a number
    WITH numbered_duplicates AS (
      SELECT 
        id,
        username,
        ROW_NUMBER() OVER (PARTITION BY username ORDER BY created_at) as row_num
      FROM public.users
      WHERE username IS NOT NULL
        AND username IN (
          SELECT username
          FROM public.users
          WHERE username IS NOT NULL
          GROUP BY username
          HAVING COUNT(*) > 1
        )
    )
    UPDATE public.users u
    SET username = u.username || '_' || (nd.row_num - 1)::text
    FROM numbered_duplicates nd
    WHERE u.id = nd.id
      AND nd.row_num > 1;
  END IF;
END $$;

-- Drop existing unique constraint if it exists (by name or by column)
DO $$
BEGIN
  -- Try to drop constraint by name
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_username_key'
  ) THEN
    ALTER TABLE public.users DROP CONSTRAINT users_username_key;
  END IF;
  
  -- Try to drop constraint by column (if it's a unique index)
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'users' 
    AND indexname = 'users_username_key'
  ) THEN
    DROP INDEX IF EXISTS public.users_username_key;
  END IF;
END $$;

-- Add unique constraint on username (allowing NULL values)
-- PostgreSQL allows multiple NULL values in a unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique 
ON public.users(username) 
WHERE username IS NOT NULL;

-- Also add a check to ensure username is not empty string
ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_username_not_empty;

ALTER TABLE public.users
ADD CONSTRAINT users_username_not_empty
CHECK (username IS NULL OR LENGTH(TRIM(username)) > 0);

