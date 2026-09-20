// Real driving routes via OSRM's free public routing server — no API key,
// no billing account, matching the "no fabrication" bar the rest of this
// app holds itself to (fare.js's haversine estimate is left as-is for
// pricing continuity; this is specifically for drawing the real road path
// on the map). It's a shared demo instance, not a production SLA — falls
// back to a straight line between the two points if it's unreachable
// rather than breaking the map.
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving'

export async function fetchDrivingRoute(from, to) {
  const url = `${OSRM_BASE}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`OSRM responded ${res.status}`)
    const data = await res.json()
    const route = data.routes?.[0]
    if (!route) throw new Error('No route returned')

    return {
      coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
      isRealRoute: true,
    }
  } catch (err) {
    console.warn('OSRM routing unavailable, falling back to a straight line:', err.message)
    return {
      coordinates: [[from.lat, from.lng], [to.lat, to.lng]],
      distanceKm: null,
      durationMin: null,
      isRealRoute: false,
    }
  }
}

// A point a given fraction (0-1) of the way along a real route's coordinate
// list — used to move the car marker smoothly along the actual road path
// instead of a straight interpolation between just the two endpoints.
export function pointAlongRoute(coordinates, fraction) {
  if (!coordinates || coordinates.length === 0) return null
  const t = Math.min(1, Math.max(0, fraction))
  const idx = t * (coordinates.length - 1)
  const i = Math.min(coordinates.length - 2, Math.floor(idx))
  const localT = idx - i
  const [lat1, lng1] = coordinates[i]
  const [lat2, lng2] = coordinates[i + 1] ?? coordinates[i]
  return [lat1 + (lat2 - lat1) * localT, lng1 + (lng2 - lng1) * localT]
}
