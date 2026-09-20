import { supabase } from '@/lib/supabase'
import { haversineKm } from '@/lib/goHome'

// Generous enough to cover one metro city end-to-end (Bangalore's own
// diagonal is ~35km), tight enough to guarantee a driver from a
// different city never shows up as "nearby." Only applied when both the
// rider's and the driver's real coordinates are known — same "GPS
// optional, don't filter on what you don't have" tradeoff used
// everywhere else in this app (see matchGoHomeRide's driverLoc-optional
// gates) rather than hiding drivers just because location permission
// was denied.
const NEARBY_MAX_KM = 30

/*
  Live pool of drivers a rider can actually book.
  rides.driver_id references driver_profiles(id) — NOT the auth/users id —
  so every caller must use the `id` this returns as the driver identifier.

  `origin` ({lat,lng}, optional) is whoever's asking "who's near me" —
  a rider on the Home/Discovery tabs, or another driver on the Discovery
  tab. Without it, every online driver is returned unfiltered/unsorted
  by distance (the previous behavior) since there's nothing to measure
  from.
*/
export async function fetchAvailableDrivers({ excludeDriverId, origin = null } = {}) {
  let query = supabase
    .from('driver_profiles')
    .select('id, rating, current_latitude, current_longitude, users(name), vehicles(id, make, model, vehicle_type)')
    .eq('status', 'approved')
    .eq('is_online', true)

  if (excludeDriverId) query = query.neq('id', excludeDriverId)

  const { data, error } = await query
  if (error) throw error

  const driverIds = (data ?? []).map(d => d.id)
  const priorityIds = await fetchElitePriorityDriverIds(driverIds)

  let drivers = (data ?? []).map(d => {
    const vehicle = d.vehicles?.[0] ?? null
    const name = d.users?.name?.trim() || 'Driver'
    const lat = d.current_latitude != null ? Number(d.current_latitude) : null
    const lng = d.current_longitude != null ? Number(d.current_longitude) : null
    const distanceKm = (origin && lat != null && lng != null) ? haversineKm(origin.lat, origin.lng, lat, lng) : null
    return {
      id: d.id,
      name,
      avatar: name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
      rating: d.rating ?? 5.0,
      vehicleId: vehicle?.id ?? null,
      type: vehicle ? [vehicle.make, vehicle.model].filter(Boolean).join(' ') : 'EV',
      vehicleType: vehicle?.vehicle_type ?? null,
      isPriority: priorityIds.has(d.id),
      lat, lng,
      distanceKm: distanceKm != null ? Math.round(distanceKm * 10) / 10 : null,
    }
  })

  if (origin) {
    drivers = drivers.filter(d => d.distanceKm == null || d.distanceKm <= NEARBY_MAX_KM)
  }

  // Elite subscribers surface first (the "priority visibility" benefit),
  // then nearest-first within each group — unknown distance sorts last
  // rather than being guessed at.
  return drivers.sort((a, b) => {
    if (a.isPriority !== b.isPriority) return a.isPriority ? -1 : 1
    if (a.distanceKm == null && b.distanceKm == null) return 0
    if (a.distanceKm == null) return 1
    if (b.distanceKm == null) return -1
    return a.distanceKm - b.distanceKm
  })
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
  Just enough to render an active-ride card — used when the dispatch
  engine (dispatch_pending_rides, see schema.sql) assigns a driver the
  rider never picked themselves, so ActiveRidePage has a real name/rating/
  vehicle to show instead of nothing. fetchDriverProfile below fetches
  much more (reviews, tier, KYC) than that screen needs.
*/
export async function fetchDriverBasicInfo(driverId) {
  const { data, error } = await supabase
    .from('driver_profiles')
    .select('id, rating, users(name), vehicles(make, model, vehicle_type)')
    .eq('id', driverId)
    .maybeSingle()
  if (error || !data) return null
  const vehicle = data.vehicles?.[0] ?? null
  const name = data.users?.name?.trim() || 'Driver'
  return {
    id: data.id,
    name,
    avatar: name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
    rating: data.rating ?? 5.0,
    type: vehicle ? [vehicle.make, vehicle.model].filter(Boolean).join(' ') : 'EV',
  }
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
/*
  The actual averaging + write now happens inside recalculate_driver_rating
  (schema.sql) — this used to write directly to driver_profiles, but that
  table's UPDATE policy only ever allowed the owning driver or an admin,
  never the rider who just submitted the review that triggers this call.
  The result: every call from this (the only call site) silently affected
  zero rows — no error, since RLS just filters non-matching rows on
  UPDATE — so driver ratings had been frozen since that policy existed.
  Confirmed live during an end-to-end regression pass. The RPC is safe to
  leave open to any authenticated caller since it only recomputes from
  real ride_ratings rows, never from caller-supplied numbers.
*/
export async function recalculateDriverRating(driverId) {
  const { error } = await supabase.rpc('recalculate_driver_rating', { p_driver_id: driverId })
  if (error) throw error
}
