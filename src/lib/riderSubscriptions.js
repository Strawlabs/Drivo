import { supabase } from '@/lib/supabase'

export const GRACE_PERIOD_DAYS = 3

// Same UTC-shift pitfall as Go Home Mode / driver subscriptions —
// Date#toISOString() shifts a local-midnight date back a day for
// anyone east of UTC. Format using local getters instead.
function toLocalDateString(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export async function fetchPlans() {
  const { data, error } = await supabase
    .from('rider_subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('price', { ascending: true })
  if (error) throw error
  return data ?? []
}

// No backend cron exists (same constraint as driver subscriptions) —
// expiry/grace-period transitions are computed here, client-side,
// anchored to real dates, called on load before reading status anywhere.
export async function checkAndUpdateSubscriptionStatus(riderId) {
  const { data: rows, error } = await supabase
    .from('rider_subscriptions')
    .select('id, status, expiry_date')
    .eq('rider_id', riderId)
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
      await supabase.from('rider_subscriptions').update({ status: nextStatus }).eq('id', row.id)
    }
  }
}

export async function fetchCurrentSubscription(riderId) {
  const { data, error } = await supabase
    .from('rider_subscriptions')
    .select('*, rider_subscription_plans(*)')
    .eq('rider_id', riderId)
  if (error) throw error

  const rows = data ?? []
  const current = rows
    .filter(r => ['active', 'grace_period'].includes(r.status))
    .sort((a, b) => new Date(b.expiry_date) - new Date(a.expiry_date))[0]
  if (current) return current

  return rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] ?? null
}

export async function fetchSubscriptionHistory(riderId) {
  const { data, error } = await supabase
    .from('rider_subscriptions')
    .select('*, rider_subscription_plans(name, price)')
    .eq('rider_id', riderId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

async function notifyRider(riderId, { title, body }) {
  const { error } = await supabase.from('notifications').insert({
    user_id: riderId,
    category: 'subscription',
    title,
    body,
  })
  if (error) console.error('Failed to send subscription notification:', error)
}

export async function activateSubscription({ riderId, planId, upiReference }) {
  const ref = upiReference.trim()
  if (!ref) throw new Error('Enter the UPI transaction reference to confirm payment.')

  const { data: existing } = await supabase
    .from('rider_subscriptions')
    .select('id')
    .eq('payment_reference', ref)
    .maybeSingle()
  if (existing) throw new Error('This payment reference has already been used. Please check your UPI reference.')

  const { data: plan, error: planError } = await supabase
    .from('rider_subscription_plans')
    .select('*')
    .eq('id', planId)
    .single()
  if (planError) throw planError

  const start = new Date()
  const expiry = new Date(start)
  expiry.setDate(expiry.getDate() + plan.duration_days)

  // A rider can't hold two simultaneously-active plans — same one-
  // current-row-at-a-time rule as driver subscriptions.
  await supabase
    .from('rider_subscriptions')
    .update({ status: 'cancelled' })
    .eq('rider_id', riderId)
    .in('status', ['active', 'grace_period'])

  const { data, error } = await supabase
    .from('rider_subscriptions')
    .insert({
      rider_id: riderId,
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

  await notifyRider(riderId, {
    title: 'Subscription activated',
    body: `Your ${plan.name.charAt(0).toUpperCase() + plan.name.slice(1)} plan is now active until ${expiry.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.`,
  })

  return data
}

// Renewal chains off the old expiry if still active, so paid-for days
// are never lost — same logic as driver subscriptions' renewSubscription.
export async function renewSubscription({ riderId, currentSubscription, planId, upiReference }) {
  const ref = upiReference.trim()
  if (!ref) throw new Error('Enter the UPI transaction reference to confirm payment.')

  const { data: existing } = await supabase
    .from('rider_subscriptions')
    .select('id')
    .eq('payment_reference', ref)
    .maybeSingle()
  if (existing) throw new Error('This payment reference has already been used. Please check your UPI reference.')

  const { data: plan, error: planError } = await supabase
    .from('rider_subscription_plans')
    .select('*')
    .eq('id', planId)
    .single()
  if (planError) throw planError

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const stillActive = currentSubscription?.status === 'active' && new Date(currentSubscription.expiry_date) >= today
  const start = stillActive ? new Date(currentSubscription.expiry_date) : today
  const expiry = new Date(start)
  expiry.setDate(expiry.getDate() + plan.duration_days)

  if (currentSubscription?.id) {
    await supabase.from('rider_subscriptions').update({ status: 'cancelled' }).eq('id', currentSubscription.id)
  }

  const { data, error } = await supabase
    .from('rider_subscriptions')
    .insert({
      rider_id: riderId,
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

  await notifyRider(riderId, {
    title: 'Subscription renewed',
    body: `Your ${plan.name.charAt(0).toUpperCase() + plan.name.slice(1)} plan has been renewed until ${expiry.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.`,
  })

  return data
}

// The effective tier for feature gating (ELIGIBLE_TIERS in
// preferredDrivers.js) — 'none' unless a plan is currently
// active/grace_period. Replaces the old flat users.subscription_tier
// read, which nothing ever wrote to from the rider side.
export async function fetchEffectiveTier(riderId) {
  await checkAndUpdateSubscriptionStatus(riderId)
  const current = await fetchCurrentSubscription(riderId)
  if (current && ['active', 'grace_period'].includes(current.status)) {
    return current.rider_subscription_plans?.name ?? 'none'
  }
  return 'none'
}
