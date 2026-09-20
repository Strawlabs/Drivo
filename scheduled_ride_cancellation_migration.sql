-- ============================================================
-- SCHEDULED RIDE CANCELLATION
-- cancelScheduledRide (src/lib/family.js) used to just flip
-- scheduled_rides.status — unlike scheduleRide (which notifies both
-- requested_by and rider_id when a family member booked for someone
-- else), nobody found out. Worse: once dispatch_due_scheduled_rides has
-- already turned a row into a real ride (status 'dispatched', ride_id
-- set, possibly already offered to or accepted by a driver),
-- cancelling the scheduled_rides row left that real ride running —
-- the driver would still show up for a pickup the family had cancelled.
-- A security-definer function is the only way to fix the second part
-- at all: whoever scheduled the ride (requested_by) can't necessarily
-- touch the underlying rides row directly via RLS if it was booked for
-- a different family member (rides_update_involved only allows the
-- ride's own rider, its driver, or an admin).
-- ============================================================

create or replace function public.cancel_scheduled_ride(p_id uuid, p_reason text default 'Cancelled by user')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sr public.scheduled_rides;
  v_ride_driver_id uuid;
  v_driver_user_id uuid;
begin
  select * into sr from public.scheduled_rides where id = p_id;
  if not found then
    raise exception 'Scheduled ride not found.';
  end if;
  if sr.requested_by <> auth.uid() then
    raise exception 'Not authorized to cancel this scheduled ride.';
  end if;
  if sr.status = 'cancelled' then
    return;
  end if;

  update public.scheduled_rides set status = 'cancelled', cancellation_reason = p_reason where id = p_id;

  if sr.rider_id <> sr.requested_by then
    insert into public.notifications (user_id, category, title, body)
    values (
      sr.rider_id, 'ride_alert', 'Scheduled ride cancelled',
      'Your ride from ' || coalesce(sr.pickup_address, 'pickup') || ' to ' || coalesce(sr.destination_address, 'destination') ||
        ' scheduled for ' || to_char(sr.scheduled_at at time zone 'Asia/Kolkata', 'DD Mon, HH12:MI AM') || ' was cancelled.'
    );
  end if;

  if sr.ride_id is not null then
    select driver_id into v_ride_driver_id from public.rides
    where id = sr.ride_id and status not in ('completed', 'cancelled');

    if found then
      update public.rides
      set status = 'cancelled', cancellation_reason = p_reason, cancelled_by = auth.uid()
      where id = sr.ride_id;

      if v_ride_driver_id is not null then
        select user_id into v_driver_user_id from public.driver_profiles where id = v_ride_driver_id;
        if v_driver_user_id is not null then
          insert into public.notifications (user_id, category, title, body)
          values (
            v_driver_user_id, 'ride_alert', 'Ride cancelled',
            'The scheduled ride from ' || coalesce(sr.pickup_address, 'pickup') || ' to ' || coalesce(sr.destination_address, 'destination') || ' was cancelled.'
          );
        end if;
      end if;
    end if;
  end if;
end;
$$;
