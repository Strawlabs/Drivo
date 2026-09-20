-- payments_update_self_or_admin (removed below) had no WITH CHECK, so
-- Postgres reused its USING clause for both — meaning once "is this my
-- own payment" passed, a rider could set status/upi_reference/paid_at
-- to literally anything, including marking their own failed or
-- flagged ride payment 'completed' with a fabricated reference,
-- bypassing confirmUpiPayment's fraud check entirely. Confirmed live
-- and exploitable before this fix. Moves both real transitions
-- (confirm/fail) into security-definer functions that re-check the
-- payment's current state and compute the fraud flag server-side
-- (fixing the same client-side SELECT-then-UPDATE race the subscription
-- fix addressed), then locks the table so a rider's own session can no
-- longer write to it directly at all — see SUBSCRIPTION PURCHASE
-- INTEGRITY above for the identical pattern.
drop policy if exists "payments_update_self_or_admin" on public.payments;
create policy "payments_admin_update" on public.payments for update
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

create or replace function public.confirm_upi_payment(p_payment_id uuid, p_upi_reference text)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
  v_flagged boolean;
  v_row public.payments;
begin
  select * into v_payment from public.payments where id = p_payment_id;
  if not found then
    raise exception 'Payment not found.';
  end if;
  if v_payment.rider_id <> auth.uid() then
    raise exception 'Not authorized to confirm this payment.';
  end if;
  if v_payment.status <> 'pending' then
    raise exception 'This payment is not awaiting confirmation.';
  end if;

  v_flagged := exists (
    select 1 from public.payments where upi_reference = p_upi_reference and id <> p_payment_id
  );

  update public.payments
  set status = case when v_flagged then 'flagged' else 'completed' end,
      upi_reference = p_upi_reference,
      paid_at = case when v_flagged then null else now() end
  where id = p_payment_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.fail_upi_payment(p_payment_id uuid)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
  v_row public.payments;
begin
  select * into v_payment from public.payments where id = p_payment_id;
  if not found then
    raise exception 'Payment not found.';
  end if;
  if v_payment.rider_id <> auth.uid() then
    raise exception 'Not authorized to update this payment.';
  end if;
  if v_payment.status <> 'pending' then
    raise exception 'This payment cannot be marked failed from its current state.';
  end if;

  update public.payments set status = 'failed' where id = p_payment_id returning * into v_row;
  return v_row;
end;
$$;

-- The other half of the original gap: a flagged payment had nowhere to
-- go. Nothing surfaced it to an admin, and nothing could ever move it
-- out of 'flagged' even if someone noticed — confirm_upi_payment only
-- transitions a 'pending' payment, by design, so a flagged one is
-- otherwise permanently stuck. This is the one deliberate exception:
-- an admin, after actually reviewing the conflicting references,
-- decides which payment (if either) was legitimate.
create or replace function public.admin_resolve_flagged_payment(p_payment_id uuid, p_resolution text)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.payments;
begin
  if not exists (select 1 from public.users where id = auth.uid() and role = 'admin') then
    raise exception 'Not authorized.';
  end if;
  if p_resolution not in ('completed', 'failed') then
    raise exception 'Invalid resolution — must be completed or failed.';
  end if;

  update public.payments
  set status = p_resolution,
      paid_at = case when p_resolution = 'completed' then now() else null end
  where id = p_payment_id and status = 'flagged'
  returning * into v_row;

  if not found then
    raise exception 'Payment is not currently flagged.';
  end if;

  return v_row;
end;
$$;
