-- ============================================================
-- DISPATCH RADIUS CAP
-- dispatch_pending_rides ordered candidates by distance but had no
-- maximum radius — a driver 800km away, sorted last, would still get
-- matched if nobody closer was online. Harmless with drivers in a
-- single city, but the exact bug that would silently cross-match a
-- rider in one city with a driver in another the moment this app
-- serves more than one. Caps the "nearest eligible driver" fallback to
-- 30km when both positions are known (same tradeoff as everywhere else
-- real GPS is optional here: unknown location still passes through,
-- since there's no way to tell if that driver is 2km away or in a
-- different city entirely).
-- ============================================================

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
    -- everywhere else real GPS is optional in this app) — but capped to
    -- 30km when both positions are actually known (same radius the
    -- client uses in src/lib/drivers.js's NEARBY_MAX_KM). Without this
    -- cap, a quiet night with nobody online nearby would still hand the
    -- ride to whoever was furthest away, anywhere, rather than expiring
    -- the search after 5 minutes like it's supposed to when nobody's
    -- really around — the exact bug that would silently cross-match a
    -- rider in one city with a driver in another the moment this app
    -- serves more than one.
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
        and (
          dp.current_latitude is null or r.pickup_latitude is null
          or public.haversine_km(dp.current_latitude, dp.current_longitude, r.pickup_latitude, r.pickup_longitude) <= 30
        )
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
