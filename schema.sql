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

-- ============================================================
-- REALTIME
-- Ride lifecycle (request/accept/track) depends on Supabase
-- realtime broadcasting changes on `rides` — without this, no
-- postgres_changes subscription ever fires.
-- ============================================================

alter publication supabase_realtime add table public.rides;
alter publication supabase_realtime add table public.payments;
alter publication supabase_realtime add table public.driver_profiles;

-- ============================================================
-- STORAGE — receipts bucket
-- The `receipts` bucket is created (public) via the Storage API,
-- but storage.objects still needs an explicit policy before any
-- client (anon/authenticated) can upload into it.
-- ============================================================

create policy "dev_all_receipts_objects"
  on storage.objects for all
  using (bucket_id = 'receipts')
  with check (bucket_id = 'receipts');

-- ============================================================
-- PAYMENTS TASK — ride_ratings and receipts tables came out of
-- schema.sql with RLS enabled (this project's default for new
-- tables) but were never given a policy, so every insert was
-- silently rejected. Match the existing open dev-policy pattern.
-- ============================================================

create policy "dev_all_ride_ratings" on public.ride_ratings for all using (true);
create policy "dev_all_receipts" on public.receipts for all using (true);

-- ============================================================
-- DRIVER DASHBOARD TASK — same recurring gap: preferred_drivers,
-- subscription_plans, driver_subscriptions, ad_campaigns, and
-- driver_campaign_assignments all have RLS enabled with zero
-- policies, silently blocking both reads and writes. Confirmed via
-- direct REST calls (insert -> 42501, select -> empty with no error).
-- ============================================================

create policy "dev_all_preferred_drivers" on public.preferred_drivers for all using (true);
create policy "dev_all_subscription_plans" on public.subscription_plans for all using (true);
create policy "dev_all_driver_subscriptions" on public.driver_subscriptions for all using (true);
create policy "dev_all_ad_campaigns" on public.ad_campaigns for all using (true);
create policy "dev_all_driver_campaign_assignments" on public.driver_campaign_assignments for all using (true);

create index if not exists payments_driver_status_idx on public.payments (driver_id, status);

-- ============================================================
-- GO HOME MODE TASK — same recurring gap, go_home_sessions.
-- ============================================================

create policy "dev_all_go_home_sessions" on public.go_home_sessions for all using (true);

-- ============================================================
-- PREFERRED DRIVERS TASK
--
-- There is no rider-subscription table/system in this schema at all
-- (subscription_plans/driver_subscriptions are driver-side Drivo+
-- tiers only) — "Rider Subscription Eligibility" is a separate,
-- not-yet-built dependency. Rather than skip the eligibility gate
-- required by this task's acceptance criteria, adds a minimal
-- users.subscription_tier column so "save a preferred driver" can be
-- genuinely enforced server-side (not just a UI if-statement) ahead
-- of the real subscription/billing system.
--
-- Also widens preferred_drivers.status to include 'pending' so a
-- driver can actually "approve" a preferred-rider relationship
-- (previously it went straight to 'active' with no approval step).
-- ============================================================

alter table public.users
  add column if not exists subscription_tier text not null default 'none'
    check (subscription_tier in ('none', 'care', 'family'));

alter table public.preferred_drivers drop constraint if exists preferred_drivers_status_check;
alter table public.preferred_drivers
  add constraint preferred_drivers_status_check
    check (status in ('pending', 'active', 'removed', 'blocked_by_driver'));
alter table public.preferred_drivers alter column status set default 'pending';

drop policy if exists "dev_all_preferred_drivers" on public.preferred_drivers;

-- Reading isn't the sensitive operation here — both sides need to see
-- these rows (rider's saved list, driver's preferred-rider list).
create policy "preferred_drivers_select_all"
  on public.preferred_drivers for select
  using (true);

-- The actual eligibility gate the task asks for: a rider can only
-- create a preferred-driver row for themselves, and only if their
-- subscription_tier is Care or Family.
create policy "preferred_drivers_insert_eligible"
  on public.preferred_drivers for insert
  with check (
    auth.uid() = rider_id
    and exists (
      select 1 from public.users
      where id = auth.uid() and subscription_tier in ('care', 'family')
    )
  );

