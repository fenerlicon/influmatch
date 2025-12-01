-- Add stats_payload column to social_accounts if it doesn't exist
alter table public.social_accounts 
add column if not exists stats_payload jsonb default '{}'::jsonb;
