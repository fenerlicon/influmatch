-- Create analytics_events table
create table if not exists public.analytics_events (
  id uuid primary key default uuid_generate_v4(),
  event_type text not null, -- 'view_advert', 'click_profile', 'view_profile'
  target_id uuid not null, -- ID of the item being interacted with (advert_id, user_id)
  actor_id uuid references public.users(id) on delete set null, -- Who performed the action
  brand_id uuid references public.users(id) on delete cascade, -- Who owns the target (for easier querying by brands)
  meta jsonb default '{}'::jsonb, -- Extra data (e.g. source, device)
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- Enable RLS
alter table public.analytics_events enable row level security;

-- Policies

-- Brands can view analytics for their own content
create policy "Brands can view own analytics"
  on public.analytics_events
  for select
  using (auth.uid() = brand_id);

-- Anyone (authenticated) can insert events (tracking)
-- We might want to restrict this to server-side only actions if possible, 
-- but for client-side tracking we need insert permission or use a security definer function.
-- Let's use a security definer function for safer tracking and allow insert for now.
create policy "Authenticated users can insert events"
  on public.analytics_events
  for insert
  with check (auth.role() = 'authenticated');
  
-- Create a helper function to easily track events from RLS-protected client contexts if needed,
-- or just for cleaner API.
create or replace function public.track_analytics_event(
  p_event_type text,
  p_target_id uuid,
  p_brand_id uuid,
  p_meta jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_id uuid;
begin
  insert into public.analytics_events (event_type, target_id, actor_id, brand_id, meta)
  values (p_event_type, p_target_id, auth.uid(), p_brand_id, p_meta)
  returning id into v_id;
  
  return v_id;
end;
$$;