-- Either party can update a row that involves them, but a rider can
-- only move their own row to 'removed' (cancel) — they can't
-- self-approve straight to 'active', bypassing the driver's approval.
-- The driver can set any status (approve/decline/block).
create policy "preferred_drivers_update_own"
  on public.preferred_drivers for update
  using (
    auth.uid() = rider_id
    or auth.uid() in (select user_id from public.driver_profiles where id = driver_id)
  )
  with check (
    (auth.uid() = rider_id and status = 'removed')
    or auth.uid() in (select user_id from public.driver_profiles where id = driver_id)
  );

-- ============================================================
-- FAMILY RIDES TASK
--
-- family_accounts / emergency_contacts / scheduled_rides had RLS
-- disabled entirely (fully open by default) since they were first
-- created — same recurring gap as every other new table in this
-- project. Given this task's own acceptance criteria explicitly call
-- out "unauthorized access ... handled safely," and following the
-- real-RLS precedent set for preferred_drivers, these get genuine
-- owner/member-scoped policies rather than a wide-open dev policy.
--
-- Scope decision: Family Dashboard is rider-only (see conversation) —
-- a "family member" must be an existing rider account looked up by
-- phone, added as 'pending' by the owner, then approved by the member
-- themselves (mirrors the preferred_drivers pending->approve shape).
-- ============================================================

alter table public.scheduled_rides add column if not exists cancellation_reason text;

alter table public.family_accounts enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.scheduled_rides enable row level security;

-- Both the owner and the invited member need to see a family_accounts
-- row — the owner to manage their family list, the member to see and
-- respond to a pending invite directed at them.
create policy "family_accounts_select_involved"
  on public.family_accounts for select
  using (auth.uid() = primary_user_id or auth.uid() = member_user_id);

-- Only the owner can create the invite, and only naming themselves as
-- primary_user_id — can't create a row on someone else's behalf.
create policy "family_accounts_insert_owner"
  on public.family_accounts for insert
  with check (auth.uid() = primary_user_id);

-- The owner can remove a member (status -> 'removed'). The invited
-- member can approve (status -> 'active') or decline/leave
-- (status -> 'removed'), but can't self-escalate anything else.
create policy "family_accounts_update_involved"
  on public.family_accounts for update
  using (auth.uid() = primary_user_id or auth.uid() = member_user_id)
  with check (
    (auth.uid() = primary_user_id and status = 'removed')
    or (auth.uid() = member_user_id and status in ('active', 'removed'))
  );

