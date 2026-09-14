-- ============================================================
-- SUBSCRIPTION PURCHASE INTEGRITY
-- driver_subscriptions_insert_own / rider_subscriptions_insert_own only
-- ever checked that the row belonged to the caller — nothing validated
-- plan_id, status, expiry_date, or payment_reference. All of that was
-- computed correctly in subscriptions.js/riderSubscriptions.js, but
-- purely client-side: any driver or rider could bypass the app entirely
-- and INSERT a row straight from the browser console with status
-- 'active' and an expiry_date years out, granting themselves Elite (or
-- Family) for free — which also unlocks ad-campaign eligibility and
-- Preferred Riders approval, both gated on this same table. Moves
-- activation/renewal into security-definer functions that compute
-- expiry server-side and check payment_reference uniqueness under a
-- real unique index (not just a client-side SELECT-then-INSERT, which
-- two near-simultaneous calls could both pass), then locks the table
-- down so a direct client insert/update can no longer create or alter
-- a subscription at all — only these functions and an admin can.
-- ============================================================

create unique index if not exists driver_subscriptions_payment_reference_idx
  on public.driver_subscriptions (payment_reference) where payment_reference is not null;
create unique index if not exists rider_subscriptions_payment_reference_idx
  on public.rider_subscriptions (payment_reference) where payment_reference is not null;

create or replace function public.activate_driver_subscription(p_driver_id uuid, p_plan_id uuid, p_payment_reference text)
returns public.driver_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.subscription_plans;
  v_row public.driver_subscriptions;
begin
  if not exists (select 1 from public.driver_profiles where id = p_driver_id and user_id = auth.uid()) then
    raise exception 'Not authorized to modify this driver''s subscription.';
  end if;

  select * into v_plan from public.subscription_plans where id = p_plan_id and is_active = true;
  if not found then
    raise exception 'Selected plan is not available.';
  end if;

  -- Switching plans replaces whatever's currently active/lapsed — a
  -- driver can't hold two simultaneously-active plans.
  update public.driver_subscriptions
  set status = 'cancelled'
  where driver_id = p_driver_id and status in ('active', 'grace_period');

  insert into public.driver_subscriptions
    (driver_id, plan_id, status, start_date, expiry_date, payment_method, payment_reference, paid_at)
  values
    (p_driver_id, p_plan_id, 'active', current_date, current_date + v_plan.duration_days, 'upi', p_payment_reference, now())
  returning * into v_row;

  return v_row;
exception
  when unique_violation then
    raise exception 'This payment reference has already been used. Please check your UPI reference.';
end;
$$;

create or replace function public.renew_driver_subscription(p_driver_id uuid, p_plan_id uuid, p_payment_reference text)
returns public.driver_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.subscription_plans;
  v_current public.driver_subscriptions;
  v_start date;
  v_row public.driver_subscriptions;
begin
  if not exists (select 1 from public.driver_profiles where id = p_driver_id and user_id = auth.uid()) then
    raise exception 'Not authorized to modify this driver''s subscription.';
  end if;

  select * into v_plan from public.subscription_plans where id = p_plan_id and is_active = true;
  if not found then
    raise exception 'Selected plan is not available.';
  end if;

  -- Re-derive "the current subscription" server-side (same rule as
  -- fetchCurrentSubscription) rather than trusting whatever the caller
  -- claims — renewal extends access without interruption only if that
  -- current row is genuinely still active and unexpired.
  select * into v_current from public.driver_subscriptions
  where driver_id = p_driver_id and status in ('active', 'grace_period')
  order by expiry_date desc limit 1;

  if found and v_current.status = 'active' and v_current.expiry_date >= current_date then
    v_start := v_current.expiry_date;
  else
    v_start := current_date;
  end if;

  if found then
    update public.driver_subscriptions set status = 'cancelled' where id = v_current.id;
  end if;

  insert into public.driver_subscriptions
    (driver_id, plan_id, status, start_date, expiry_date, payment_method, payment_reference, paid_at)
  values
    (p_driver_id, p_plan_id, 'active', v_start, v_start + v_plan.duration_days, 'upi', p_payment_reference, now())
  returning * into v_row;

  return v_row;
exception
  when unique_violation then
    raise exception 'This payment reference has already been used. Please check your UPI reference.';
end;
$$;

create or replace function public.activate_rider_subscription(p_rider_id uuid, p_plan_id uuid, p_payment_reference text)
returns public.rider_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.rider_subscription_plans;
  v_row public.rider_subscriptions;
begin
  if auth.uid() <> p_rider_id then
    raise exception 'Not authorized to modify this subscription.';
  end if;

  select * into v_plan from public.rider_subscription_plans where id = p_plan_id and is_active = true;
  if not found then
    raise exception 'Selected plan is not available.';
  end if;

  update public.rider_subscriptions
  set status = 'cancelled'
  where rider_id = p_rider_id and status in ('active', 'grace_period');

  insert into public.rider_subscriptions
    (rider_id, plan_id, status, start_date, expiry_date, payment_method, payment_reference, paid_at)
  values
    (p_rider_id, p_plan_id, 'active', current_date, current_date + v_plan.duration_days, 'upi', p_payment_reference, now())
  returning * into v_row;

  return v_row;
exception
  when unique_violation then
    raise exception 'This payment reference has already been used. Please check your UPI reference.';
end;
$$;

create or replace function public.renew_rider_subscription(p_rider_id uuid, p_plan_id uuid, p_payment_reference text)
returns public.rider_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.rider_subscription_plans;
  v_current public.rider_subscriptions;
  v_start date;
  v_row public.rider_subscriptions;
begin
  if auth.uid() <> p_rider_id then
    raise exception 'Not authorized to modify this subscription.';
  end if;

  select * into v_plan from public.rider_subscription_plans where id = p_plan_id and is_active = true;
  if not found then
    raise exception 'Selected plan is not available.';
  end if;

  select * into v_current from public.rider_subscriptions
  where rider_id = p_rider_id and status in ('active', 'grace_period')
  order by expiry_date desc limit 1;

  if found and v_current.status = 'active' and v_current.expiry_date >= current_date then
    v_start := v_current.expiry_date;
  else
    v_start := current_date;
  end if;

  if found then
    update public.rider_subscriptions set status = 'cancelled' where id = v_current.id;
  end if;

  insert into public.rider_subscriptions
    (rider_id, plan_id, status, start_date, expiry_date, payment_method, payment_reference, paid_at)
  values
    (p_rider_id, p_plan_id, 'active', v_start, v_start + v_plan.duration_days, 'upi', p_payment_reference, now())
  returning * into v_row;

  return v_row;
exception
  when unique_violation then
    raise exception 'This payment reference has already been used. Please check your UPI reference.';
end;
$$;

-- Only these functions (or an admin, for a manual comp) can create or
-- alter a subscription row now — a driver/rider's own session can no
-- longer write to this table directly at all.
drop policy if exists "driver_subscriptions_insert_own" on public.driver_subscriptions;
create policy "driver_subscriptions_admin_insert"
  on public.driver_subscriptions for insert
  with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

drop policy if exists "driver_subscriptions_update_own_or_admin" on public.driver_subscriptions;
create policy "driver_subscriptions_admin_update"
  on public.driver_subscriptions for update
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

drop policy if exists "rider_subscriptions_insert_own" on public.rider_subscriptions;
create policy "rider_subscriptions_admin_insert"
  on public.rider_subscriptions for insert
  with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

drop policy if exists "rider_subscriptions_update_own_or_admin" on public.rider_subscriptions;
create policy "rider_subscriptions_admin_update"
  on public.rider_subscriptions for update
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));
