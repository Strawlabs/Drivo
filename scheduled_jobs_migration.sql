-- ============================================================
-- SERVER-SIDE SCHEDULED JOBS (pg_cron)
-- ============================================================
-- Every timed feature below used to be a setInterval/setTimeout running
-- only while some browser tab happened to be open (Go Home Mode expiry,
-- UPI payment timeout, subscription grace/expiry, scheduled-ride dispatch
-- + reminders — see the client-side comments this replaces in
-- src/lib/goHome.js, src/lib/payments.js, src/lib/subscriptions.js,
-- src/lib/riderSubscriptions.js, src/lib/family.js). These pg_cron jobs
-- are the real, always-on version of the same logic; the client-side
-- versions are left in place as a fast local nudge when a tab IS open,
-- but are no longer what makes any of this actually happen.
--
-- Re-runnable: each job is unscheduled before being (re)scheduled, so
-- pasting this whole block again (e.g. after an edit) is safe.

create extension if not exists pg_cron;

-- Go Home Mode: expire any active session whose end_time has passed.
create or replace function public.expire_stale_go_home_sessions()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.go_home_sessions
  set status = 'expired', updated_at = now()
  where status = 'active' and end_time < now();
end;
$$;

select cron.unschedule(jobid) from cron.job where jobname = 'expire-go-home-sessions';
select cron.schedule('expire-go-home-sessions', '* * * * *', $$select public.expire_stale_go_home_sessions();$$);

-- UPI ride payments: no gateway callback exists for this MVP, so a
-- pending UPI payment nobody confirms within 2 minutes fails instead of
-- sitting pending forever (mirrors RideCompletePage's client-side timer).
create or replace function public.expire_stale_upi_payments()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.payments
  set status = 'failed'
  where status = 'pending'
    and method = 'upi'
    and created_at < now() - interval '120 seconds';
end;
$$;

select cron.unschedule(jobid) from cron.job where jobname = 'expire-stale-upi-payments';
select cron.schedule('expire-stale-upi-payments', '* * * * *', $$select public.expire_stale_upi_payments();$$);

-- Driver subscriptions: active -> grace_period once expiry_date has
-- passed, grace_period/active -> expired once GRACE_PERIOD_DAYS (3) further.
create or replace function public.update_driver_subscription_statuses()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.driver_subscriptions
  set status = 'grace_period'
  where status = 'active'
    and expiry_date < current_date
    and expiry_date >= current_date - 3;

  update public.driver_subscriptions
  set status = 'expired'
  where status in ('active', 'grace_period')
    and expiry_date < current_date - 3;
end;
$$;

select cron.unschedule(jobid) from cron.job where jobname = 'update-driver-subscription-statuses';
select cron.schedule('update-driver-subscription-statuses', '0 1 * * *', $$select public.update_driver_subscription_statuses();$$);

-- Rider subscriptions: same active -> grace_period -> expired transition.
create or replace function public.update_rider_subscription_statuses()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.rider_subscriptions
  set status = 'grace_period'
  where status = 'active'
    and expiry_date < current_date
    and expiry_date >= current_date - 3;

  update public.rider_subscriptions
  set status = 'expired'
  where status in ('active', 'grace_period')
    and expiry_date < current_date - 3;
end;
$$;

select cron.unschedule(jobid) from cron.job where jobname = 'update-rider-subscription-statuses';
select cron.schedule('update-rider-subscription-statuses', '0 1 * * *', $$select public.update_rider_subscription_statuses();$$);

-- Scheduled rides: dispatch every row whose scheduled_at has arrived into
-- a real ride request, and notify the rider (+ preferred driver, if any).
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
    insert into public.rides (rider_id, driver_id, pickup_address, destination_address, status)
    values (sr.rider_id, sr.preferred_driver_id, sr.pickup_address, sr.destination_address, 'requested')
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

select cron.unschedule(jobid) from cron.job where jobname = 'dispatch-due-scheduled-rides';
select cron.schedule('dispatch-due-scheduled-rides', '* * * * *', $$select public.dispatch_due_scheduled_rides();$$);

-- Scheduled-ride reminders: notify once, ~30 min ahead of the scheduled
-- time (reminder_sent_at guards against sending the same reminder twice).
create or replace function public.send_due_scheduled_ride_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sr record;
begin
  for sr in
    select * from public.scheduled_rides
    where status = 'scheduled'
      and reminder_sent_at is null
      and scheduled_at > now()
      and scheduled_at <= now() + interval '30 minutes'
  loop
    insert into public.notifications (user_id, category, title, body)
    values (
      sr.rider_id, 'ride_alert', 'Upcoming ride reminder',
      'Your ride to ' || sr.destination_address || ' is scheduled for ' ||
        to_char(sr.scheduled_at at time zone 'Asia/Kolkata', 'HH12:MI AM') ||
        ' — pickup at ' || sr.pickup_address || '.'
    );

    update public.scheduled_rides set reminder_sent_at = now() where id = sr.id;
  end loop;
end;
$$;

select cron.unschedule(jobid) from cron.job where jobname = 'send-scheduled-ride-reminders';
select cron.schedule('send-scheduled-ride-reminders', '* * * * *', $$select public.send_due_scheduled_ride_reminders();$$);