-- Emergency contacts are private to the account that owns the Safety
-- Net card on their own Family Dashboard — not shared with members.
create policy "emergency_contacts_owner_only"
  on public.emergency_contacts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- A scheduled ride is visible/manageable by whoever requested it. (The
-- rider it's for is also allowed to see it, covering the case where a
-- parent schedules a ride for a family member's own account.)
create policy "scheduled_rides_select_involved"
  on public.scheduled_rides for select
  using (auth.uid() = requested_by or auth.uid() = rider_id);

create policy "scheduled_rides_insert_own"
  on public.scheduled_rides for insert
  with check (auth.uid() = requested_by);

create policy "scheduled_rides_update_own"
  on public.scheduled_rides for update
  using (auth.uid() = requested_by)
  with check (auth.uid() = requested_by);

create index if not exists family_accounts_primary_idx on public.family_accounts (primary_user_id, status);
create index if not exists family_accounts_member_idx on public.family_accounts (member_user_id, status);
create index if not exists scheduled_rides_requested_by_idx on public.scheduled_rides (requested_by, status);

-- ============================================================
-- DRIVER SUBSCRIPTIONS TASK
--
-- subscription_plans/driver_subscriptions already existed with wide-
-- open dev policies from an earlier task — replaced with real
-- owner/admin-scoped policies now that this task puts money and
-- feature-gating behind them.
--
-- payments.ride_id is not null (it's a ride-payment table: rider pays
-- driver for a specific ride), which doesn't fit a driver-pays-
-- platform subscription purchase. Rather than weaken that table's
-- integrity constraints, driver_subscriptions gets its own small
-- payment audit trail (method/reference/paid_at) and mirrors the same
-- self-reported-UPI-reference pattern already used for ride payments.
--
-- Scope decision (asked user): Basic unlocks nothing extra. Pro
-- unlocks Preferred Riders (approving is now gated below — the prior
-- preferred_drivers policy let any driver approve). Elite adds
-- priority placement in the rider's nearby-drivers list on top of
-- Pro. Ads/Rewards aren't built anywhere in this codebase yet, so
-- nothing gates them — `benefits` stays a flexible jsonb column for
-- a future task to read instead of inventing gates for features that
-- don't exist. Grace period is 3 days after expiry before Pro/Elite
-- features actually restrict (status flows active -> grace_period ->
-- expired, transitioned client-side — see src/lib/subscriptions.js).
-- ============================================================

alter table public.driver_subscriptions
  add column if not exists payment_method text check (payment_method in ('upi')),
  add column if not exists payment_reference text,
  add column if not exists paid_at timestamptz;

insert into public.subscription_plans (name, price, duration_days, benefits)
select 'basic', 199, 30, '{"preferred_riders": false, "priority_visibility": false}'::jsonb
where not exists (select 1 from public.subscription_plans where name = 'basic');

insert into public.subscription_plans (name, price, duration_days, benefits)
select 'pro', 499, 30, '{"preferred_riders": true, "priority_visibility": false}'::jsonb
where not exists (select 1 from public.subscription_plans where name = 'pro');

insert into public.subscription_plans (name, price, duration_days, benefits)
select 'elite', 899, 30, '{"preferred_riders": true, "priority_visibility": true}'::jsonb
where not exists (select 1 from public.subscription_plans where name = 'elite');

drop policy if exists "dev_all_subscription_plans" on public.subscription_plans;
drop policy if exists "dev_all_driver_subscriptions" on public.driver_subscriptions;

-- Catalog is readable by any authenticated user; only admins manage it.
create policy "subscription_plans_select_all"
  on public.subscription_plans for select
  using (true);

create policy "subscription_plans_admin_write"
  on public.subscription_plans for all
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

-- Reading isn't the sensitive operation here (same reasoning as
-- preferred_drivers): a rider needs to check ANY driver's active tier
-- to sort Discovery by priority visibility, so select is open to any
-- authenticated user. Only insert/update (creating/approving a paid
-- subscription) are owner/admin-scoped below.
create policy "driver_subscriptions_select_all"
  on public.driver_subscriptions for select
  using (true);

create policy "driver_subscriptions_insert_own"
  on public.driver_subscriptions for insert
  with check (auth.uid() in (select user_id from public.driver_profiles where id = driver_id));

