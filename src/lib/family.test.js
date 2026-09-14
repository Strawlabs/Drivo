import { describe, it, expect, vi } from 'vitest'

// family.js imports supabase and notifications at module scope for the
// async DB functions this file doesn't test — mock them so importing it
// for validateScheduledTime alone doesn't need a real client.
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/notifications', () => ({ notify: vi.fn(), notifyDriverProfile: vi.fn() }))

import { validateScheduledTime, SCHEDULE_MIN_LEAD_MINUTES } from './family'

describe('validateScheduledTime', () => {
  it('accepts a time comfortably past the minimum lead', () => {
    const future = new Date(Date.now() + (SCHEDULE_MIN_LEAD_MINUTES + 30) * 60000)
    expect(() => validateScheduledTime(future)).not.toThrow()
  })

  it('rejects a time before the minimum lead', () => {
    const tooSoon = new Date(Date.now() + (SCHEDULE_MIN_LEAD_MINUTES - 1) * 60000)
    expect(() => validateScheduledTime(tooSoon)).toThrow(/at least/)
  })

  it('rejects a time in the past', () => {
    const past = new Date(Date.now() - 60000)
    expect(() => validateScheduledTime(past)).toThrow()
  })

  it('rejects a non-Date value', () => {
    expect(() => validateScheduledTime('tomorrow 5pm')).toThrow()
    expect(() => validateScheduledTime(null)).toThrow()
    expect(() => validateScheduledTime(undefined)).toThrow()
  })

  it('rejects an invalid Date object', () => {
    expect(() => validateScheduledTime(new Date('not a date'))).toThrow()
  })

  it('rejects a time exactly at the minimum lead boundary', () => {
    // the check is `<= minTime`, so exactly SCHEDULE_MIN_LEAD_MINUTES from now must fail
    const boundary = new Date(Date.now() + SCHEDULE_MIN_LEAD_MINUTES * 60000)
    expect(() => validateScheduledTime(boundary)).toThrow()
  })
})
