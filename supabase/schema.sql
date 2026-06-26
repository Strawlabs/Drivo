-- =============================================================
-- DRIVO — Core Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- =============================================================

-- Enable the UUID extension (Supabase has this on by default, but just in case)
create extension if not exists "uuid-ossp";


-- =============================================================
-- RIDERS
-- One row per rider. id must match the auth.users id.
-- =============================================================
create table if not exists public.riders (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  full_name    text not null,
  phone        text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Automatically update updated_at when a row changes
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger riders_updated_at
  before update on public.riders
  for each row execute function public.set_updated_at();


-- =============================================================
-- DRIVERS
-- One row per driver.
-- status: 'pending' (awaiting verification) | 'active' | 'suspended'
-- =============================================================
create table if not exists public.drivers (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  full_name    text not null,
  phone        text not null,
  license_no   text,
  status       text not null default 'pending'
                 check (status in ('pending', 'active', 'suspended')),
  avatar_url   text,
  is_online    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger drivers_updated_at
  before update on public.drivers
  for each row execute function public.set_updated_at();


-- =============================================================
-- VEHICLES
-- One vehicle per driver (can extend to many later)
-- type: 'two_wheeler' | 'three_wheeler' | 'four_wheeler'
-- =============================================================
create table if not exists public.vehicles (
  id            uuid primary key default gen_random_uuid(),
  driver_id     uuid not null references public.drivers(id) on delete cascade,
  make          text not null,        -- e.g. "Ather"
  model         text not null,        -- e.g. "450X"
  year          int,
  color         text,
  plate_number  text not null unique,
  vehicle_type  text not null default 'two_wheeler'
                  check (vehicle_type in ('two_wheeler', 'three_wheeler', 'four_wheeler')),
  is_ev         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger vehicles_updated_at
  before update on public.vehicles
  for each row execute function public.set_updated_at();


-- =============================================================
-- ROW LEVEL SECURITY (RLS)
-- ─────────────────────────
-- By default, Supabase tables are wide-open. RLS locks them down.
-- Rule: a logged-in user can only read/write their OWN row.
-- auth.uid() returns the ID of whoever made the API request.
-- =============================================================

-- ── Riders ──
alter table public.riders enable row level security;

-- A rider can read their own profile
create policy "Rider can read own profile"
  on public.riders for select
  using (auth.uid() = id);

-- A rider can insert their own profile (during registration)
create policy "Rider can create own profile"
  on public.riders for insert
  with check (auth.uid() = id);

-- A rider can update their own profile
create policy "Rider can update own profile"
  on public.riders for update
  using (auth.uid() = id)
  with check (auth.uid() = id);


-- ── Drivers ──
alter table public.drivers enable row level security;

create policy "Driver can read own profile"
  on public.drivers for select
  using (auth.uid() = id);

create policy "Driver can create own profile"
  on public.drivers for insert
  with check (auth.uid() = id);

create policy "Driver can update own profile"
  on public.drivers for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Riders can read driver profiles (needed to show driver info during a ride)
create policy "Riders can view driver profiles"
  on public.drivers for select
  using (auth.uid() in (select id from public.riders));


-- ── Vehicles ──
alter table public.vehicles enable row level security;

-- A driver can manage their own vehicle(s)
create policy "Driver can manage own vehicles"
  on public.vehicles for all
  using (auth.uid() = driver_id)
  with check (auth.uid() = driver_id);

-- Riders can read vehicle details (shown during ride)
create policy "Riders can view vehicles"
  on public.vehicles for select
  using (auth.uid() in (select id from public.riders));


-- =============================================================
-- ADMINS
-- Manually insert a row here to grant admin access to a user.
-- =============================================================
create table if not exists public.admins (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

create policy "Admins can read own record"
  on public.admins for select
  using (auth.uid() = id);


-- =============================================================
-- DONE! Check the Table Editor in your Supabase dashboard
-- to confirm riders, drivers, vehicles, and admins tables exist.
-- =============================================================


-- =============================================================
-- AUTH HELPER — check if an email is already registered
-- Callable by unauthenticated (anon) clients so the login page
-- can branch: existing user → sign-in OTP, new user → signup OTP
-- =============================================================
create or replace function public.check_email_exists(p_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users
    where lower(email) = lower(p_email)
      and deleted_at is null
  );
$$;

-- Allow unauthenticated callers (the login page is pre-auth)
grant execute on function public.check_email_exists(text) to anon;
