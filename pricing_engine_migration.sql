-- ============================================================
-- REAL PRICING ENGINE — admin-editable fare config
-- ============================================================
-- src/lib/fare.js had BASE_FARE / PER_KM_RATE / MIN_FARE / ROUTE_FACTOR /
-- AVG_SPEED_KMH hardcoded as JS constants — the PRD explicitly leaves the
-- actual fare model undecided, same gap driver/rider subscription pricing
-- had until subscription_plans.price got made admin-editable. This is the
-- same fix for ride fares: two tiers (luxe/space) plus one shared row for
-- the route/traffic assumptions that aren't tier-specific.

create table if not exists public.fare_tiers (
  tier text primary key check (tier in ('luxe', 'space')),
  label text not null,
  base_fare numeric(10,2) not null,
  per_km_rate numeric(10,2) not null,
  min_fare numeric(10,2) not null,
  updated_at timestamptz not null default now()
);
insert into public.fare_tiers (tier, label, base_fare, per_km_rate, min_fare) values
  ('luxe',  'Drivo Luxe (EV Sedan)', 40, 13, 80),
  ('space', 'Drivo Space (EV SUV)',  40, 18, 110)
on conflict (tier) do nothing;

create table if not exists public.fare_settings (
  id int primary key default 1,
  route_factor numeric(4,2) not null default 1.3,
  avg_speed_kmh numeric(5,2) not null default 22,
  updated_at timestamptz not null default now()
);
insert into public.fare_settings (id) values (1) on conflict (id) do nothing;

alter table public.fare_tiers enable row level security;
alter table public.fare_settings enable row level security;

-- Every rider needs to read these to estimate a fare before booking;
-- only an admin can change them.
create policy "fare_tiers_select_all" on public.fare_tiers for select using (true);
create policy "fare_tiers_admin_write" on public.fare_tiers for all
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

create policy "fare_settings_select_all" on public.fare_settings for select using (true);
create policy "fare_settings_admin_write" on public.fare_settings for all
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));
