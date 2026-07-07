import { supabase } from '@/lib/supabase'

export const SCHEDULE_MIN_LEAD_MINUTES = 10

// ── Family members ──────────────────────────────────────────────

export async function fetchFamilyMembers(userId) {
  const { data, error } = await supabase
    .from('family_accounts')
    .select('id, status, member_user_id, created_at, users:member_user_id(name, phone)')
    .eq('primary_user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
  if (error) throw error

  const rows = data ?? []
  return Promise.all(rows.map(async row => {
    const { data: lastRide } = await supabase
      .from('rides')
      .select('completed_at')
      .eq('rider_id', row.member_user_id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const name = row.users?.name ?? 'Member'
    return {
      id: row.id,
      memberUserId: row.member_user_id,
      name,
      avatar: name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
      lastRideAt: lastRide?.completed_at ?? null,
    }
  }))
}

export async function fetchPendingInvitesSent(userId) {
  const { data, error } = await supabase
    .from('family_accounts')
    .select('id, member_user_id, users:member_user_id(name, phone)')
    .eq('primary_user_id', userId)
    .eq('status', 'pending')
  if (error) throw error
  return (data ?? []).map(row => ({ id: row.id, name: row.users?.name ?? 'Member', phone: row.users?.phone ?? '' }))
}

export async function fetchPendingInvitesReceived(userId) {
  const { data, error } = await supabase
    .from('family_accounts')
    .select('id, primary_user_id, users:primary_user_id(name)')
    .eq('member_user_id', userId)
    .eq('status', 'pending')
  if (error) throw error
  return (data ?? []).map(row => ({ id: row.id, ownerName: row.users?.name ?? 'Someone' }))
}

/*
  A family member must already be a registered rider — this schema has
  no invite-by-non-user mechanism. Looked up by phone since that's the
  identifier riders actually know for each other (not email/id).
*/
export async function addFamilyMember({ primaryUserId, phone }) {
  const cleanPhone = phone.trim()
  const { data: member, error: lookupError } = await supabase
    .from('users')
    .select('id, role')
    .eq('phone', cleanPhone)
    .maybeSingle()
  if (lookupError) throw lookupError
  if (!member) throw new Error('No Drivo account found with that phone number.')
  if (member.id === primaryUserId) throw new Error("You can't add yourself as a family member.")
  if (member.role !== 'rider') throw new Error('Only rider accounts can be added as family members.')

  const { data, error } = await supabase
    .from('family_accounts')
    .upsert(
      { primary_user_id: primaryUserId, member_user_id: member.id, status: 'pending' },
      { onConflict: 'primary_user_id,member_user_id' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

export async function approveFamilyInvite(id) {
  const { error } = await supabase.from('family_accounts').update({ status: 'active' }).eq('id', id)
  if (error) throw error
}

export async function declineFamilyInvite(id) {
  const { error } = await supabase.from('family_accounts').update({ status: 'removed' }).eq('id', id)
  if (error) throw error
}

export async function removeFamilyMember(id) {
  const { error } = await supabase.from('family_accounts').update({ status: 'removed' }).eq('id', id)
  if (error) throw error
}

// ── Emergency contacts (Safety Net) ─────────────────────────────

export async function fetchEmergencyContacts(userId) {
  const { data, error } = await supabase.from('emergency_contacts').select('*').eq('user_id', userId).order('created_at')
  if (error) throw error
  return data ?? []
}

export async function addEmergencyContact({ userId, name, phone }) {
  const { data, error } = await supabase.from('emergency_contacts').insert({ user_id: userId, name, phone }).select().single()
  if (error) throw error
  return data
}

export async function deleteEmergencyContact(id) {
  const { error } = await supabase.from('emergency_contacts').delete().eq('id', id)
  if (error) throw error
}

// ── Live ride monitoring ─────────────────────────────────────────

export async function fetchActiveFamilyRide(userId) {
  const { data: members, error: membersError } = await supabase
    .from('family_accounts')
    .select('member_user_id, users:member_user_id(name)')
    .eq('primary_user_id', userId)
    .eq('status', 'active')
  if (membersError) throw membersError

  const memberIds = (members ?? []).map(m => m.member_user_id)
  if (memberIds.length === 0) return null

  const { data: ride, error } = await supabase
    .from('rides')
    .select('id, rider_id, status, pickup_address, destination_address, created_at')
    .in('rider_id', memberIds)
    .in('status', ['accepted', 'active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!ride) return null

  const memberInfo = members.find(m => m.member_user_id === ride.rider_id)
  return { ...ride, riderName: memberInfo?.users?.name ?? 'Family member' }
}

// ── Scheduled rides ──────────────────────────────────────────────

export function validateScheduledTime(date) {
  const minTime = new Date(Date.now() + SCHEDULE_MIN_LEAD_MINUTES * 60000)
  if (!(date instanceof Date) || isNaN(date) || date <= minTime) {
    throw new Error(`Please choose a time at least ${SCHEDULE_MIN_LEAD_MINUTES} minutes from now.`)
  }
}

export async function checkDriverAvailability({ driverId, scheduledAt, windowMinutes = 60 }) {
  if (!driverId) return true
  const windowStart = new Date(scheduledAt.getTime() - windowMinutes * 60000).toISOString()
  const windowEnd = new Date(scheduledAt.getTime() + windowMinutes * 60000).toISOString()
  const { data, error } = await supabase
    .from('scheduled_rides')
    .select('id')
    .eq('preferred_driver_id', driverId)
    .in('status', ['scheduled', 'dispatched'])
    .gte('scheduled_at', windowStart)
    .lte('scheduled_at', windowEnd)
  if (error) throw error
  return (data ?? []).length === 0
}

export async function scheduleRide({ requestedBy, riderId, preferredDriverId, pickupAddress, destinationAddress, scheduledAt }) {
  validateScheduledTime(scheduledAt)
  if (!pickupAddress || !destinationAddress) throw new Error('Pickup and destination are required.')

  if (preferredDriverId) {
    const available = await checkDriverAvailability({ driverId: preferredDriverId, scheduledAt })
    if (!available) throw new Error('This driver already has another ride scheduled around that time. Try a different time or driver.')
  }

  const { data, error } = await supabase
    .from('scheduled_rides')
    .insert({
      requested_by: requestedBy,
      rider_id: riderId,
      preferred_driver_id: preferredDriverId ?? null,
      pickup_address: pickupAddress,
      destination_address: destinationAddress,
      scheduled_at: scheduledAt.toISOString(),
      status: 'scheduled',
    })
    .select()
    .single()
  if (error) throw error

  const when = scheduledAt.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  const notifyTargets = riderId === requestedBy ? [requestedBy] : [requestedBy, riderId]
  await supabase.from('notifications').insert(
    notifyTargets.map(uid => ({
      user_id: uid,
      category: 'ride_alert',
      title: 'Ride scheduled',
      body: `Ride from ${pickupAddress} to ${destinationAddress} is scheduled for ${when}.`,
    }))
  )

  return data
}

export async function fetchUpcomingScheduledRides(userId) {
  const { data, error } = await supabase
    .from('scheduled_rides')
    .select(`
      id, rider_id, preferred_driver_id, pickup_address, destination_address, scheduled_at, status,
      users:rider_id(name),
      driver_profiles:preferred_driver_id(users(name)),
      rides:ride_id(status, cancellation_reason)
    `)
    .eq('requested_by', userId)
    .in('status', ['scheduled', 'dispatched'])
    .order('scheduled_at', { ascending: true })
  if (error) throw error

  return (data ?? []).map(row => {
    const rideCancelled = row.rides?.status === 'cancelled'
    return {
      id: row.id,
      riderName: row.users?.name ?? 'You',
      driverName: row.driver_profiles?.users?.name ?? 'Any Driver',
      pickup: row.pickup_address,
      destination: row.destination_address,
      scheduledAt: row.scheduled_at,
      status: rideCancelled ? 'driver_cancelled' : row.status,
      cancellationReason: row.rides?.cancellation_reason ?? null,
    }
  })
}

export async function cancelScheduledRide(id, reason = 'Cancelled by user') {
  const { error } = await supabase.from('scheduled_rides').update({ status: 'cancelled', cancellation_reason: reason }).eq('id', id)
  if (error) throw error
}

/*
  No backend cron exists in this app — every scheduled/timed feature
  here (Go Home Mode, UPI timeout) is dispatched client-side, anchored
  to a real DB timestamp so it still works correctly after a reload.
  This only fires while the rider has the app open at/after the
  scheduled time; it does not fire in the background.
*/
export async function dispatchDueScheduledRides(userId) {
  const nowIso = new Date().toISOString()
  const { data: due, error } = await supabase
    .from('scheduled_rides')
    .select('*')
    .eq('requested_by', userId)
    .eq('status', 'scheduled')
    .lte('scheduled_at', nowIso)
  if (error) throw error
  if (!due || due.length === 0) return []

  const dispatched = []
  for (const sr of due) {
    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .insert({
        rider_id: sr.rider_id,
        driver_id: sr.preferred_driver_id ?? null,
        pickup_address: sr.pickup_address,
        destination_address: sr.destination_address,
        status: 'requested',
      })
      .select()
      .single()
    if (rideError) continue

    await supabase.from('scheduled_rides').update({ status: 'dispatched', ride_id: ride.id }).eq('id', sr.id)
    await supabase.from('notifications').insert({
      user_id: sr.rider_id,
      category: 'ride_alert',
      title: 'Scheduled ride starting',
      body: `Your scheduled ride to ${sr.destination_address} is now being requested.`,
    })
    dispatched.push({ ...sr, rideId: ride.id })
  }
  return dispatched
}
