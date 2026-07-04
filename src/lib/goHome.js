import { supabase } from '@/lib/supabase'

/*
  <input type="datetime-local"> values are naive local time with no
  timezone info — Date#toISOString() is UTC, so using it to seed the
  input's value silently shifts the displayed time by the browser's UTC
  offset (e.g. showing a time hours in the past for anyone in IST).
  Format using local getters instead.
*/
export function toLocalDatetimeInputValue(date) {
  const pad = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/*
  Approximate real coordinates for well-known Bangalore areas already
  referenced elsewhere in the app's mock/default addresses (BookRidePage's
  default destination is "MG Road Metro Station", for instance) — used
  since there's no live geocoding/Google Maps integration yet.
*/
export const HOME_ZONES = [
  { name: 'MG Road',         lat: 12.9757, lng: 77.6079 },
  { name: 'Koramangala',     lat: 12.9352, lng: 77.6146 },
  { name: 'HSR Layout',      lat: 12.9116, lng: 77.6412 },
  { name: 'Indiranagar',     lat: 12.9784, lng: 77.6408 },
  { name: 'Whitefield',      lat: 12.9698, lng: 77.7500 },
  { name: 'Electronic City', lat: 12.8452, lng: 77.6602 },
  { name: 'Silk Board',      lat: 12.9172, lng: 77.6228 },
  { name: 'Jayanagar',       lat: 12.9250, lng: 77.5938 },
]

const MIN_RADIUS_KM = 1
const MAX_RADIUS_KM = 15
const MAX_HOURS_AHEAD = 8

export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function validateGoHomeInput({ zoneName, radiusKm, endTime }) {
  const zone = HOME_ZONES.find(z => z.name === zoneName)
  if (!zone) return 'Pick a valid home zone.'
  if (!(radiusKm >= MIN_RADIUS_KM && radiusKm <= MAX_RADIUS_KM)) {
    return `Radius must be between ${MIN_RADIUS_KM} and ${MAX_RADIUS_KM} km.`
  }
  const end = new Date(endTime)
  const now = new Date()
  if (Number.isNaN(end.getTime()) || end <= now) {
    return 'End time must be in the future.'
  }
  if (end - now > MAX_HOURS_AHEAD * 60 * 60 * 1000) {
    return `End time can't be more than ${MAX_HOURS_AHEAD} hours from now.`
  }
  return null
}

export async function activateGoHome({ driverId, zoneName, radiusKm, endTime, note }) {
  const error = validateGoHomeInput({ zoneName, radiusKm, endTime })
  if (error) throw new Error(error)
  const zone = HOME_ZONES.find(z => z.name === zoneName)

  // Only one active session per driver at a time
  await supabase.from('go_home_sessions').update({ status: 'cancelled' })
    .eq('driver_id', driverId).eq('status', 'active')

  const { data, error: insertErr } = await supabase.from('go_home_sessions').insert({
    driver_id: driverId,
    home_zone_latitude: zone.lat,
    home_zone_longitude: zone.lng,
    home_zone_radius_km: radiusKm,
    preferred_route: { zone_name: zoneName, note: note || null },
    end_time: new Date(endTime).toISOString(),
    status: 'active',
  }).select().single()
  if (insertErr) throw insertErr
  return data
}

export async function deactivateGoHome(sessionId, status = 'cancelled') {
  const { error } = await supabase.from('go_home_sessions').update({ status }).eq('id', sessionId)
  if (error) throw error
}

export async function fetchActiveGoHomeSession(driverId) {
  const { data } = await supabase
    .from('go_home_sessions')
    .select('*')
    .eq('driver_id', driverId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  if (new Date(data.end_time) <= new Date()) {
    await deactivateGoHome(data.id, 'expired')
    return null
  }
  return data
}

// Naive text match: does the address mention a known zone name? Without
// real geocoding this is the only way to approximate where a ride's
// destination actually is.
export function findZoneForAddress(address) {
  if (!address) return null
  const lower = address.toLowerCase()
  return HOME_ZONES.find(z => lower.includes(z.name.toLowerCase())) ?? null
}

export function matchGoHomeRide(ride, session) {
  const destZone = findZoneForAddress(ride.destination_address)
  if (!destZone) return { compatible: false, distanceKm: null }
  const distanceKm = haversineKm(destZone.lat, destZone.lng, session.home_zone_latitude, session.home_zone_longitude)
  return { compatible: distanceKm <= session.home_zone_radius_km, distanceKm: Math.round(distanceKm * 10) / 10 }
}