create policy "driver_subscriptions_update_own_or_admin"
  on public.driver_subscriptions for update
  using (
    auth.uid() in (select user_id from public.driver_profiles where id = driver_id)
    or exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  )
  with check (
    auth.uid() in (select user_id from public.driver_profiles where id = driver_id)
    or exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- Gate Preferred Riders approval behind an active/grace_period Pro or
-- Elite subscription — replaces the prior blanket "any driver can set
-- any status" policy from the Preferred Drivers task. Declining/
-- blocking a rider is left ungated since that's a safety action, not
-- a paid benefit.
drop policy if exists "preferred_drivers_update_own" on public.preferred_drivers;
create policy "preferred_drivers_update_own"
  on public.preferred_drivers for update
  using (
    auth.uid() = rider_id
    or auth.uid() in (select user_id from public.driver_profiles where id = driver_id)
  )
  with check (
    (auth.uid() = rider_id and status = 'removed')
    or (
      auth.uid() in (select user_id from public.driver_profiles where id = driver_id)
      and (
        status <> 'active'
        or exists (
          select 1 from public.driver_subscriptions ds
          join public.subscription_plans sp on sp.id = ds.plan_id
          where ds.driver_id = preferred_drivers.driver_id
            and ds.status in ('active', 'grace_period')
            and sp.name in ('pro', 'elite')
        )
      )
    )
  );

create index if not exists driver_subscriptions_driver_idx on public.driver_subscriptions (driver_id, status);

-- ============================================================
-- NOTIFICATIONS & SAFETY TOOLS TASK
--
-- No Firebase project/credentials exist anywhere in this codebase,
-- and real push delivery to a closed app needs a server-side trigger
-- (this project has no custom backend beyond Supabase). Scope
-- decision (asked user, given this is for a real company): build a
-- fully real in-app Notification Center now (every production ride
-- app has one regardless of push), backed by Supabase Realtime for
-- live updates while the app is open. Real FCM push is a clean,
-- separate follow-up once a Firebase project + service account +
-- an Edge Function trigger exist — not faked with placeholder keys.
--
-- Same reasoning for SOS: no SMS provider exists, so "emergency
-- contacts are notified" is a real sos_events audit row + one-tap
-- tel:/sms: links the rider fires from their own phone (a real,
-- shipped pattern at MVP-stage ride companies), plus a genuine
-- in-app notification for any contact who happens to already have a
-- Drivo account. Real backend-triggered SMS (Twilio) is the natural
-- next step once those credentials exist.
--
-- sos_events had RLS disabled entirely since it was first created
-- (same recurring gap as every other new table in this project).
-- ============================================================

alter table public.sos_events enable row level security;

create policy "sos_events_select_own_or_admin"
  on public.sos_events for select
  using (
    auth.uid() = triggered_by
    or exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

create policy "sos_events_insert_own"
  on public.sos_events for insert
  with check (auth.uid() = triggered_by);

-- Only admins resolve an SOS event — the rider who triggered it
-- shouldn't be able to mark their own emergency "handled".
create policy "sos_events_update_admin_only"
  on public.sos_events for update
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

-- Scheduled-ride reminders: track whether the reminder for a given
-- row has already fired, so the client-side due-check poll doesn't
-- re-send it every time it runs.
alter table public.scheduled_rides add column if not exists reminder_sent_at timestamptz;

-- ============================================================
-- SHARED TRIP LINKS
--
-- The recipient of a shared trip link is explicitly NOT expected to
-- be a Drivo account (sharing with a family member who isn't a rider
-- is the real use case) — access control is the token itself, not a
-- login. A blanket "select using (true)" policy would let anyone list
-- every shared link (and every ride's pickup/destination) platform-
-- wide via a plain unfiltered REST query, which is exactly the
-- "avoid exposing trip links to unauthorized users" failure mode this
-- task calls out. So the table itself stays owner-scoped, and public
-- access goes through a SECURITY DEFINER function that only returns
-- data when the exact token matches — the standard, secure pattern
-- for magic-link-style access with Postgres RLS.
-- ============================================================

create table public.shared_trip_links (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id),
  token text not null unique,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

alter table public.shared_trip_links enable row level security;

create policy "shared_trip_links_select_own"
  on public.shared_trip_links for select
  using (auth.uid() = created_by);

create policy "shared_trip_links_insert_own"
  on public.shared_trip_links for insert
  with check (auth.uid() = created_by);

-- Returns only what a trip-share recipient needs to see (driver name,
-- vehicle, status, pickup/destination) — never the rider's identity,
-- and nothing at all if the token is wrong, expired, or unmatched.
create or replace function public.get_shared_trip(p_token text)
returns table (
  ride_status text,
  pickup_address text,
  destination_address text,
  driver_name text,
  vehicle_label text,
  expires_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    r.status,
    r.pickup_address,
    r.destination_address,
    u.name,
    trim(concat_ws(' ', v.make, v.model)),
    l.expires_at
  from public.shared_trip_links l
  join public.rides r on r.id = l.ride_id
  left join public.driver_profiles dp on dp.id = r.driver_id
  left join public.users u on u.id = dp.user_id
  left join public.vehicles v on v.id = r.vehicle_id
  where l.token = p_token
    and l.expires_at > now();
$$;

grant execute on function public.get_shared_trip(text) to anon, authenticated;

-- ============================================================
-- INCIDENT REPORTS
-- ============================================================

create table public.incident_reports (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid references public.rides(id),
  reported_by uuid not null references public.users(id),
  category text not null check (category in ('safety', 'driver_behavior', 'payment', 'vehicle', 'other')),
  description text not null,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved')),
  reviewed_by uuid references public.users(id),
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.incident_reports enable row level security;

create policy "incident_reports_select_own_or_admin"
  on public.incident_reports for select
  using (
    auth.uid() = reported_by
    or exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

create policy "incident_reports_insert_own"
  on public.incident_reports for insert
  with check (auth.uid() = reported_by);

-- Once submitted, only an admin moves it through the review workflow —
-- the reporter can't quietly edit their own report or mark it resolved.
create policy "incident_reports_update_admin_only"
  on public.incident_reports for update
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

create index if not exists shared_trip_links_token_idx on public.shared_trip_links (token);
create index if not exists incident_reports_reported_by_idx on public.incident_reports (reported_by, status);
create index if not exists sos_events_triggered_by_idx on public.sos_events (triggered_by);
