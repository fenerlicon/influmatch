-- Create notifications table
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  title text not null,
  message text not null,
  type text check (type in ('system', 'info', 'warning', 'success')) default 'info',
  is_read boolean default false,
  link text,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.notifications enable row level security;

-- Policies
-- Policies
drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update their own notifications (mark as read)" on public.notifications;
create policy "Users can update their own notifications (mark as read)"
  on public.notifications for update
  using (auth.uid() = user_id);

-- Only admins can insert notifications (via service role or admin check if needed)
-- For now, we'll rely on server actions using service role or admin check logic
drop policy if exists "Admins can insert notifications" on public.notifications;
create policy "Admins can insert notifications"
  on public.notifications for insert
  with check (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );
