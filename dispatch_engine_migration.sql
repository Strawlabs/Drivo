-- ============================================================
-- AUTOMATIC DISPATCH / MATCHING ENGINE
-- ============================================================
-- Every EXISTING booking path (Preferred Drivers "Request Ride", a
-- driver's own "Request Ride Now", "Book" from a nearby-driver card)
-- keeps working exactly as before: they set rides.driver_id at insert
-- time and are untouched by any of this. dispatch_mode defaults to
-- 'direct' for every one of them.
--
-- This adds a second, new mode: a rider requests a ride with NO driver
-- chosen (dispatch_mode = 'auto', driver_id = null at insert), and this
-- cron-driven engine finds and offers it to real candidates — preferred
-- driver first if one's online, else the nearest eligible online driver
-- — one at a time, with the existing 30s accept window (now also
-- enforced server-side, not just by the client's countdown), retrying
-- with the next candidate on reject/timeout, until one accepts or 5
-- minutes pass with nobody found.

alter table public.rides add column if not exists dispatch_mode text not null default 'direct' check (dispatch_mode in ('direct', 'auto'));
alter table public.rides add column if not exists offered_at timestamptz;
alter table public.rides add column if not exists tried_driver_ids uuid[] not null default '{}';
alter table public.rides add column if not exists requested_vehicle_type text check (requested_vehicle_type in ('ev_auto', 'ev_car'));

create or replace function public.haversine_km(lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric)
returns numeric
language sql
immutable
as $$
  select 6371 * 2 * asin(sqrt(
    sin(radians(lat2 - lat1) / 2) ^ 2 +
    cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lng2 - lng1) / 2) ^ 2
  ));
$$;

-- Simplified server-side port of src/lib/goHome.js's matchGoHomeRide —
-- just the two hard gates that don't need the driver's live position
-- (homeward progress, drop-inside-zone), since dispatch only has the
-- ride's coordinates and the driver's last reported location, not a
-- full re-run of the client's richer scoring. A driver in Go Home Mode
-- who's incompatible with a ride is simply never offered it here; their
-- existing client-side matchGoHomeRide keeps handling the direct-
-- booking path exactly as it already did, untouched.
create or replace function public.driver_compatible_with_go_home(
  p_driver_id uuid, p_destination_lat numeric, p_destination_lng numeric,
  p_pickup_lat numeric, p_pickup_lng numeric
)
returns boolean
language plpgsql
stable
as $$
declare
  gh record;
  gap_drop numeric;
  gap_pickup numeric;
begin
  select * into gh from public.go_home_sessions
  where driver_id = p_driver_id and status = 'active' and end_time > now()
  limit 1;

  if gh is null then
    return true;
  end if;

  if p_destination_lat is null or p_destination_lng is null then
    return false;
  end if;

  gap_drop := public.haversine_km(p_destination_lat, p_destination_lng, gh.home_zone_latitude, gh.home_zone_longitude);
  if gap_drop > gh.home_zone_radius_km + 2.0 then
    return false;
  end if;

  if p_pickup_lat is not null and p_pickup_lng is not null then
    gap_pickup := public.haversine_km(p_pickup_lat, p_pickup_lng, gh.home_zone_latitude, gh.home_zone_longitude);
    if (gap_pickup - gap_drop) < 2.0 then
      return false;
    end if;
  end if;

  return true;
end;
$$;

create or replace function public.dispatch_pending_rides()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  candidate_id uuid;
begin
  -- 1) Offers nobody answered in 30s go back in the pool; remember not
  --    to re-offer the same driver for this same ride.
  update public.rides
  set tried_driver_ids = array_append(tried_driver_ids, driver_id),
      driver_id = null,
      offered_at = null
  where dispatch_mode = 'auto'
    and status = 'requested'
    and driver_id is not null
    and offered_at < now() - interval '30 seconds';

  -- 2) Give up on a search that's found nobody in 5 minutes.
  update public.rides
  set status = 'expired'
  where dispatch_mode = 'auto'
    and status = 'requested'
    and driver_id is null
    and created_at < now() - interval '5 minutes';

  -- 3) Offer every still-searching ride to its best untried candidate.
  for r in
    select * from public.rides
    where dispatch_mode = 'auto' and status = 'requested' and driver_id is null
  loop
    candidate_id := null;

    -- Preferred driver gets first refusal, if online/eligible/untried.
    select dp.id into candidate_id
    from public.preferred_drivers pd
    join public.driver_profiles dp on dp.id = pd.driver_id
    where pd.rider_id = r.rider_id
      and pd.status = 'active'
      and dp.status = 'approved'
      and dp.is_online = true
      and not (dp.id = any(r.tried_driver_ids))
      and not exists (select 1 from public.rides x where x.driver_id = dp.id and x.status in ('accepted', 'active'))
      and exists (
        select 1 from public.vehicles v where v.driver_id = dp.id and v.is_active
          and (r.requested_vehicle_type is null or v.vehicle_type = r.requested_vehicle_type)
      )
      and public.driver_compatible_with_go_home(dp.id, r.destination_latitude, r.destination_longitude, r.pickup_latitude, r.pickup_longitude)
    limit 1;

    -- Otherwise, the nearest eligible online driver (unknown location
    -- sorts last rather than being excluded, same fallback pattern used
    -- everywhere else real GPS is optional in this app).
    if candidate_id is null then
      select dp.id into candidate_id
      from public.driver_profiles dp
      where dp.status = 'approved'
        and dp.is_online = true
        and not (dp.id = any(r.tried_driver_ids))
        and not exists (select 1 from public.rides x where x.driver_id = dp.id and x.status in ('accepted', 'active'))
        and exists (
          select 1 from public.vehicles v where v.driver_id = dp.id and v.is_active
            and (r.requested_vehicle_type is null or v.vehicle_type = r.requested_vehicle_type)
        )
        and public.driver_compatible_with_go_home(dp.id, r.destination_latitude, r.destination_longitude, r.pickup_latitude, r.pickup_longitude)
      order by
        case when dp.current_latitude is not null and r.pickup_latitude is not null
          then public.haversine_km(dp.current_latitude, dp.current_longitude, r.pickup_latitude, r.pickup_longitude)
          else 999999
        end asc
      limit 1;
    end if;

    if candidate_id is not null then
      update public.rides
      set driver_id = candidate_id, offered_at = now()
      where id = r.id;

      insert into public.notifications (user_id, category, title, body, data)
      select dp.user_id, 'driver_request', 'New ride request',
             'A rider wants a ride from ' || coalesce(r.pickup_address, 'their pickup') || ' to ' || coalesce(r.destination_address, 'their destination') || '.',
             jsonb_build_object('rideId', r.id)
      from public.driver_profiles dp where dp.id = candidate_id;
    end if;
  end loop;
end;
$$;

select cron.unschedule(jobid) from cron.job where jobname = 'dispatch-pending-rides';
select cron.schedule('dispatch-pending-rides', '* * * * *', $$select public.dispatch_pending_rides();$$);
