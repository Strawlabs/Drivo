-- rides_update_involved (removed below) had no WITH CHECK either — the
-- same missing-half-of-the-policy pattern as payments/subscriptions,
-- just on the app's central table: a rider or driver "involved" in a
-- ride could set ANY field to anything once that USING clause passed —
-- final_fare, distance_km, status jumping straight from 'requested' to
-- 'completed', even reassigning driver_id to a driver who never
-- accepted it. Found by sweeping every UPDATE/ALL policy in this file
-- for the same gap after finding it twice already this session. Moves
-- every real transition (accept/start/complete/reject-or-expire/
-- cancel) into security-definer functions below, each re-checking the
-- ride's actual current state and the caller's actual ownership,
-- computing the state-machine-sensitive fields (accepted_at,
-- started_at, completed_at, final_fare, duration_minutes, distance_km)
-- server-side instead of trusting whatever the client sends.
--
-- Also found live (not from this file at all — pg_policies on the
-- production DB, checked after this fix appeared to have no effect):
-- two much older, human-named policies, "Riders manage their rides"
-- (ALL, rider_id = auth.uid()) and "Drivers see and update assigned
-- rides" (ALL, driver_id = auth.uid()), predating the *_involved
-- policies below and never captured anywhere in this file. The first
-- one alone fully explained the leftover exploit — a permissive ALL
-- policy ORs in regardless of how tight rides_admin_update is. The
-- second is structurally almost always false in practice (driver_id
-- stores a driver_profiles.id, not the driver's own auth id) but was
-- undocumented cruft either way. Both dropped below so this file
-- actually matches what's live.
drop policy if exists "Riders manage their rides" on public.rides;
drop policy if exists "Drivers see and update assigned rides" on public.rides;
drop policy if exists "rides_update_involved" on public.rides;
create policy "rides_admin_update" on public.rides for update
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

create or replace function public.accept_ride(p_ride_id uuid, p_driver_id uuid)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.rides;
begin
  if not exists (select 1 from public.driver_profiles where id = p_driver_id and user_id = auth.uid()) then
    raise exception 'Not authorized to accept rides as this driver.';
  end if;

  update public.rides
  set status = 'accepted', accepted_at = now()
  where id = p_ride_id
    and driver_id = p_driver_id
    and status = 'requested'
    -- A driver can't hold two rides at once — enforced here, not just
    -- as a pre-check in the client that a direct RPC call could skip.
    and not exists (
      select 1 from public.rides x where x.driver_id = p_driver_id and x.status in ('accepted', 'active')
    )
  returning * into v_row;

  return v_row; -- null if the guard failed (already taken / already busy) — caller treats that as "lost the race," not an error
end;
$$;

create or replace function public.start_ride(p_ride_id uuid)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.rides;
begin
  update public.rides
  set status = 'active', started_at = now()
  where id = p_ride_id
    and status = 'accepted'
    and driver_id in (select id from public.driver_profiles where user_id = auth.uid())
  returning * into v_row;

  if not found then
    raise exception 'This ride cannot be started right now.';
  end if;
  return v_row;
end;
$$;

create or replace function public.complete_ride(p_ride_id uuid)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides;
  v_duration_minutes int;
  v_distance_km numeric;
  v_row public.rides;
begin
  select * into v_ride from public.rides
  where id = p_ride_id and status = 'active'
    and driver_id in (select id from public.driver_profiles where user_id = auth.uid());
  if not found then
    raise exception 'This ride cannot be completed right now.';
  end if;

  -- No live GPS tracking yet — same approximation the client used to
  -- compute itself: elapsed time at a typical city driving speed.
  v_duration_minutes := greatest(1, round((extract(epoch from (now() - coalesce(v_ride.started_at, now()))) / 60)::numeric));
  v_distance_km := round((v_duration_minutes::numeric / 60) * 20, 1);

  update public.rides
  set status = 'completed', completed_at = now(),
      final_fare = v_ride.estimated_fare,
      duration_minutes = v_duration_minutes,
      distance_km = v_distance_km
  where id = p_ride_id
  returning * into v_row;

  return v_row;
end;
$$;

-- Mirrors releaseOrExpire's two branches exactly: an auto-dispatched
-- offer goes back into dispatch_pending_rides' pool via a backdated
-- offered_at (the next cron tick treats it as stale and reassigns);
-- a direct booking just expires, since there's no pool to fall back
-- into. Silently no-ops if the ride already moved on (another sweep
-- already reassigned it) rather than erroring.
create or replace function public.reject_or_expire_ride(p_ride_id uuid, p_driver_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text;
begin
  if not exists (select 1 from public.driver_profiles where id = p_driver_id and user_id = auth.uid()) then
    raise exception 'Not authorized to act on rides as this driver.';
  end if;

  select dispatch_mode into v_mode from public.rides
  where id = p_ride_id and driver_id = p_driver_id and status = 'requested';
  if not found then
    return;
  end if;

  if v_mode = 'auto' then
    update public.rides set offered_at = now() - interval '31 seconds'
    where id = p_ride_id and driver_id = p_driver_id and status = 'requested';
  else
    update public.rides set status = 'expired'
    where id = p_ride_id and driver_id = p_driver_id and status = 'requested';
  end if;
end;
$$;

create or replace function public.cancel_ride(p_ride_id uuid, p_reason text default 'Cancelled by rider')
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.rides;
  v_driver_user_id uuid;
begin
  update public.rides
  set status = 'cancelled', cancellation_reason = p_reason, cancelled_by = auth.uid()
  where id = p_ride_id and rider_id = auth.uid() and status not in ('completed', 'cancelled')
  returning * into v_row;

  if not found then
    raise exception 'This ride cannot be cancelled right now.';
  end if;

  -- Moved server-side rather than left to the client's own follow-up
  -- notifyDriverProfile call, so a driver who already accepted is
  -- guaranteed to hear about it even if that second call never fires.
  if v_row.driver_id is not null then
    select user_id into v_driver_user_id from public.driver_profiles where id = v_row.driver_id;
    if v_driver_user_id is not null then
      insert into public.notifications (user_id, category, title, body, data)
      values (
        v_driver_user_id, 'ride_alert', 'Ride cancelled',
        'The rider cancelled the trip to ' || coalesce(v_row.destination_address, 'their destination') || '.',
        jsonb_build_object('rideId', p_ride_id)
      );
    end if;
  end if;

  return v_row;
end;
$$;
