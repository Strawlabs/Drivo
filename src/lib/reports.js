import { supabase } from '@/lib/supabase'

const DAY_MS = 24 * 60 * 60 * 1000
const HISTORY_DAYS = 180

export const REPORT_PERIODS = ['Daily', 'Weekly', 'Monthly']

const BUCKET_CONFIG = {
  Daily:   { count: 7, unitMs: DAY_MS,      label: d => d.toLocaleDateString('en-IN', { weekday: 'short' }) },
  Weekly:  { count: 6, unitMs: 7 * DAY_MS,  label: d => `${d.getDate()}/${d.getMonth() + 1}` },
  Monthly: { count: 6, unitMs: 30 * DAY_MS, label: d => d.toLocaleDateString('en-IN', { month: 'short' }) },
}

function bucketize(rows, dateField, period) {
  const { count, unitMs, label } = BUCKET_CONFIG[period]
  const now = Date.now()
  const buckets = Array.from({ length: count }, (_, i) => {
    const bucketStart = now - (count - i) * unitMs
    const bucketEnd = bucketStart + unitMs
    const matching = rows.filter(r => {
      const t = new Date(r[dateField]).getTime()
      return t >= bucketStart && t < bucketEnd
    })
    return { label: label(new Date(bucketStart)), rows: matching }
  })
  return buckets
}

/*
  Fetches everything the admin Reports panel needs in one pass, over
  a 180-day window — mirrors src/lib/earnings.js's approach (fetch raw
  rows once, bucket/sum client-side) since PostgREST has no generic
  GROUP BY and this project's data volume is small.
*/
export async function fetchPlatformData() {
  const since = new Date(Date.now() - HISTORY_DAYS * DAY_MS).toISOString()

  const [driversRes, ridesRes, subsRes, prefRes, campaignsRes, assignmentsRes, vehiclesRes] = await Promise.all([
    supabase.from('driver_profiles').select('id, status, created_at'),
    supabase.from('rides').select('id, status, created_at, final_fare, estimated_fare').gte('created_at', since),
    supabase.from('driver_subscriptions').select('id, status, created_at, subscription_plans(name, price)').gte('created_at', since),
    supabase.from('preferred_drivers').select('id, status, saved_at').gte('saved_at', since),
    supabase.from('ad_campaigns').select('id, status, revenue_share_percent'),
    supabase.from('driver_campaign_assignments').select('id, status, earnings_credited, assigned_at').gte('assigned_at', since),
    supabase.from('vehicles').select('id, vehicle_type'),
  ])

  return {
    drivers: driversRes.data ?? [],
    rides: ridesRes.data ?? [],
    subscriptions: subsRes.data ?? [],
    preferred: prefRes.data ?? [],
    campaigns: campaignsRes.data ?? [],
    assignments: assignmentsRes.data ?? [],
    vehicles: vehiclesRes.data ?? [],
  }
}

export function summarizeReports(data, period) {
  const { drivers, rides, subscriptions, preferred, campaigns, assignments, vehicles } = data

  // Driver growth — new signups per bucket, plus current approved total.
  const driverBuckets = bucketize(drivers, 'created_at', period).map(b => ({ label: b.label, newDrivers: b.rows.length }))
  const totalApproved = drivers.filter(d => d.status === 'approved').length
  const totalDrivers = drivers.length

  // Ride volume — requested vs completed per bucket.
  const rideBuckets = bucketize(rides, 'created_at', period).map(b => ({
    label: b.label,
    total: b.rows.length,
    completed: b.rows.filter(r => r.status === 'completed').length,
  }))
  const totalRidesAllTime = rides.length

  // Revenue — subscription revenue (real platform revenue per the
  // product model: drivers pay Drivo directly, ride fares go straight
  // to drivers) plus ad revenue credited to drivers.
  const revenueBuckets = bucketize(subscriptions, 'created_at', period).map((b, i) => {
    const subRevenue = b.rows.reduce((sum, s) => sum + Number(s.subscription_plans?.price ?? 0), 0)
    const adBucket = bucketize(assignments, 'assigned_at', period)[i]
    const adRevenue = adBucket.rows.reduce((sum, a) => sum + Number(a.earnings_credited ?? 0), 0)
    return { label: b.label, subscriptionRevenue: subRevenue, adRevenue, total: subRevenue + adRevenue }
  })
  const totalSubscriptionRevenue = subscriptions.reduce((sum, s) => sum + Number(s.subscription_plans?.price ?? 0), 0)
  const totalAdRevenue = assignments.reduce((sum, a) => sum + Number(a.earnings_credited ?? 0), 0)

  // Subscription mix — current snapshot by plan name, active/grace only.
  const activeSubs = subscriptions.filter(s => ['active', 'grace_period'].includes(s.status))
  const subscriptionMix = ['basic', 'pro', 'elite'].map(name => ({
    plan: name,
    count: activeSubs.filter(s => s.subscription_plans?.name === name).length,
  }))

  // EV fleet mix — this platform is 100% EV by schema design, so the
  // real metric is the auto/car split, not an "adoption %" against
  // non-EV vehicles that structurally can't exist here.
  const evFleetMix = ['ev_auto', 'ev_car'].map(type => ({
    type,
    count: vehicles.filter(v => v.vehicle_type === type).length,
  }))

  // Preferred-driver usage — new saves per bucket, plus current active total.
  const preferredBuckets = bucketize(preferred, 'saved_at', period).map(b => ({ label: b.label, newSaves: b.rows.length }))
  const totalActivePreferred = preferred.filter(p => p.status === 'active').length

  // Advertising performance — campaign lifecycle + assignment acceptance.
  const campaignsByStatus = ['draft', 'active', 'completed', 'cancelled'].map(status => ({
    status,
    count: campaigns.filter(c => c.status === status).length,
  }))
  const totalAssignments = assignments.length
  const acceptedOrCompleted = assignments.filter(a => ['accepted', 'completed'].includes(a.status)).length
  const acceptanceRate = totalAssignments === 0 ? 0 : Math.round((acceptedOrCompleted / totalAssignments) * 100)

  return {
    driverGrowth: { buckets: driverBuckets, totalApproved, totalDrivers },
    rideVolume: { buckets: rideBuckets, totalRidesAllTime },
    revenue: { buckets: revenueBuckets, totalSubscriptionRevenue, totalAdRevenue, totalRevenue: totalSubscriptionRevenue + totalAdRevenue },
    subscriptionMix,
    evFleetMix,
    preferredDriverUsage: { buckets: preferredBuckets, totalActivePreferred },
    advertisingPerformance: { campaignsByStatus, totalAssignments, acceptanceRate, totalCredited: totalAdRevenue },
  }
}
