import { describe, it, expect, vi } from 'vitest'

// goHome.js imports the real supabase client at module load for the
// functions this file doesn't test (activateGoHome, etc.) — creating it
// for real fails outside a browser (no native WebSocket in Node), and
// none of the pure functions under test here touch the network anyway.
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import {
  haversineKm, bearingDeg, bearingDiffDeg, validateGoHomeInput,
  matchGoHomeRide, findZoneForAddress, HOME_ZONES,
} from './goHome'

// Exact inverse of haversineKm: the point a given bearing/distance away
// from a start point, on a sphere. Lets every fixture below be constructed
// precisely ("destination exactly 90° off from home, 10km out") instead of
// hand-approximated lat/lng offsets, which is how the two gates below
// (bearing, detour ratio) went unverified in manual testing earlier.
function projectPoint(origin, bearingDegrees, distanceKm) {
  const R = 6371
  const delta = distanceKm / R
  const theta = (bearingDegrees * Math.PI) / 180
  const phi1 = (origin.lat * Math.PI) / 180
  const lambda1 = (origin.lng * Math.PI) / 180
  const phi2 = Math.asin(Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta))
  const lambda2 = lambda1 + Math.atan2(
    Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
    Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2)
  )
  return { lat: (phi2 * 180) / Math.PI, lng: (lambda2 * 180) / Math.PI }
}

const HOME = { lat: 12.9716, lng: 77.5946 } // arbitrary Bangalore-ish point

function ride({ pickup, destination, fare = 180, pickupAddress = 'Some Street', destAddress = 'Some Other Street' }) {
  return {
    pickup_latitude: pickup?.lat, pickup_longitude: pickup?.lng, pickup_address: pickupAddress,
    destination_latitude: destination?.lat, destination_longitude: destination?.lng, destination_address: destAddress,
    estimated_fare: fare,
  }
}

function session({ home = HOME, radiusKm = 3, endsInMinutes = 120 }) {
  return {
    home_zone_latitude: home.lat,
    home_zone_longitude: home.lng,
    home_zone_radius_km: radiusKm,
    end_time: new Date(Date.now() + endsInMinutes * 60000).toISOString(),
  }
}

describe('haversineKm', () => {
  it('is zero for the same point', () => {
    expect(haversineKm(HOME.lat, HOME.lng, HOME.lat, HOME.lng)).toBeCloseTo(0, 6)
  })

  it('matches a precisely projected distance', () => {
    const p = projectPoint(HOME, 45, 12.3)
    expect(haversineKm(HOME.lat, HOME.lng, p.lat, p.lng)).toBeCloseTo(12.3, 2)
  })

  it('is symmetric', () => {
    const p = projectPoint(HOME, 200, 5)
    expect(haversineKm(HOME.lat, HOME.lng, p.lat, p.lng))
      .toBeCloseTo(haversineKm(p.lat, p.lng, HOME.lat, HOME.lng), 9)
  })
})

describe('bearingDeg / bearingDiffDeg', () => {
  it('reads back the exact bearing used to project a point', () => {
    for (const b of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const p = projectPoint(HOME, b, 8)
      expect(bearingDeg(HOME.lat, HOME.lng, p.lat, p.lng)).toBeCloseTo(b, 0)
    }
  })

  it('bearingDiffDeg is the short way around, never over 180', () => {
    expect(bearingDiffDeg(10, 350)).toBeCloseTo(20, 6)
    expect(bearingDiffDeg(350, 10)).toBeCloseTo(20, 6)
    expect(bearingDiffDeg(0, 180)).toBeCloseTo(180, 6)
    expect(bearingDiffDeg(90, 90)).toBeCloseTo(0, 6)
  })
})

