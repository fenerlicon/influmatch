-- Migration to update spotlight_plan_enum to new values
-- 1. Alter column back to text to drop dependency on enum
ALTER TABLE public.users 
    ALTER COLUMN spotlight_plan TYPE text;

-- 2. Update existing values to map to new scheme (if any exist)
-- Mapping: 'plus' (common basic) -> 'ibasic' if influencer / 'mbasic' if brand? cannot distinguish easily in SQL update without join or role check.
-- Assuming user handles data fix or data is empty. 
-- Let's just nullify old values that don't match strict new types to be safe, or map loosely.
-- Since this is 'clean start', we can just reset invalid ones or update manually.
-- For safety, let's map 'plus' -> 'ibasic', 'elite' -> 'ipro', 'pro'->'mpro'. This is a best guess for migration.
UPDATE public.users SET spotlight_plan = 'ibasic' WHERE spotlight_plan = 'plus';
UPDATE public.users SET spotlight_plan = 'ipro' WHERE spotlight_plan = 'elite';
UPDATE public.users SET spotlight_plan = 'mpro' WHERE spotlight_plan = 'pro';
UPDATE public.users SET spotlight_plan = 'ibasic' WHERE spotlight_plan = 'basic'; 

-- 3. Drop old type
DROP TYPE IF EXISTS public.spotlight_plan_enum;

-- 4. Create new type
CREATE TYPE public.spotlight_plan_enum AS ENUM ('ibasic', 'mbasic', 'ipro', 'mpro');

-- 5. Convert column back to enum
ALTER TABLE public.users 
    ALTER COLUMN spotlight_plan TYPE public.spotlight_plan_enum 
    USING spotlight_plan::public.spotlight_plan_enum;
