-- ============================================================
-- SUSPENDED DRIVER GUARD
-- Found during the end-to-end regression pass: a suspended driver
-- couldn't get freshly discovered or auto-matched (both
-- dispatch_pending_rides and fetchAvailableDrivers already filter
-- status='approved'), but nothing stopped them from accepting a ride
-- still sitting in their own queue from before suspension, or from
-- going back online at all. Closes both: accept_ride now also
-- requires status='approved' at accept time, and
-- set_driver_online_status refuses to flip a driver online unless
-- they're approved (going offline is always allowed). Admin's
-- suspendDriver action (src/pages/admin/DashboardPage.jsx) was also
-- updated to force is_online=false immediately — no schema change
-- needed there, it's a plain admin-privileged update.
-- ============================================================

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
    and not exists (
      select 1 from public.rides x where x.driver_id = p_driver_id and x.status in ('accepted', 'active')
    )
    and exists (select 1 from public.driver_profiles where id = p_driver_id and status = 'approved')
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.set_driver_online_status(p_driver_id uuid, p_is_online boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.driver_profiles
  set is_online = p_is_online
  where id = p_driver_id and user_id = auth.uid()
    and (p_is_online = false or status = 'approved');
end;
$$;