describe('validateGoHomeInput', () => {
  const validEndTime = () => {
    const d = new Date(Date.now() + 60 * 60000)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  it('accepts a well-formed activation', () => {
    expect(validateGoHomeInput({ zoneName: HOME_ZONES[0].name, radiusKm: 3, endTime: validEndTime() })).toBeNull()
  })

  it('rejects an unknown zone', () => {
    expect(validateGoHomeInput({ zoneName: 'Nowhere', radiusKm: 3, endTime: validEndTime() })).toMatch(/valid home zone/)
  })

  it('rejects a radius outside 1-15km', () => {
    expect(validateGoHomeInput({ zoneName: HOME_ZONES[0].name, radiusKm: 0.5, endTime: validEndTime() })).toMatch(/Radius/)
    expect(validateGoHomeInput({ zoneName: HOME_ZONES[0].name, radiusKm: 16, endTime: validEndTime() })).toMatch(/Radius/)
  })

  it('rejects an end time in the past', () => {
    const past = new Date(Date.now() - 60000).toISOString().slice(0, 16)
    expect(validateGoHomeInput({ zoneName: HOME_ZONES[0].name, radiusKm: 3, endTime: past })).toMatch(/future/)
  })

  it('rejects an end time more than 8 hours out', () => {
    const d = new Date(Date.now() + 9 * 60 * 60000)
    const far = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    expect(validateGoHomeInput({ zoneName: HOME_ZONES[0].name, radiusKm: 3, endTime: far })).toMatch(/8 hours/)
  })
})

describe('findZoneForAddress', () => {
  it('matches a known zone name inside a longer address', () => {
    expect(findZoneForAddress('123 Main Rd, Koramangala 5th Block')?.name).toBe('Koramangala')
  })
  it('returns null for an address with no known zone', () => {
    expect(findZoneForAddress('Nowhere in particular')).toBeNull()
  })
  it('returns null for a missing address', () => {
    expect(findZoneForAddress(null)).toBeNull()
    expect(findZoneForAddress(undefined)).toBeNull()
  })
})

describe('matchGoHomeRide', () => {
  it('accepts a ride that heads clearly toward home', () => {
    const pickup = projectPoint(HOME, 180, 8)      // 8km south of home
    const destination = projectPoint(HOME, 180, 1)  // 1km south of home — much closer
    const m = matchGoHomeRide(ride({ pickup, destination }), session({ radiusKm: 3 }))
    expect(m.compatible).toBe(true)
    expect(m.progressKm).toBeCloseTo(7, 0)
    expect(m.reason).toBeNull()
  })

  it('rejects a ride that heads away from home', () => {
    const pickup = projectPoint(HOME, 180, 5)
    const destination = projectPoint(HOME, 180, 15) // farther south than pickup
    const m = matchGoHomeRide(ride({ pickup, destination }), session({ radiusKm: 3 }))
    expect(m.compatible).toBe(false)
    expect(m.reason).toMatch(/progress/)
  })

  it('rejects a ride that moves sideways rather than toward home', () => {
    const pickup = projectPoint(HOME, 180, 8)
    const destination = projectPoint(HOME, 90, 7.7) // similar distance, different direction
    const m = matchGoHomeRide(ride({ pickup, destination }), session({ radiusKm: 3 }))
    expect(m.compatible).toBe(false)
    expect(m.reason).toBeTruthy()
  })

  it('rejects a drop-off outside the home zone + slack even with real progress', () => {
    const pickup = projectPoint(HOME, 0, 30)
    const destination = projectPoint(HOME, 0, 10) // big progress, but still 10km out
    const m = matchGoHomeRide(ride({ pickup, destination }), session({ radiusKm: 3 })) // 3 + 2 slack = 5
    expect(m.compatible).toBe(false)
    expect(m.reason).toMatch(/outside the home zone/)
  })

  it('rejects when the driver would have to backtrack too far for the pickup', () => {
    const home = HOME
    const destination = projectPoint(home, 0, 1)
    const pickup = projectPoint(home, 90, 6)     // net progress is fine…
    const driverLoc = projectPoint(pickup, 45, 4) // …but the driver is 4km from that pickup
    const m = matchGoHomeRide(ride({ pickup, destination }), session({ home, radiusKm: 3 }), driverLoc)
    expect(m.compatible).toBe(false)
    expect(m.reason).toMatch(/pickup is too far/)
  })

  it('rejects on a cutoff that would be missed, even though the route is fine', () => {
    const pickup = projectPoint(HOME, 180, 8)
    const destination = projectPoint(HOME, 180, 1)
    const m = matchGoHomeRide(ride({ pickup, destination }), session({ radiusKm: 3, endsInMinutes: 5 }))
    expect(m.compatible).toBe(false)
    expect(m.reason).toMatch(/cutoff/)
  })

  it('falls back to a text match on the address when coordinates are missing', () => {
    const r = { pickup_address: 'near HSR Layout', destination_address: 'Koramangala 5th Block', estimated_fare: 150 }
    const m = matchGoHomeRide(r, session({ home: HOME_ZONES.find(z => z.name === 'Koramangala'), radiusKm: 3 }))
    expect(m.compatible).toBe(true)
    // both addresses resolve to known zones, so progress is measurable even without raw lat/lng
    expect(typeof m.progressKm).toBe('number')
  })

  it('cannot measure progress when neither address nor coordinates identify the pickup', () => {
    const r = { pickup_address: 'some unlisted street', destination_address: 'Koramangala 5th Block', estimated_fare: 150 }
    const m = matchGoHomeRide(r, session({ home: HOME_ZONES.find(z => z.name === 'Koramangala'), radiusKm: 3 }))
    expect(m.progressKm).toBeNull() // no pickup coordinates and no matching zone to measure progress from
  })

  it('is incompatible when the session has no home point at all', () => {
    const m = matchGoHomeRide(ride({ pickup: HOME, destination: HOME }), { home_zone_latitude: null, home_zone_longitude: null })
    expect(m.compatible).toBe(false)
    expect(m.reason).toMatch(/no home point/)
  })

  it('ranks a bigger-progress ride above a smaller one, matching the driver queue sort', () => {
    const home = HOME
    const farPickup = projectPoint(home, 180, 10)
    const closePickup = projectPoint(home, 180, 5)
    const destination = projectPoint(home, 180, 1)
    const better = matchGoHomeRide(ride({ pickup: farPickup, destination }), session({ home, radiusKm: 3 }))
    const worse = matchGoHomeRide(ride({ pickup: closePickup, destination }), session({ home, radiusKm: 3 }))
    expect(better.compatible && worse.compatible).toBe(true)
    expect(better.score).toBeGreaterThan(worse.score)
  })

  // The next two isolate gates that resist independent construction when
  // the driver is at (or near) the pickup: passing "25%+ homeward progress"
  // geometrically forces the bearing to be within ~49° of home's true
  // bearing regardless (see the session transcript this was worked out
  // in) — so both use the one path where progress isn't computed at all:
  // no pickup coordinates, driver location supplied directly.

  it('rejects on bearing alone when the destination happens to sit near home but in the wrong initial direction', () => {
    const driverLoc = { lat: 12.90, lng: 77.60 }
    const home = projectPoint(driverLoc, 0, 10)       // home is due north of the driver
    const destination = projectPoint(driverLoc, 90, 10) // "near enough" to home, but due east
    const gapDrop = haversineKm(destination.lat, destination.lng, home.lat, home.lng)
    expect(gapDrop).toBeLessThan(15) // sanity: it does land inside the zone check below

    const r = { pickup_address: 'Unknown Street', destination_latitude: destination.lat, destination_longitude: destination.lng, destination_address: 'Somewhere', estimated_fare: 150 }
    const m = matchGoHomeRide(r, session({ home, radiusKm: 15 }), driverLoc)
    expect(m.compatible).toBe(false)
    expect(m.reason).toMatch(/wrong way/)
  })

  it('rejects on detour ratio alone when the ride runs opposite the way home before circling back', () => {
    const home = HOME
    const pickup = projectPoint(home, 180, 20)       // 20km south of home
    const driverLoc = projectPoint(pickup, 90, 1)     // driver essentially at the pickup
    const destination = projectPoint(home, 0, 14)     // drop-off 14km *north* of home — the long way round
    const m = matchGoHomeRide(ride({ pickup, destination }), session({ home, radiusKm: 13 }), driverLoc)
    expect(m.compatible).toBe(false)
    expect(m.reason).toMatch(/detour is too large/)
  })
})
