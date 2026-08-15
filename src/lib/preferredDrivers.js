import { supabase } from '@/lib/supabase'

export const ELIGIBLE_TIERS = ['care', 'family']

export async function fetchSubscriptionTier(userId) {
  const { data } = await supabase.from('users').select('subscription_tier').eq('id', userId).maybeSingle()
  return data?.subscription_tier ?? 'none'
}

/*
  Upsert so re-saving a driver the rider previously removed resets it
  to 'pending' rather than erroring on the (rider_id, driver_id) unique
  constraint. Eligibility (subscription tier) is enforced server-side by
  an RLS policy on the insert — this will throw if the rider isn't on
  Care/Family Plan, not just silently no-op.
*/
export async function savePreferredDriver({ riderId, driverId }) {
  const { data, error } = await supabase
    .from('preferred_drivers')
    .upsert(
      { rider_id: riderId, driver_id: driverId, status: 'pending', saved_at: new Date().toISOString() },
      { onConflict: 'rider_id,driver_id' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

export async function fetchPreferredStatus(riderId, driverId) {
  const { data } = await supabase
    .from('preferred_drivers')
    .select('status')
    .eq('rider_id', riderId)
    .eq('driver_id', driverId)
    .neq('status', 'removed')
    .maybeSingle()
  return data?.status ?? null
}

export async function removePreferredDriver(id) {
  const { error } = await supabase.from('preferred_drivers').update({ status: 'removed' }).eq('id', id)
  if (error) throw error
}

export async function fetchPreferredDriversForRider(riderId) {
  const { data, error } = await supabase
    .from('preferred_drivers')
    .select('id, status, saved_at, driver_id, driver_profiles(rating, is_online, upi_id, users(name), vehicles(make, model))')
    .eq('rider_id', riderId)
    .neq('status', 'removed')
    .order('saved_at', { ascending: false })
  if (error) throw error

  const rows = data ?? []
  const withLastRide = await Promise.all(rows.map(async row => {
    const { data: lastRide } = await supabase
      .from('rides')
      .select('completed_at')
      .eq('rider_id', riderId)
      .eq('driver_id', row.driver_id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const dp = row.driver_profiles
    const vehicle = dp?.vehicles?.[0] ?? null
    const name = dp?.users?.name ?? 'Driver'
    return {
      preferredId: row.id,
      status: row.status,
      driverId: row.driver_id,
      name,
      avatar: name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
      rating: dp?.rating ?? 5.0,
      isOnline: dp?.is_online ?? false,
      vehicleId: vehicle?.id ?? null,
      type: vehicle ? [vehicle.make, vehicle.model].filter(Boolean).join(' ') : 'EV',
      lastRideAt: lastRide?.completed_at ?? null,
    }
  }))
  return withLastRide
}

export async function fetchPreferredRidersForDriver(driverProfileId) {
  const { data, error } = await supabase
    .from('preferred_drivers')
    .select('id, status, saved_at, rider_id, users(name)')
    .eq('driver_id', driverProfileId)
    .in('status', ['pending', 'active'])
    .order('saved_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(row => ({
    id: row.id,
    status: row.status,
    savedAt: row.saved_at,
    riderName: row.users?.name ?? 'Rider',
  }))
}

export async function approvePreferredRider(id) {
  const { error } = await supabase.from('preferred_drivers').update({ status: 'active' }).eq('id', id)
  if (error) throw error
}

export async function declinePreferredRider(id) {
  const { error } = await supabase.from('preferred_drivers').update({ status: 'removed' }).eq('id', id)
  if (error) throw error
}

export async function blockPreferredRider(id) {
  const { error } = await supabase.from('preferred_drivers').update({ status: 'blocked_by_driver' }).eq('id', id)
  if (error) throw error
}
