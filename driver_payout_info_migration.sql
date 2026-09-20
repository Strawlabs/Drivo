-- ============================================================
-- DRIVER PAYOUT INFO
-- Found while building the driver Settings page: upi_id (what
-- buildUpiLink in src/lib/payments.js reads to build the rider's
-- payment deep link) was never settable anywhere in the app — every
-- test driver's value came from seed data, not any real flow. Same
-- whitelist-one-field pattern as the other driver_profiles functions
-- (set_driver_online_status, update_driver_location,
-- submit_kyc_documents) added earlier this session.
-- ============================================================

create or replace function public.update_driver_payout_info(p_driver_id uuid, p_upi_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.driver_profiles
  set upi_id = p_upi_id
  where id = p_driver_id and user_id = auth.uid();
end;
$$;
