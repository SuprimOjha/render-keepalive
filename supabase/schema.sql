-- RenderMonitor: run this file in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.monitors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  url text not null check (char_length(url) <= 2048),
  interval_minutes integer not null default 10 check (interval_minutes in (5, 10, 15, 30, 60)),
  is_active boolean not null default true,
  last_status text not null default 'pending' check (last_status in ('up', 'down', 'pending')),
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.monitor_checks (
  id bigint generated always as identity primary key,
  monitor_id uuid not null references public.monitors(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status_code integer,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  is_up boolean not null,
  error text,
  checked_at timestamptz not null default now()
);

create index if not exists monitors_user_created_idx on public.monitors(user_id, created_at desc);
create index if not exists monitor_checks_monitor_time_idx on public.monitor_checks(monitor_id, checked_at desc);
create index if not exists monitor_checks_user_time_idx on public.monitor_checks(user_id, checked_at desc);

alter table public.monitors enable row level security;
alter table public.monitor_checks enable row level security;

drop policy if exists "Owners can read monitors" on public.monitors;
create policy "Owners can read monitors" on public.monitors for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Owners can create monitors" on public.monitors;
create policy "Owners can create monitors" on public.monitors for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Owners can update monitors" on public.monitors;
create policy "Owners can update monitors" on public.monitors for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Owners can delete monitors" on public.monitors;
create policy "Owners can delete monitors" on public.monitors for delete to authenticated using (auth.uid() = user_id);
drop policy if exists "Owners can read checks" on public.monitor_checks;
create policy "Owners can read checks" on public.monitor_checks for select to authenticated using (auth.uid() = user_id);

-- The scheduler uses SUPABASE_SERVICE_ROLE_KEY server-side to insert checks and update monitor status.
-- Never expose the service-role key in NEXT_PUBLIC_* variables or commit it to Git.
