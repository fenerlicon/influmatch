-- Create social_account_history table to track changes over time
create table if not exists social_account_history (
  id uuid default gen_random_uuid() primary key,
  social_account_id uuid references social_accounts(id) on delete cascade not null,
  follower_count bigint,
  engagement_rate numeric,
  avg_likes bigint,
  avg_comments bigint,
  avg_views bigint,
  recorded_at timestamptz default now()
);

-- Enable RLS
alter table social_account_history enable row level security;

-- Policies
-- Users can view their own history
create policy "Users can view their own history" on social_account_history
  for select using (auth.uid() in (
    select user_id from social_accounts where id = social_account_history.social_account_id
  ));

-- Admins can view all history
create policy "Admins can view all history" on social_account_history
  for select using (
    exists (
      select 1 from users
      where users.id = auth.uid() and users.role = 'admin'
    )
  );

-- Admins can insert history
create policy "Admins can insert history" on social_account_history
  for insert with check (
    exists (
      select 1 from users
      where users.id = auth.uid() and users.role = 'admin'
    )
  );

-- Users can insert their own history
create policy "Users can insert their own history" on social_account_history
  for insert with check (
    auth.uid() in (
      select user_id from social_accounts where id = social_account_history.social_account_id
    )
  );
