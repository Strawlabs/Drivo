import { describe, it, expect, vi } from 'vitest'

// Static default so the top-level `import { haversineKm } from './goHome'`
// below (which itself imports supabase) never touches a real client.
// Individual tests override this per-case with vi.doMock + a fresh
// dynamic import of drivers.js, since fetchAvailableDrivers' actual
// behavior needs to see specific supabase query results.
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { haversineKm } from './goHome'

// drivers.js only needs the two supabase.from(...) calls it actually
// makes (driver_profiles, then driver_subscriptions for the elite-
// priority check) — a minimal thenable query-builder stub is enough to
// drive fetchAvailableDrivers' real filtering/sorting logic without a
// live client or DB.
function makeSupabaseStub(byTable) {
  return {
    from(table) {
      const result = byTable[table] ?? { data: [], error: null }
      const builder = {
        select: () => builder,
        eq: () => builder,
        neq: () => builder,
        in: () => builder,
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
      }
      return builder
    },
  }
}

const BANGALORE = { lat: 12.9716, lng: 77.5946 }

// Precise offsets built the same way goHome.test.js's projectPoint does,
// but simpler here since we only need "N km due east" — reuse the real
// haversineKm to confirm each fixture's actual distance rather than
// asserting against a guessed value.
function eastOffset(origin, km) {
  const dLng = (km / (111.32 * Math.cos(origin.lat * Math.PI / 180)))
  return { lat: origin.lat, lng: origin.lng + dLng }
}

describe('fetchAvailableDrivers', () => {
  it('returns every online driver, unfiltered and unsorted by distance, when no origin is given', async () => {
    vi.resetModules()
    vi.doMock('@/lib/supabase', () => ({
      supabase: makeSupabaseStub({
        driver_profiles: {
          data: [
            { id: 'd1', rating: 4.5, current_latitude: null, current_longitude: null, users: { name: 'Driver One' }, vehicles: [] },
            { id: 'd2', rating: 4.8, current_latitude: null, current_longitude: null, users: { name: 'Driver Two' }, vehicles: [] },
          ],
          error: null,
        },
        driver_subscriptions: { data: [], error: null },
      }),
    }))
    const { fetchAvailableDrivers } = await import('./drivers')
    const drivers = await fetchAvailableDrivers()
    expect(drivers.map(d => d.id)).toEqual(['d1', 'd2'])
    expect(drivers.every(d => d.distanceKm === null)).toBe(true)
  })

  it('filters out a driver beyond the nearby radius, keeps and sorts the rest by real distance, and keeps unknown-location drivers last', async () => {
    vi.resetModules()
    const near = eastOffset(BANGALORE, 2)     // ~2km — well within range
    const mid = eastOffset(BANGALORE, 25)     // ~25km — still within the 30km cap
    const far = eastOffset(BANGALORE, 45)     // ~45km — beyond the cap, must be excluded

    // Sanity-check the fixtures actually land where intended before
    // trusting the assertions below on them.
    expect(haversineKm(BANGALORE.lat, BANGALORE.lng, near.lat, near.lng)).toBeCloseTo(2, 0)
    expect(haversineKm(BANGALORE.lat, BANGALORE.lng, mid.lat, mid.lng)).toBeCloseTo(25, 0)
    expect(haversineKm(BANGALORE.lat, BANGALORE.lng, far.lat, far.lng)).toBeCloseTo(45, 0)

    vi.doMock('@/lib/supabase', () => ({
      supabase: makeSupabaseStub({
        driver_profiles: {
          data: [
            { id: 'mid',     rating: 4.5, current_latitude: mid.lat,  current_longitude: mid.lng,  users: { name: 'Mid' },     vehicles: [] },
            { id: 'unknown', rating: 4.5, current_latitude: null,     current_longitude: null,     users: { name: 'Unknown' }, vehicles: [] },
            { id: 'far',     rating: 4.5, current_latitude: far.lat,  current_longitude: far.lng,  users: { name: 'Far' },     vehicles: [] },
            { id: 'near',    rating: 4.5, current_latitude: near.lat, current_longitude: near.lng, users: { name: 'Near' },    vehicles: [] },
          ],
          error: null,
        },
        driver_subscriptions: { data: [], error: null },
      }),
    }))
    const { fetchAvailableDrivers } = await import('./drivers')
    const drivers = await fetchAvailableDrivers({ origin: BANGALORE })

    expect(drivers.map(d => d.id)).toEqual(['near', 'mid', 'unknown'])   // 'far' excluded entirely
    expect(drivers.find(d => d.id === 'near').distanceKm).toBeCloseTo(2, 0)
    expect(drivers.find(d => d.id === 'mid').distanceKm).toBeCloseTo(25, 0)
    expect(drivers.find(d => d.id === 'unknown').distanceKm).toBeNull()
  })

  it('still surfaces an Elite priority driver first even when a plain driver is closer', async () => {
    vi.resetModules()
    const closer = eastOffset(BANGALORE, 1)
    const farther = eastOffset(BANGALORE, 5)

    vi.doMock('@/lib/supabase', () => ({
      supabase: makeSupabaseStub({
        driver_profiles: {
          data: [
            { id: 'plain-closer', rating: 4.5, current_latitude: closer.lat,  current_longitude: closer.lng,  users: { name: 'Plain' },  vehicles: [] },
            { id: 'elite-farther', rating: 4.9, current_latitude: farther.lat, current_longitude: farther.lng, users: { name: 'Elite' }, vehicles: [] },
          ],
          error: null,
        },
        driver_subscriptions: {
          data: [{ driver_id: 'elite-farther', status: 'active', subscription_plans: { name: 'elite' } }],
          error: null,
        },
      }),
    }))
    const { fetchAvailableDrivers } = await import('./drivers')
    const drivers = await fetchAvailableDrivers({ origin: BANGALORE })
    expect(drivers.map(d => d.id)).toEqual(['elite-farther', 'plain-closer'])
  })

  it('excludes the given driver id regardless of distance filtering', async () => {
    vi.resetModules()
    let capturedNeq = null
    vi.doMock('@/lib/supabase', () => ({
      supabase: {
        from: () => {
          const builder = {
            select: () => builder,
            eq: () => builder,
            neq: (col, val) => { capturedNeq = [col, val]; return builder },
            in: () => builder,
            then: (resolve) => Promise.resolve({ data: [], error: null }).then(resolve),
          }
          return builder
        },
      },
    }))
    const { fetchAvailableDrivers } = await import('./drivers')
    await fetchAvailableDrivers({ excludeDriverId: 'me-123' })
    expect(capturedNeq).toEqual(['id', 'me-123'])
  })
})
