-- ============================================================
-- DRIVO — Full Database Schema
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- USERS & AUTH
-- ============================================================

create table public.users (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  name text,
  email text,
  role text not null check (role in ('rider', 'driver', 'admin')),
  profile_picture text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- DRIVER ONBOARDING & KYC
-- ============================================================

create table public.driver_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'under_review', 'approved', 'suspended', 'rejected')),
  kyc_status text not null default 'pending' check (kyc_status in ('pending', 'submitted', 'approved', 'rejected')),
  aadhar_number text,
  pan_number text,
  driving_license text,
  license_expiry date,
  bank_account text,
  upi_id text,
  rating numeric(3,2) default 5.0,
  total_rides int not null default 0,
  is_online boolean not null default false,
  current_latitude numeric(10,7),
  current_longitude numeric(10,7),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.driver_profiles(id) on delete cascade,
  vehicle_type text not null check (vehicle_type in ('ev_auto', 'ev_car')),
  make text,
  model text,
  year int,
  registration_number text not null unique,
  is_ev boolean not null default true,
  is_verified boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- RIDES
-- ============================================================

create table public.rides (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.users(id),
  driver_id uuid references public.driver_profiles(id),
  vehicle_id uuid references public.vehicles(id),
  status text not null default 'requested' check (status in (
    'requested', 'accepted', 'active', 'completed', 'cancelled', 'expired'
  )),
  pickup_address text,
  pickup_latitude numeric(10,7),
  pickup_longitude numeric(10,7),
  destination_address text,
  destination_latitude numeric(10,7),
  destination_longitude numeric(10,7),
  estimated_fare numeric(10,2),
  final_fare numeric(10,2),
  distance_km numeric(8,2),
  duration_minutes int,
  cancellation_reason text,
  cancelled_by uuid references public.users(id),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ride_ratings (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null unique references public.rides(id),
  rider_id uuid not null references public.users(id),
  driver_id uuid not null references public.driver_profiles(id),
  rating int not null check (rating between 1 and 5),
  review text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- PAYMENTS & RECEIPTS
-- ============================================================

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id),
  rider_id uuid not null references public.users(id),
  driver_id uuid not null references public.driver_profiles(id),
  amount numeric(10,2) not null,
  method text not null check (method in ('upi', 'cash')),
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'flagged')),
  upi_reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.payments(id),
  ride_id uuid not null references public.rides(id),
  receipt_url text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- DRIVER SUBSCRIPTIONS
-- ============================================================

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name in ('basic', 'pro', 'elite')),
  price numeric(10,2) not null,
  duration_days int not null,
  benefits jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.driver_subscriptions (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.driver_profiles(id),
  plan_id uuid not null references public.subscription_plans(id),
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled', 'grace_period')),
  start_date date not null,
  expiry_date date not null,
  payment_id uuid references public.payments(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- PREFERRED DRIVERS
-- ============================================================

create table public.preferred_drivers (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.users(id),
  driver_id uuid not null references public.driver_profiles(id),
  status text not null default 'active' check (status in ('active', 'removed', 'blocked_by_driver')),
  saved_at timestamptz not null default now(),
  unique(rider_id, driver_id)
);

-- ============================================================
-- FAMILY ACCOUNTS & SCHEDULED RIDES
-- ============================================================

create table public.family_accounts (
  id uuid primary key default gen_random_uuid(),
  primary_user_id uuid not null references public.users(id),
  member_user_id uuid not null references public.users(id),
  status text not null default 'active' check (status in ('active', 'pending', 'removed')),
  created_at timestamptz not null default now(),
  unique(primary_user_id, member_user_id)
);

create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  name text not null,
  phone text not null,
  created_at timestamptz not null default now()
);

create table public.scheduled_rides (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.users(id),
  rider_id uuid not null references public.users(id),
  preferred_driver_id uuid references public.driver_profiles(id),
  pickup_address text,
  pickup_latitude numeric(10,7),
  pickup_longitude numeric(10,7),
  destination_address text,
  destination_latitude numeric(10,7),
  destination_longitude numeric(10,7),
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'dispatched', 'completed', 'cancelled')),
  ride_id uuid references public.rides(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- GO HOME MODE
-- ============================================================

create table public.go_home_sessions (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.driver_profiles(id),
  home_zone_latitude numeric(10,7),
  home_zone_longitude numeric(10,7),
  home_zone_radius_km numeric(5,2) default 3.0,
  preferred_route jsonb,
  end_time timestamptz,
  status text not null default 'active' check (status in ('active', 'completed', 'expired', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  category text not null check (category in (
    'ride_alert', 'payment', 'subscription', 'driver_request',
    'family', 'safety', 'advertising', 'system'
  )),
  title text not null,
  body text not null,
  data jsonb,
  is_read boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.sos_events (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id),
  triggered_by uuid not null references public.users(id),
  location_latitude numeric(10,7),
  location_longitude numeric(10,7),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ADVERTISING
-- ============================================================

create table public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  revenue_share_percent numeric(5,2),
  start_date date,
  end_date date,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create table public.driver_campaign_assignments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns(id),
  driver_id uuid not null references public.driver_profiles(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'completed', 'rejected')),
  earnings_credited numeric(10,2),
  assigned_at timestamptz not null default now(),
  unique(campaign_id, driver_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

create index on public.rides (rider_id);
create index on public.rides (driver_id);
create index on public.rides (status);
create index on public.driver_profiles (status);
create index on public.driver_profiles (is_online);
create index on public.notifications (user_id, is_read);
create index on public.driver_subscriptions (driver_id, status);
create index on public.scheduled_rides (scheduled_at, status);
create index on public.go_home_sessions (driver_id, status);

-- ============================================================
-- ROW LEVEL SECURITY (enable but open for now — tighten later)
-- ============================================================

alter table public.users enable row level security;
alter table public.driver_profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.rides enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;

-- Temporary open policies for development
create policy "dev_all_users" on public.users for all using (true);
create policy "dev_all_driver_profiles" on public.driver_profiles for all using (true);
create policy "dev_all_vehicles" on public.vehicles for all using (true);
create policy "dev_all_rides" on public.rides for all using (true);
create policy "dev_all_payments" on public.payments for all using (true);
create policy "dev_all_notifications" on public.notifications for all using (true);
