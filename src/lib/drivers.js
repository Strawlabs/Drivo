import { supabase } from '@/lib/supabase'

/*
  Live pool of drivers a rider can actually book.
  rides.driver_id references driver_profiles(id) — NOT the auth/users id —
  so every caller must use the `id` this returns as the driver identifier.
*/
export async function fetchAvailableDrivers({ excludeDriverId } = {}) {
  let query = supabase
    .from('driver_profiles')
    .select('id, rating, users(name), vehicles(id, make, model, vehicle_type)')
    .eq('status', 'approved')
    .eq('is_online', true)

  if (excludeDriverId) query = query.neq('id', excludeDriverId)

  const { data, error } = await query
  if (error) throw error

  const driverIds = (data ?? []).map(d => d.id)
  const priorityIds = await fetchElitePriorityDriverIds(driverIds)

  const drivers = (data ?? []).map(d => {
    const vehicle = d.vehicles?.[0] ?? null
    const name = d.users?.name?.trim() || 'Driver'
    return {
      id: d.id,
      name,
      avatar: name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
      rating: d.rating ?? 5.0,
      vehicleId: vehicle?.id ?? null,
      type: vehicle ? [vehicle.make, vehicle.model].filter(Boolean).join(' ') : 'EV',
      vehicleType: vehicle?.vehicle_type ?? null,
      isPriority: priorityIds.has(d.id),
    }
  })

  // Elite subscribers surface first — the "priority visibility" benefit.
  return drivers.sort((a, b) => (b.isPriority === a.isPriority) ? 0 : b.isPriority ? 1 : -1)
}

/*
  Elite is the only tier that grants priority placement (see
  src/lib/subscriptions.js scope decision). Active or grace_period
  both still count as "currently subscribed" — access doesn't drop
  the instant a renewal is late.
*/
async function fetchElitePriorityDriverIds(driverIds) {
  if (driverIds.length === 0) return new Set()

  const { data, error } = await supabase
    .from('driver_subscriptions')
    .select('driver_id, status, subscription_plans(name)')
    .in('driver_id', driverIds)
    .in('status', ['active', 'grace_period'])
  if (error) return new Set()

  return new Set((data ?? []).filter(row => row.subscription_plans?.name === 'elite').map(row => row.driver_id))
}

/*
  Recomputes driver_profiles.rating as the plain average of every
  ride_ratings row for that driver, and keeps total_rides in sync.
  Called after a rider submits a review so the reputation score
  actually reflects submitted reviews (there's no DB trigger for this).
*/
export async function recalculateDriverRating(driverId) {
  const { data, error } = await supabase
    .from('ride_ratings')
    .select('rating')
    .eq('driver_id', driverId)
  if (error) throw error

  const ratings = data ?? []
  if (ratings.length === 0) return

  const average = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length

  const { error: updateErr } = await supabase
    .from('driver_profiles')
    .update({ rating: Math.round(average * 100) / 100, total_rides: ratings.length })
    .eq('id', driverId)
  if (updateErr) throw updateErr
}
