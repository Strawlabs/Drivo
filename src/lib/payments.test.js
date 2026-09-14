import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { buildUpiLink } from './payments'

describe('buildUpiLink', () => {
  it('builds a upi:// deep link with the standard params', () => {
    const link = buildUpiLink({ upiId: 'driver@upi', payeeName: 'Ravi Kumar', amount: 245, note: 'Drivo ride #123' })
    expect(link.startsWith('upi://pay?')).toBe(true)
    const params = new URLSearchParams(link.slice('upi://pay?'.length))
    expect(params.get('pa')).toBe('driver@upi')
    expect(params.get('pn')).toBe('Ravi Kumar')
    expect(params.get('am')).toBe('245.00')
    expect(params.get('cu')).toBe('INR')
    expect(params.get('tn')).toBe('Drivo ride #123')
  })

  it('formats the amount to exactly two decimal places', () => {
    const link = buildUpiLink({ upiId: 'a@b', payeeName: 'X', amount: 99.999, note: 'n' })
    const params = new URLSearchParams(link.slice('upi://pay?'.length))
    expect(params.get('am')).toBe('100.00')
  })

  it('coerces a string amount to a number', () => {
    const link = buildUpiLink({ upiId: 'a@b', payeeName: 'X', amount: '80', note: 'n' })
    const params = new URLSearchParams(link.slice('upi://pay?'.length))
    expect(params.get('am')).toBe('80.00')
  })

  it('percent-encodes special characters in the payee name and note', () => {
    const link = buildUpiLink({ upiId: 'a@b', payeeName: 'Ravi & Sons', amount: 10, note: 'Ride to M.G. Road' })
    expect(link).not.toContain(' ')
    const params = new URLSearchParams(link.slice('upi://pay?'.length))
    expect(params.get('pn')).toBe('Ravi & Sons')
    expect(params.get('tn')).toBe('Ride to M.G. Road')
  })
})
