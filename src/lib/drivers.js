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
  Full public profile for a single driver — backs the rider-facing
  "View Profile" screen. Tier name comes from the driver's current
  active/grace_period subscription (falls back to null → "Basic").
  Reviews are read from ride_ratings, which already has an open
  dev-read policy (see schema.sql), same as the rest of this file's
  queries against driver_profiles/vehicles.
*/
export async function fetchDriverProfile(driverId) {
  const { data: profile, error } = await supabase
    .from('driver_profiles')
    .select('id, rating, total_rides, kyc_status, created_at, users(name), vehicles(make, model, vehicle_type, registration_number, is_verified)')
    .eq('id', driverId)
    .single()
  if (error) throw error

  const { data: subRows } = await supabase
    .from('driver_subscriptions')
    .select('status, subscription_plans(name)')
    .eq('driver_id', driverId)
    .in('status', ['active', 'grace_period'])
  const tier = (subRows ?? []).map(r => r.subscription_plans?.name).find(Boolean) ?? 'basic'

  const { data: reviewRows } = await supabase
    .from('ride_ratings')
    .select('rating, review, created_at, users(name)')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false })
    .limit(10)

  const name = profile.users?.name?.trim() || 'Driver'
  const vehicle = profile.vehicles?.[0] ?? null
  const partnerSinceYears = Math.max(0, Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (365 * 24 * 60 * 60 * 1000)))

  return {
    id: profile.id,
    name,
    avatar: name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
    rating: profile.rating ?? 5.0,
    totalRides: profile.total_rides ?? 0,
    tier,
    kycVerified: profile.kyc_status === 'approved',
    partnerSinceYears,
    vehicle: vehicle ? {
      label: [vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'EV Vehicle',
      registrationNumber: vehicle.registration_number,
      isVerified: vehicle.is_verified,
      isEvCertified: vehicle.vehicle_type === 'ev_auto' || vehicle.vehicle_type === 'ev_car',
    } : null,
    reviews: (reviewRows ?? []).map(r => ({
      riderName: r.users?.name?.trim() || 'Rider',
      rating: r.rating,
      review: r.review,
      createdAt: r.created_at,
    })),
  }
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
