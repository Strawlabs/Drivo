import { describe, it, expect, vi } from 'vitest'

// fare.js imports supabase directly, and also imports haversineKm from
// goHome.js which itself imports supabase — mock both so loading this
// module for its pure functions doesn't try to open a real client.
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { distanceKmBetween, estimateFare } from './fare'
import { haversineKm } from './goHome'

const A = { lat: 12.9352, lng: 77.6146 } // Koramangala
const B = { lat: 12.9784, lng: 77.6408 } // Indiranagar, a few km away

describe('distanceKmBetween', () => {
  it('returns null when either point is missing', () => {
    expect(distanceKmBetween(null, B)).toBeNull()
    expect(distanceKmBetween(A, null)).toBeNull()
    expect(distanceKmBetween(undefined, undefined)).toBeNull()
  })

  it('applies the default route factor (1.3) to the straight-line distance', () => {
    const straight = haversineKm(A.lat, A.lng, B.lat, B.lng)
    expect(distanceKmBetween(A, B)).toBeCloseTo(straight * 1.3, 6)
  })

  it('applies a custom route factor when given one', () => {
    const straight = haversineKm(A.lat, A.lng, B.lat, B.lng)
    expect(distanceKmBetween(A, B, 1.0)).toBeCloseTo(straight, 6)
    expect(distanceKmBetween(A, B, 2.0)).toBeCloseTo(straight * 2, 6)
  })
})

describe('estimateFare', () => {
  it('falls back to the hardcoded tiers/settings when no config is supplied', () => {
    const result = estimateFare(A, B, 'luxe', undefined)
    const distanceKm = haversineKm(A.lat, A.lng, B.lat, B.lng) * 1.3 // fallback routeFactor
    const rawFare = 40 + distanceKm * 13 // fallback luxe base/per-km
    const expectedFare = Math.max(80, Math.round(rawFare / 5) * 5) // fallback minFare
    expect(result.fare).toBe(expectedFare)
    expect(result.distanceKm).toBeCloseTo(Math.round(distanceKm * 10) / 10, 5)
  })

  it('gives space a different fare than luxe over the same trip (tier isolation)', () => {
    const luxe = estimateFare(A, B, 'luxe', undefined)
    const space = estimateFare(A, B, 'space', undefined)
    expect(luxe.fare).not.toBe(space.fare)
  })

  it('enforces the tier minimum fare on very short trips', () => {
    const nextDoor = { lat: A.lat + 0.0005, lng: A.lng } // ~55m away
    const result = estimateFare(nextDoor, nextDoor, 'luxe', undefined)
    // same point twice -> distanceKmBetween is ~0, so estimateFare takes the
    // "no distance" early-return branch
    expect(result.fare).toBe(80)
    expect(result.distanceKm).toBe(0)
    expect(result.etaMin).toBe(3)
  })

  it('returns the tier minimum and a 3-minute eta when coordinates are missing entirely', () => {
    const result = estimateFare(null, null, 'luxe', undefined)
    expect(result).toEqual({ fare: 80, distanceKm: 0, etaMin: 3 })
  })

  it('uses admin-configured tiers and settings when a config is supplied', () => {
    const config = {
      settings: { routeFactor: 1.0, avgSpeedKmh: 30 },
      tiers: { luxe: { baseFare: 100, perKmRate: 20, minFare: 200 } },
    }
    const result = estimateFare(A, B, 'luxe', config)
    const distanceKm = haversineKm(A.lat, A.lng, B.lat, B.lng) // routeFactor 1.0
    const rawFare = 100 + distanceKm * 20
    const expectedFare = Math.max(200, Math.round(rawFare / 5) * 5)
    expect(result.fare).toBe(expectedFare)
    const expectedEta = Math.max(3, Math.round((distanceKm / 30) * 60))
    expect(result.etaMin).toBe(expectedEta)
  })

  it('falls back to the hardcoded tier for a vehicle missing from a partial config', () => {
    const config = { settings: { routeFactor: 1.3, avgSpeedKmh: 22 }, tiers: {} } // space not in DB rows
    const result = estimateFare(A, B, 'space', config)
    const distanceKm = haversineKm(A.lat, A.lng, B.lat, B.lng) * 1.3
    const rawFare = 40 + distanceKm * 18 // fallback space base/per-km
    const expectedFare = Math.max(110, Math.round(rawFare / 5) * 5)
    expect(result.fare).toBe(expectedFare)
  })

  it('never returns an eta below 3 minutes even for a very fast/short trip', () => {
    const config = { settings: { routeFactor: 1.0, avgSpeedKmh: 200 }, tiers: { luxe: { baseFare: 10, perKmRate: 1, minFare: 10 } } }
    const near = { lat: A.lat + 0.01, lng: A.lng }
    const result = estimateFare(A, near, 'luxe', config)
    expect(result.etaMin).toBe(3)
  })
})
