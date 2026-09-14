import { supabase } from '@/lib/supabase'
import { haversineKm } from '@/lib/goHome'

// Used only if the DB fetch fails (offline, RLS misconfigured, etc.) — the
// real numbers now live in fare_tiers / fare_settings, admin-editable from
// the Pricing panel, not hardcoded here. Same fix subscription_plans.price
// already got; ride fares were the one pricing gap still baked into code.
const FALLBACK_SETTINGS = { routeFactor: 1.3, avgSpeedKmh: 22 }
const FALLBACK_TIERS = {
  luxe: { baseFare: 40, perKmRate: 13, minFare: 80 },
  space: { baseFare: 40, perKmRate: 18, minFare: 110 },
}

// Fetch once (e.g. on BookRidePage mount) and pass the result into
// estimateFare — kept as a separate step so estimateFare itself stays a
// plain, synchronous, easily-testable function.
export async function fetchFareConfig() {
  const [{ data: settingsRow }, { data: tierRows }] = await Promise.all([
    supabase.from('fare_settings').select('route_factor, avg_speed_kmh').eq('id', 1).maybeSingle(),
    supabase.from('fare_tiers').select('tier, base_fare, per_km_rate, min_fare'),
  ])

  const settings = settingsRow
    ? { routeFactor: Number(settingsRow.route_factor), avgSpeedKmh: Number(settingsRow.avg_speed_kmh) }
    : FALLBACK_SETTINGS

  const tiers = { ...FALLBACK_TIERS }
  for (const row of tierRows ?? []) {
    tiers[row.tier] = { baseFare: Number(row.base_fare), perKmRate: Number(row.per_km_rate), minFare: Number(row.min_fare) }
  }

  return { settings, tiers }
}

// Takes real {lat, lng} coordinates directly — pickup/destination are now
// free-text places resolved via geocoding.js, not a fixed named list, so
// this no longer looks anything up itself. routeFactor is optional so
// every existing caller (some just want a rough distance, not a fare)
// keeps working unchanged.
export function distanceKmBetween(from, to, routeFactor = FALLBACK_SETTINGS.routeFactor) {
  if (!from || !to) return null
  return haversineKm(from.lat, from.lng, to.lat, to.lng) * routeFactor
}

// `config` is whatever fetchFareConfig() resolved to — optional, so a
// caller that hasn't loaded it yet (or hit an error) still gets a sane
// estimate from the same fallback numbers instead of crashing.
export function estimateFare(pickupCoords, destinationCoords, vehicleId, config) {
  const settings = config?.settings ?? FALLBACK_SETTINGS
  const tier = config?.tiers?.[vehicleId] ?? FALLBACK_TIERS[vehicleId]

  const distanceKm = distanceKmBetween(pickupCoords, destinationCoords, settings.routeFactor)
  if (distanceKm == null) return { fare: tier.minFare, distanceKm: 0, etaMin: 3 }

  const rawFare = tier.baseFare + distanceKm * tier.perKmRate
  const fare = Math.max(tier.minFare, Math.round(rawFare / 5) * 5)
  const etaMin = Math.max(3, Math.round((distanceKm / settings.avgSpeedKmh) * 60))

  return { fare, distanceKm: Math.round(distanceKm * 10) / 10, etaMin }
}
