import { haversineKm } from '@/lib/goHome'
import { LOCATION_COORDS } from '@/lib/locations'

// City-street distance runs longer than straight-line distance, and average
// speed drops with traffic — both scale with a flat multiplier/divisor
// rather than a real routing API, since none is wired up.
const ROUTE_FACTOR = 1.3
const AVG_SPEED_KMH = 22

const BASE_FARE = 40
const PER_KM_RATE = { luxe: 13, space: 18 }
const MIN_FARE = { luxe: 80, space: 110 }

export function distanceKmBetween(pickup, destination) {
  const from = LOCATION_COORDS[pickup]
  const to = LOCATION_COORDS[destination]
  if (!from || !to) return null
  return haversineKm(from.lat, from.lng, to.lat, to.lng) * ROUTE_FACTOR
}

export function estimateFare(pickup, destination, vehicleId) {
  const distanceKm = distanceKmBetween(pickup, destination)
  if (distanceKm == null) return { fare: MIN_FARE[vehicleId], distanceKm: 0, etaMin: 3 }

  const rawFare = BASE_FARE + distanceKm * PER_KM_RATE[vehicleId]
  const fare = Math.max(MIN_FARE[vehicleId], Math.round(rawFare / 5) * 5)
  const etaMin = Math.max(3, Math.round((distanceKm / AVG_SPEED_KMH) * 60))

  return { fare, distanceKm: Math.round(distanceKm * 10) / 10, etaMin }
}
