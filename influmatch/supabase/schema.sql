-- ============================================================
-- Influmatch Supabase Schema
-- ============================================================

-- Enable extensions if needed (Supabase usually has these)
create extension if not exists "uuid-ossp";

-- ============================================================
-- USERS TABLE
-- ============================================================
create table if not exists public.users (
  id uuid primary key default uuid_generate_v4(),
  role text check (role in ('influencer', 'brand')),
  email text not null,
  full_name text,
  username text unique,
  avatar_url text,
  bio text,
  category text,
  city text,
  social_links jsonb default '{}'::jsonb,
  spotlight_active boolean default false,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.users enable row level security;

-- Everyone can read profiles
create policy "Profiles are viewable by everyone"
  on public.users
  for select
  using (true);

-- Users can update only their own profile
create policy "Users can update their own profile"
  on public.users
  for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.users
  for insert
  with check (auth.uid() = id);

-- ============================================================
-- TRIGGER: SYNC AUTH USERS -> PUBLIC.USERS
-- ============================================================
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, role, full_name, username, created_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'influencer'),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'username',
    timezone('utc', now())
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_auth_user();

-- ============================================================
-- OFFERS TABLE
-- ============================================================
create table if not exists public.offers (
  id uuid primary key default uuid_generate_v4(),
  sender_user_id uuid not null references public.users(id) on delete cascade,
  receiver_user_id uuid not null references public.users(id) on delete cascade,
  campaign_name text,
  message text,
  budget numeric(12,2),
  campaign_type text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.offers enable row level security;

-- Brands (senders) can manage their own outgoing offers
create policy "Brands can view their sent offers"
  on public.offers
  for select
  using (auth.uid() = sender_user_id);

create policy "Brands can insert offers they send"
  on public.offers
  for insert
  with check (auth.uid() = sender_user_id);

create policy "Brands can update their sent offers"
  on public.offers
  for update
  using (auth.uid() = sender_user_id);

-- Influencers (receivers) can read offers sent to them
create policy "Influencers can view offers sent to them"
  on public.offers
  for select
  using (auth.uid() = receiver_user_id);

-- Optionally allow influencers to update status when they are receivers
create policy "Influencers can update offers addressed to them"
  on public.offers
  for update
  using (auth.uid() = receiver_user_id)
  with check (auth.uid() = receiver_user_id);

-- ============================================================
-- ADVERT PROJECTS TABLE
-- ============================================================
create table if not exists public.advert_projects (
  id uuid primary key default uuid_generate_v4(),
  brand_user_id uuid not null references public.users(id) on delete cascade,
  brand_name text,
  title text not null,
  summary text,
  category text,
  platforms text[] default array[]::text[],
  deliverables text[] default array[]::text[],
  budget_currency text default 'TRY',
  budget_min numeric(12,2),
  budget_max numeric(12,2),
  location text,
  hero_image text,
  deadline date,
  status text not null default 'open' check (status in ('open', 'paused', 'closed')),
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.advert_projects enable row level security;

create policy "Everyone can view open adverts or own drafts"
  on public.advert_projects
  for select
  using (status = 'open' or auth.uid() = brand_user_id);

create policy "Brands can manage their adverts"
  on public.advert_projects
  for all
  using (auth.uid() = brand_user_id)
  with check (auth.uid() = brand_user_id);

-- ============================================================
-- ADVERT APPLICATIONS TABLE
-- ============================================================
create table if not exists public.advert_applications (
  id uuid primary key default uuid_generate_v4(),
  advert_id uuid not null references public.advert_projects(id) on delete cascade,
  influencer_user_id uuid not null references public.users(id) on delete cascade,
  cover_letter text,
  deliverable_idea text,
  budget_expectation numeric(12,2),
  status text not null default 'pending' check (status in ('pending', 'shortlisted', 'rejected', 'accepted')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (advert_id, influencer_user_id)
);

alter table public.advert_applications enable row level security;

create policy "Influencers manage their applications"
  on public.advert_applications
  for all
  using (auth.uid() = influencer_user_id)
  with check (auth.uid() = influencer_user_id);

create policy "Brands view applications to their adverts"
  on public.advert_applications
  for select
  using (exists (
    select 1
    from public.advert_projects ap
    where ap.id = advert_id and ap.brand_user_id = auth.uid()
  ));

