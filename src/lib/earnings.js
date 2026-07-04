import { supabase } from '@/lib/supabase'

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export const PERIOD_DAYS = { Daily: 1, Weekly: 7, Monthly: 30 }

/*
  Fetches everything the driver earnings dashboard needs in one pass —
  completed payments (with ride + rider info) and ad campaign earnings for
  the last 90 days, plus which riders have this driver saved as preferred.
  Period totals/trend bars are computed client-side from this: PostgREST
  has no generic GROUP BY, and 90 days of one driver's activity is small
  enough to aggregate in the browser without a custom SQL function.
*/
export async function fetchDriverEarnings(driverId) {
  const since = startOfDay(new Date(Date.now() - 90 * DAY_MS)).toISOString()

  const [paymentsRes, adRes, preferredRes] = await Promise.all([
    supabase
      .from('payments')
      .select('id, amount, paid_at, method, ride_id, rider_id, rides(pickup_address, destination_address, distance_km), users(name)')
      .eq('driver_id', driverId)
      .eq('status', 'completed')
      .gte('paid_at', since)
      .order('paid_at', { ascending: false }),
    supabase
      .from('driver_campaign_assignments')
      .select('earnings_credited, assigned_at')
      .eq('driver_id', driverId)
      .gte('assigned_at', since),
    supabase
      .from('preferred_drivers')
      .select('rider_id')
      .eq('driver_id', driverId)
      .eq('status', 'active'),
  ])

  const payments = (paymentsRes.data ?? []).map(p => ({ ...p, paidAt: new Date(p.paid_at) }))
  const adEarnings = (adRes.data ?? []).map(a => ({ ...a, assignedAt: new Date(a.assigned_at) }))
  const preferredRiderIds = new Set((preferredRes.data ?? []).map(r => r.rider_id))

  return { payments, adEarnings, preferredRiderIds }
}

export function summarizeForPeriod({ payments, adEarnings, preferredRiderIds }, period) {
  const since = new Date(Date.now() - PERIOD_DAYS[period] * DAY_MS)
  const periodPayments = payments.filter(p => p.paidAt >= since)
  const periodAd = adEarnings.filter(a => a.assignedAt >= since)

  const grossPayments = periodPayments.reduce((sum, p) => sum + Number(p.amount), 0)
  const preferredTotal = periodPayments
    .filter(p => preferredRiderIds.has(p.rider_id))
    .reduce((sum, p) => sum + Number(p.amount), 0)
  const adTotal = periodAd.reduce((sum, a) => sum + Number(a.earnings_credited ?? 0), 0)

  return {
    total: grossPayments + adTotal,
    ridePayments: grossPayments - preferredTotal,
    preferredRiderRides: preferredTotal,
    adRevenue: adTotal,
    tripCount: periodPayments.length,
    periodPayments,
  }
}

const BUCKET_CONFIG = {
  Daily:   { count: 7, unitMs: DAY_MS,      label: d => d.toLocaleDateString('en-IN', { weekday: 'short' }) },
  Weekly:  { count: 6, unitMs: 7 * DAY_MS,  label: d => `${d.getDate()}/${d.getMonth() + 1}` },
  Monthly: { count: 6, unitMs: 30 * DAY_MS, label: d => d.toLocaleDateString('en-IN', { month: 'short' }) },
}

export function bucketTrend({ payments, adEarnings }, period) {
  const { count, unitMs, label } = BUCKET_CONFIG[period]
  const now = Date.now()
  const buckets = []
  for (let i = count - 1; i >= 0; i--) {
    const end = new Date(now - i * unitMs)
    const start = new Date(now - (i + 1) * unitMs)
    const value =
      payments.filter(p => p.paidAt >= start && p.paidAt < end).reduce((s, p) => s + Number(p.amount), 0) +
      adEarnings.filter(a => a.assignedAt >= start && a.assignedAt < end).reduce((s, a) => s + Number(a.earnings_credited ?? 0), 0)
    buckets.push({ label: label(end), value })
  }
  return buckets
}

/* CSV report for the given period — one row per completed, paid ride. */
export function buildEarningsReportCsv(periodPayments, period) {
  const header = ['Date', 'Time', 'Rider', 'Pickup', 'Destination', 'Distance (km)', 'Method', 'Amount (INR)']
  const rows = periodPayments.map(p => [
    p.paidAt.toLocaleDateString('en-IN'),
    p.paidAt.toLocaleTimeString('en-IN'),
    p.users?.name ?? '—',
    p.rides?.pickup_address ?? '—',
    p.rides?.destination_address ?? '—',
    p.rides?.distance_km ?? '—',
    p.method.toUpperCase(),
    Number(p.amount).toFixed(2),
  ])
  const csvEscape = v => `"${String(v).replace(/"/g, '""')}"`
  const lines = [header, ...rows].map(row => row.map(csvEscape).join(','))
  return `Drivo Earnings Report — ${period}\n` + lines.join('\n')
}
