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

// A real pg_cron job (update_rider_subscription_statuses, see schema.sql)
// already runs this exact active -> grace_period -> expired transition
// once a day platform-wide. This just calls the same security-definer
// function on demand so a rider who opens the app mid-day sees a
// freshly-correct status instead of waiting for the next cron tick —
// and (since rider_subscriptions no longer accepts a direct client
// update at all) the only way this transition can happen client-side.
export async function checkAndUpdateSubscriptionStatus() {
  const { error } = await supabase.rpc('update_rider_subscription_statuses')
  if (error) throw error
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

// The fraud check, expiry math, and write all now happen inside
// activate_rider_subscription (schema.sql) — rider_subscriptions no
// longer accepts a direct client insert/update at all (see
// SUBSCRIPTION PURCHASE INTEGRITY in schema.sql), since a raw insert
// let any rider set status/expiry_date to whatever they wanted,
// self-granting Family for free. planId/upiReference are user input
// here, not assumed-correct state — the RPC re-derives everything else.
export async function activateSubscription({ riderId, planId, upiReference }) {
  const ref = upiReference.trim()
  if (!ref) throw new Error('Enter the UPI transaction reference to confirm payment.')

  const { data, error } = await supabase.rpc('activate_rider_subscription', {
    p_rider_id: riderId, p_plan_id: planId, p_payment_reference: ref,
  })
  if (error) throw error

  const { data: plan } = await supabase.from('rider_subscription_plans').select('name').eq('id', planId).single()
  await notifyRider(riderId, {
    title: 'Subscription activated',
    body: `Your ${plan?.name ? plan.name.charAt(0).toUpperCase() + plan.name.slice(1) : 'new'} plan is now active until ${new Date(data.expiry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.`,
  })

  return data
}

// Renewal chains off the old expiry if still active, so paid-for days
// are never lost — computed server-side by renew_rider_subscription
// (schema.sql), which re-derives "the current subscription" itself
// rather than trusting the caller's currentSubscription (kept as a
// param only so the UI can decide whether to show "Renew" at all; it's
// never sent to the RPC). Same logic as driver subscriptions.
export async function renewSubscription({ riderId, planId, upiReference }) {
  const ref = upiReference.trim()
  if (!ref) throw new Error('Enter the UPI transaction reference to confirm payment.')

  const { data, error } = await supabase.rpc('renew_rider_subscription', {
    p_rider_id: riderId, p_plan_id: planId, p_payment_reference: ref,
  })
  if (error) throw error

  const { data: plan } = await supabase.from('rider_subscription_plans').select('name').eq('id', planId).single()
  await notifyRider(riderId, {
    title: 'Subscription renewed',
    body: `Your ${plan?.name ? plan.name.charAt(0).toUpperCase() + plan.name.slice(1) : ''} plan has been renewed until ${new Date(data.expiry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.`,
  })

  return data
}

// The effective tier for feature gating (ELIGIBLE_TIERS in
// preferredDrivers.js) — 'none' unless a plan is currently
// active/grace_period. Replaces the old flat users.subscription_tier
// read, which nothing ever wrote to from the rider side.
export async function fetchEffectiveTier(riderId) {
  await checkAndUpdateSubscriptionStatus()
  const current = await fetchCurrentSubscription(riderId)
  if (current && ['active', 'grace_period'].includes(current.status)) {
    return current.rider_subscription_plans?.name ?? 'none'
  }
  return 'none'
}
