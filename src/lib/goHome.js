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

// ── matchGoHomeRide tuning ───────────────────────────────────
// A ride is only surfaced to a driver in Go Home Mode if it clears every
// hard gate below. The gates that need the driver's live position are
// skipped when it isn't available, so a match still works from the ride's
// own pickup/destination coordinates alone.
const V_CITY_KMH        = 20    // ETA assumption — matches handleCompleteRide's distance approximation
const PROGRESS_MIN_KM   = 2.0   // absolute homeward gain required (distance-to-home at pickup minus at drop-off)
const PROGRESS_MIN_FRAC = 0.25  // …and at least this fraction of the distance that was still left to home
const DROP_SLACK_KM     = 2.0   // how far past the home-zone radius a drop-off can still count
const PICKUP_MAX_KM     = 2.5   // furthest the driver will backtrack to reach the pickup
const BEARING_MAX_DEG   = 60    // max heading deviation between "toward home" and "toward drop-off"
const BUFFER_MIN        = 10    // minutes of slack that must remain before end_time once the ride ends
const DETOUR_RATIO_MAX  = 1.6   // (drive to pickup + the ride) vs. driving straight home
const TYPICAL_FARE      = 300   // normaliser for the fare term in the score

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

// Fallback only: does the address mention a known zone name? Used when a
// ride was stored without real pickup/destination coordinates — newer
// rides carry lat/lng straight from the booking screen and skip this.
export function findZoneForAddress(address) {
  if (!address) return null
  const lower = address.toLowerCase()
  return HOME_ZONES.find(z => lower.includes(z.name.toLowerCase())) ?? null
}

function coord(lat, lng) {
  if (lat == null || lng == null) return null
  const la = Number(lat)
  const ln = Number(lng)
  return (Number.isNaN(la) || Number.isNaN(ln)) ? null : { lat: la, lng: ln }
}

// Initial great-circle bearing from point 1 to point 2, in degrees (0–360).
export function bearingDeg(lat1, lng1, lat2, lng2) {
  const toRad = d => d * Math.PI / 180
  const p1 = toRad(lat1)
  const p2 = toRad(lat2)
  const dLng = toRad(lng2 - lng1)
  const y = Math.sin(dLng) * Math.cos(p2)
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dLng)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

// Smallest angle between two bearings (0–180).
export function bearingDiffDeg(a, b) {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

function incompatibleMatch(reason) {
  return { compatible: false, score: -Infinity, progressKm: null, dropGapKm: null, etaMin: null, reason, distanceKm: null }
}

/*
  Scores an incoming ride request against an active Go Home session.

  Returns { compatible, score, progressKm, dropGapKm, etaMin, reason, distanceKm }.
  · compatible — cleared every hard gate; only these should be shown to the driver
  · score      — higher means more "on the way home"; rank several candidates by it
  · progressKm — how much closer to home the ride nets the driver (pickup vs. drop-off)
  · dropGapKm  — distance from home at drop-off
  · distanceKm — kept as an alias of dropGapKm for older callers

  driverLoc ({lat,lng}) is optional. Without it the pickup-detour and
  bearing gates are skipped and the ride's own pickup is used as the
  anchor, so a match is still possible from ride coordinates alone.
*/
export function matchGoHomeRide(ride, session, driverLoc = null) {
  if (session?.home_zone_latitude == null || session?.home_zone_longitude == null) {
    return incompatibleMatch('session has no home point')
  }
  const H = { lat: Number(session.home_zone_latitude), lng: Number(session.home_zone_longitude) }
  const radiusKm = Number(session.home_zone_radius_km) || 3

  // Prefer the ride's real coordinates; fall back to a name match on the
  // address for older rides stored without lat/lng.
  let Q = coord(ride.destination_latitude, ride.destination_longitude)
  if (!Q) {
    const z = findZoneForAddress(ride.destination_address)
    if (!z) return incompatibleMatch('no destination coordinates')
    Q = { lat: z.lat, lng: z.lng }
  }
  let P = coord(ride.pickup_latitude, ride.pickup_longitude)
  if (!P) {
    const z = findZoneForAddress(ride.pickup_address)
    P = z ? { lat: z.lat, lng: z.lng } : null
  }

  const haveDriverLoc = Boolean(driverLoc && driverLoc.lat != null && driverLoc.lng != null)
  const D = haveDriverLoc ? { lat: Number(driverLoc.lat), lng: Number(driverLoc.lng) } : P

  const gapDrop      = haversineKm(Q.lat, Q.lng, H.lat, H.lng)
  const gapPickup    = P ? haversineKm(P.lat, P.lng, H.lat, H.lng) : null
  const rideDist     = P ? haversineKm(P.lat, P.lng, Q.lat, Q.lng) : null
  const progress     = gapPickup != null ? gapPickup - gapDrop : null
  const pickupDetour = (D && P) ? haversineKm(D.lat, D.lng, P.lat, P.lng) : null
  const straightHome = D ? haversineKm(D.lat, D.lng, H.lat, H.lng) : gapPickup
  const detourRatio  = (pickupDetour != null && rideDist != null && straightHome)
    ? (pickupDetour + rideDist) / Math.max(straightHome, 0.1)
    : null
  const etaMin       = rideDist != null ? (rideDist / V_CITY_KMH) * 60 : null
  const minutesLeft  = session.end_time
    ? (new Date(session.end_time).getTime() - Date.now()) / 60000
    : Infinity
  const bearingOff   = (haveDriverLoc && D)
    ? bearingDiffDeg(bearingDeg(D.lat, D.lng, H.lat, H.lng), bearingDeg(D.lat, D.lng, Q.lat, Q.lng))
    : null

  // ── Hard gates ──────────────────────────────────────────────
  const reasons = []
  if (progress != null) {
    if (progress < PROGRESS_MIN_KM) reasons.push('not enough progress toward home')
    else if (gapPickup && progress < PROGRESS_MIN_FRAC * gapPickup) reasons.push('mostly sideways')
  } else if (gapDrop > radiusKm) {
    reasons.push('cannot confirm it heads home')   // no pickup info — only trust drops already in the zone
  }
  if (gapDrop > radiusKm + DROP_SLACK_KM) reasons.push('ends outside the home zone')
  if (pickupDetour != null && pickupDetour > PICKUP_MAX_KM) reasons.push('pickup is too far away')
  if (bearingOff != null && bearingOff > BEARING_MAX_DEG) reasons.push('points the wrong way first')
  if (etaMin != null && minutesLeft !== Infinity && etaMin + BUFFER_MIN > minutesLeft) {
    reasons.push('will not finish before your cutoff')
  }
  if (detourRatio != null && detourRatio > DETOUR_RATIO_MAX) reasons.push('detour is too large')

  // ── Score (only meaningful once compatible) ─────────────────
  let score = 0.6 * (radiusKm - gapDrop)
  if (progress != null)     score += 1.0 * progress
  if (pickupDetour != null) score -= 1.0 * pickupDetour
  if (detourRatio != null)  score -= 0.8 * (detourRatio - 1) * straightHome
  if (ride.estimated_fare)  score += 0.4 * (Number(ride.estimated_fare) / TYPICAL_FARE)

  const round1 = n => Math.round(n * 10) / 10
  return {
    compatible: reasons.length === 0,
    score: Math.round(score * 100) / 100,
    progressKm: progress != null ? round1(progress) : null,
    dropGapKm: round1(gapDrop),
    etaMin: etaMin != null ? Math.round(etaMin) : null,
    reason: reasons[0] ?? null,
    distanceKm: round1(gapDrop),   // back-compat alias
  }
}
