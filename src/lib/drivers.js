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

  return (data ?? []).map(d => {
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
    }
  })
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
