-- ============================================================
-- SCHEDULED RIDE DISPATCH MODE
-- Found during the end-to-end regression pass, via the Family
-- Dashboard showing two scheduled rides permanently stuck "In
-- progress": dispatch_due_scheduled_rides never set dispatch_mode on
-- the ride it creates, so it silently took the column's default
-- ('direct') even for an "Any Driver" scheduled ride
-- (preferred_driver_id null) — meaning driver_id was also null, and
-- dispatch_pending_rides only ever processes dispatch_mode='auto'
-- rows, so that ride could never be matched to anyone, permanently.
-- This was a live, currently-active bug, not just stale data — any
-- "Any Driver" scheduled ride dispatched today would hit the same dead
-- end. Fixes the function, then repairs every row already stuck this
-- way (found 4, all from mid-August — old enough that reviving them to
-- actually dispatch now doesn't make sense, so they're marked expired
-- instead of retroactively fixed).
-- ============================================================

create or replace function public.dispatch_due_scheduled_rides()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sr record;
  new_ride_id uuid;
  driver_user_id uuid;
begin
  for sr in
    select * from public.scheduled_rides
    where status = 'scheduled' and scheduled_at <= now()
  loop
    insert into public.rides (rider_id, driver_id, dispatch_mode, pickup_address, destination_address, status)
    values (
      sr.rider_id, sr.preferred_driver_id,
      case when sr.preferred_driver_id is null then 'auto' else 'direct' end,
      sr.pickup_address, sr.destination_address, 'requested'
    )
    returning id into new_ride_id;

    update public.scheduled_rides
    set status = 'dispatched', ride_id = new_ride_id
    where id = sr.id;

    insert into public.notifications (user_id, category, title, body)
    values (
      sr.rider_id, 'ride_alert', 'Scheduled ride starting',
      'Your scheduled ride to ' || sr.destination_address || ' is now being requested.'
    );

    if sr.preferred_driver_id is not null then
      select user_id into driver_user_id from public.driver_profiles where id = sr.preferred_driver_id;
      if driver_user_id is not null then
        insert into public.notifications (user_id, category, title, body, data)
        values (
          driver_user_id, 'driver_request', 'New ride request',
          'A rider wants a ride from ' || sr.pickup_address || ' to ' || sr.destination_address || '.',
          jsonb_build_object('rideId', new_ride_id)
        );
      end if;
    end if;
  end loop;
end;
$$;

-- One-time repair: every ride stuck in exactly the broken state this
-- bug produced (direct mode, no driver, still 'requested') — expire
-- them rather than let them suddenly get real-dispatched a month late.
update public.rides
set status = 'expired'
where status = 'requested' and dispatch_mode = 'direct' and driver_id is null;

-- Mirror the same terminal state on their scheduled_rides parent so
-- the Family Dashboard stops showing them as "In progress" forever.
update public.scheduled_rides
set status = 'cancelled', cancellation_reason = 'Never dispatched to a driver (pre-dispatch-engine bug, cleaned up during regression pass)'
where status = 'dispatched'
  and ride_id in (
    select id from public.rides where status = 'expired' and dispatch_mode = 'direct' and driver_id is null
  );
