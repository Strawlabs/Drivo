-- ============================================================
-- CANCELLATION VISIBILITY
-- A rider cancelling after a driver accepted was previously
-- indistinguishable from cancelling a still-unmatched request — nothing
-- recorded when acceptance happened, so admin reporting couldn't tell
-- "cancelled instantly" from "driver was already on the way." This adds
-- the one missing timestamp so the app can classify cancellations by
-- stage (before acceptance / after acceptance / after the ride started)
-- without changing any existing behavior.
-- ============================================================

alter table public.rides add column if not exists accepted_at timestamptz;
