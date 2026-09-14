-- driver_profiles_update_self_or_admin (removed below) let a driver
-- self-update ANY column once ownership passed — same missing-column-
-- restriction shape as rides/payments/subscriptions, just harder to
-- notice since "using = with check, both just ownership" reads as
-- fine at a glance. In practice a driver could run
-- `update({kyc_status:'approved', status:'approved', rating:5})`
-- straight from the browser console and self-approve their own KYC.
-- Found live during a full end-to-end regression pass, verified with
-- a second, subtler bug: recalculateDriverRating (src/lib/drivers.js)
-- is always called by the RIDER after leaving a review, not the
-- driver — under the old policy that update was silently filtered to
-- zero rows (no error, since UPDATE's USING clause just excludes non-
-- matching rows rather than raising), meaning every driver's
-- rating/total_rides has been frozen since this policy existed.
-- Confirmed live: total_rides stayed at 4 after recalculating against
-- 6 real ride_ratings rows. Moves every real self-transition (online
-- toggle, live location, KYC submission) and the rating recalculation
-- into security-definer functions, then locks the raw policy to admin
-- only — same pattern as everywhere else this session.
drop policy if exists "driver_profiles_update_self_or_admin" on public.driver_profiles;
create policy "driver_profiles_admin_update" on public.driver_profiles for update
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

create or replace function public.set_driver_online_status(p_driver_id uuid, p_is_online boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.driver_profiles
  set is_online = p_is_online
  where id = p_driver_id and user_id = auth.uid();
end;
$$;

create or replace function public.update_driver_location(p_driver_id uuid, p_lat numeric, p_lng numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.driver_profiles
  set current_latitude = p_lat, current_longitude = p_lng
  where id = p_driver_id and user_id = auth.uid();
end;
$$;

-- A driver can (re-)submit whenever they aren't already approved —
-- covers both the first submission and re-uploading after a rejection.
create or replace function public.submit_kyc_documents(p_driver_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.driver_profiles
  set kyc_status = 'submitted'
  where id = p_driver_id and user_id = auth.uid() and kyc_status <> 'approved';
end;
$$;

-- Deliberately callable by anyone authenticated, not just the driver:
-- it only ever recomputes from real ride_ratings rows (each one
-- already validated at insert time against a real completed ride the
-- rating's own rider actually took — see ride_ratings_insert_self
-- below), so there's no exploitable input here, only a self-correcting
-- recalculation that was previously impossible for the rider who
-- triggers it to perform at all.
create or replace function public.recalculate_driver_rating(p_driver_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avg numeric;
  v_count int;
begin
  select round(avg(rating)::numeric, 2), count(*) into v_avg, v_count
  from public.ride_ratings where driver_id = p_driver_id;

  if v_count = 0 then
    return;
  end if;

  update public.driver_profiles
  set rating = v_avg, total_rides = v_count
  where id = p_driver_id;
end;
$$;
