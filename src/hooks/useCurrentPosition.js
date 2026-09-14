import { useEffect, useState } from 'react'

/*
  A one-shot version of useDriverLocation for callers that just need "roughly
  where am I right now" to sort/filter something (nearby drivers) — not the
  continuously-updated, DB-broadcast position a driver needs while online.
  No reverse geocoding either (see geocoding.js's getCurrentLocation for
  that) — this is pure coordinates for distance math.

  Fails silently into null if geolocation is denied/unavailable, same
  tradeoff as useDriverLocation: every caller already has to handle "no
  location" as a normal case, since it's never guaranteed.
*/
export function useCurrentPosition() {
  const [location, setLocation] = useState(null)

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      pos => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocation(null),
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 }
    )
  }, [])

  return location
}
