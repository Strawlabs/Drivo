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
  No backend cron exists in this app (same constraint as Go Home Mode,
  scheduled rides). Expiry/grace-period transitions are computed here,
  client-side, anchored to real dates — active -> grace_period once
  expiry_date has passed, grace_period -> expired once
  GRACE_PERIOD_DAYS past that. Called on load before reading status
  anywhere so displayed/enforced status is never stale.
*/
export async function checkAndUpdateSubscriptionStatus(driverId) {
  const { data: rows, error } = await supabase
    .from('driver_subscriptions')
    .select('id, status, expiry_date')
    .eq('driver_id', driverId)
    .in('status', ['active', 'grace_period'])
  if (error) throw error

  const today = new Date(); today.setHours(0, 0, 0, 0)

  for (const row of rows ?? []) {
    const expiry = new Date(row.expiry_date)
    const graceEnd = new Date(expiry); graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_DAYS)

    let nextStatus = row.status
    if (row.status === 'active' && today > expiry) nextStatus = today > graceEnd ? 'expired' : 'grace_period'
    else if (row.status === 'grace_period' && today > graceEnd) nextStatus = 'expired'

    if (nextStatus !== row.status) {
      await supabase.from('driver_subscriptions').update({ status: nextStatus }).eq('id', row.id)
    }
  }
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
  src/lib/payments.js: same duplicate-reference fraud check, since
  there's no real payment gateway callback for this MVP. Unlike ride
  payments, no 'pending' row is written until the reference is actually
  confirmed — a subscription purchase is a short, single-user flow, not
  something that needs to survive being abandoned mid-payment.
*/
export async function activateSubscription({ driverId, planId, upiReference }) {
  const ref = upiReference.trim()
  if (!ref) throw new Error('Enter the UPI transaction reference to confirm payment.')

  const { data: existing } = await supabase
    .from('driver_subscriptions')
    .select('id')
    .eq('payment_reference', ref)
    .maybeSingle()
  if (existing) throw new Error('This payment reference has already been used. Please check your UPI reference.')

  const { data: plan, error: planError } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('id', planId)
    .single()
  if (planError) throw planError

  const start = new Date()
  const expiry = new Date(start)
  expiry.setDate(expiry.getDate() + plan.duration_days)

  // Switching plans replaces whatever's currently active/lapsed — a driver
  // can't hold two simultaneously-active plans (would double-count in
  // admin subscriber totals and make "current plan" display ambiguous).
  await supabase
    .from('driver_subscriptions')
    .update({ status: 'cancelled' })
    .eq('driver_id', driverId)
    .in('status', ['active', 'grace_period'])

  const { data, error } = await supabase
    .from('driver_subscriptions')
    .insert({
      driver_id: driverId,
      plan_id: planId,
      status: 'active',
      start_date: toLocalDateString(start),
      expiry_date: toLocalDateString(expiry),
      payment_method: 'upi',
      payment_reference: ref,
      paid_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (error) throw error

  await notifyDriver(driverId, {
    title: 'Subscription activated',
    body: `Your ${plan.name.charAt(0).toUpperCase() + plan.name.slice(1)} plan is now active until ${expiry.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.`,
  })

  return data
}

/*
  Renewal extends access without interruption: if the current
  subscription is still within its paid period, the new expiry chains
  off the OLD expiry date rather than today, so the driver never loses
  already-paid-for days. If it's already lapsed (grace_period/expired),
  the new period starts from today instead.
*/
export async function renewSubscription({ driverId, currentSubscription, planId, upiReference }) {
  const ref = upiReference.trim()
  if (!ref) throw new Error('Enter the UPI transaction reference to confirm payment.')

  const { data: existing } = await supabase
    .from('driver_subscriptions')
    .select('id')
    .eq('payment_reference', ref)
    .maybeSingle()
  if (existing) throw new Error('This payment reference has already been used. Please check your UPI reference.')

  const { data: plan, error: planError } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('id', planId)
    .single()
  if (planError) throw planError

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const stillActive = currentSubscription?.status === 'active' && new Date(currentSubscription.expiry_date) >= today
  const start = stillActive ? new Date(currentSubscription.expiry_date) : today
  const expiry = new Date(start)
  expiry.setDate(expiry.getDate() + plan.duration_days)

  // Close out the row being renewed so it doesn't linger as a second
  // "active"/"grace_period" row alongside the new one (same fix as
  // activateSubscription — one current row per driver at a time).
  if (currentSubscription?.id) {
    await supabase.from('driver_subscriptions').update({ status: 'cancelled' }).eq('id', currentSubscription.id)
  }

  const { data, error } = await supabase
    .from('driver_subscriptions')
    .insert({
      driver_id: driverId,
      plan_id: planId,
      status: 'active',
      start_date: toLocalDateString(start),
      expiry_date: toLocalDateString(expiry),
      payment_method: 'upi',
      payment_reference: ref,
      paid_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (error) throw error

  await notifyDriver(driverId, {
    title: 'Subscription renewed',
    body: `Your ${plan.name.charAt(0).toUpperCase() + plan.name.slice(1)} plan has been renewed until ${expiry.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.`,
  })

  return data
}
