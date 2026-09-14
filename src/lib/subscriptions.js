import { supabase } from '@/lib/supabase'

export const GRACE_PERIOD_DAYS = 3
export const QUALIFYING_TIERS = ['pro', 'elite']

/*
  Date#toISOString() is UTC — formatting a local-midnight Date this way
  silently shifts the date back a day for anyone east of UTC (this
  project's test users are IST). Same pitfall already hit and fixed in
  Go Home Mode's toLocalDatetimeInputValue(); same fix here.
*/
function toLocalDateString(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export async function fetchPlans() {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('price', { ascending: true })
  if (error) throw error
  return data ?? []
}

/*
  A real pg_cron job (update_driver_subscription_statuses, see
  schema.sql) already runs this exact active -> grace_period -> expired
  transition once a day platform-wide. This just calls the same
  security-definer function on demand so a driver who opens the app
  mid-day sees a freshly-correct status instead of waiting for the next
  cron tick — not a second, divergent implementation of the same rule,
  and (since driver_subscriptions no longer accepts a direct client
  update at all) the only way this transition can happen client-side.
*/
export async function checkAndUpdateSubscriptionStatus() {
  const { error } = await supabase.rpc('update_driver_subscription_statuses')
  if (error) throw error
}

/*
  The "current" row to show/act on — prefers an active/grace_period
  row (the one that's actually in effect) over cancelled/expired ones,
  even if an old cancelled row happens to have a later expiry_date
  (e.g. right after switching plans, the superseded plan's original
  expiry can still be later in the calendar than the new plan's).
  Falls back to the most recent row overall if nothing is current, so
  a driver who has fully lapsed still sees their last plan's history.
*/
export async function fetchCurrentSubscription(driverId) {
  const { data, error } = await supabase
    .from('driver_subscriptions')
    .select('*, subscription_plans(*)')
    .eq('driver_id', driverId)
  if (error) throw error

  const rows = data ?? []
  const current = rows
    .filter(r => ['active', 'grace_period'].includes(r.status))
    .sort((a, b) => new Date(b.expiry_date) - new Date(a.expiry_date))[0]
  if (current) return current

  return rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] ?? null
}

export async function fetchSubscriptionHistory(driverId) {
  const { data, error } = await supabase
    .from('driver_subscriptions')
    .select('*, subscription_plans(name, price)')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/*
  notifications.user_id references public.users(id), but everywhere
  in this file "driverId" means driver_profiles.id (what
  driver_subscriptions.driver_id actually references) — inserting
  driverId directly as notifications.user_id violates that FK and
  fails silently (this insert's result was never checked). Resolve
  the real owning user first.
*/
async function notifyDriver(driverId, { title, body }) {
  const { data: profile } = await supabase.from('driver_profiles').select('user_id').eq('id', driverId).maybeSingle()
  if (!profile) return
  const { error } = await supabase.from('notifications').insert({
    user_id: profile.user_id,
    category: 'subscription',
    title,
    body,
  })
  if (error) console.error('Failed to send subscription notification:', error)
}

export async function hasQualifyingTier(driverId) {
  const { data, error } = await supabase
    .from('driver_subscriptions')
    .select('status, subscription_plans(name)')
    .eq('driver_id', driverId)
    .in('status', ['active', 'grace_period'])
  if (error) throw error
  return (data ?? []).some(row => QUALIFYING_TIERS.includes(row.subscription_plans?.name))
}

/*
  Self-reported UPI confirmation, mirroring the ride-payment pattern in
  src/lib/payments.js: same duplicate-reference fraud check — except the
  check, the expiry math, and the write all now happen inside
  activate_driver_subscription (schema.sql), not here. This table no
  longer accepts a direct client insert/update at all (see
  SUBSCRIPTION PURCHASE INTEGRITY in schema.sql): a raw insert let any
  driver set status/expiry_date to whatever they wanted, self-granting
  Elite for free. The RPC re-derives everything server-side instead of
  trusting these arguments for anything but "which plan, which
  reference" — planId/upiReference are effectively user input, not
  assumed-correct state.
*/
export async function activateSubscription({ driverId, planId, upiReference }) {
  const ref = upiReference.trim()
  if (!ref) throw new Error('Enter the UPI transaction reference to confirm payment.')

  const { data, error } = await supabase.rpc('activate_driver_subscription', {
    p_driver_id: driverId, p_plan_id: planId, p_payment_reference: ref,
  })
  if (error) throw error

  const { data: plan } = await supabase.from('subscription_plans').select('name').eq('id', planId).single()
  await notifyDriver(driverId, {
    title: 'Subscription activated',
    body: `Your ${plan?.name ? plan.name.charAt(0).toUpperCase() + plan.name.slice(1) : 'new'} plan is now active until ${new Date(data.expiry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.`,
  })

  return data
}

/*
  Renewal extends access without interruption: if the current
  subscription is still within its paid period, the new expiry chains
  off the OLD expiry date rather than today, so the driver never loses
  already-paid-for days. If it's already lapsed (grace_period/expired),
  the new period starts from today instead — computed server-side by
  renew_driver_subscription (schema.sql), which re-derives "the current
  subscription" itself rather than trusting the caller's
  currentSubscription (kept as a param only so the UI can decide
  whether to show "Renew" at all; it's never sent to the RPC).
*/
export async function renewSubscription({ driverId, planId, upiReference }) {
  const ref = upiReference.trim()
  if (!ref) throw new Error('Enter the UPI transaction reference to confirm payment.')

  const { data, error } = await supabase.rpc('renew_driver_subscription', {
    p_driver_id: driverId, p_plan_id: planId, p_payment_reference: ref,
  })
  if (error) throw error

  const { data: plan } = await supabase.from('subscription_plans').select('name').eq('id', planId).single()
  await notifyDriver(driverId, {
    title: 'Subscription renewed',
    body: `Your ${plan?.name ? plan.name.charAt(0).toUpperCase() + plan.name.slice(1) : ''} plan has been renewed until ${new Date(data.expiry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.`,
  })

  return data
}
