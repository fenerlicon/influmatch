-- Drop the constraint limiting spotlight_plan values so we can use 'plus', 'elite', etc.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_spotlight_plan_check;
