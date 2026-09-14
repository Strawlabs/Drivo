import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

// Don't hammer the DB on every GPS tick — watchPosition can fire several
// times a second on some devices. driver_profiles.current_latitude/
// longitude already exist in the schema; nothing has ever written to them.
const WRITE_THROTTLE_MS = 8000

/*
  Broadcasts a driver's real position to driver_profiles while `active` is
  true (in practice: while the driver is online), and returns the latest
  fix locally so a single caller (the driver's own map, Go Home Mode
  matching) doesn't need its own separate geolocation call.

  Fails silently into { location: null, error } if geolocation is denied
  or unavailable — callers already treat "no location" as a normal,
  handled case (see matchGoHomeRide's driverLoc-optional gates).
*/
export function useDriverLocation({ driverProfileId, active }) {
  const [location, setLocation] = useState(null)
  const [error, setError] = useState(null)
  const lastWriteRef = useRef(0)

  useEffect(() => {
    if (!active || !driverProfileId || !navigator.geolocation) {
      setLocation(null)
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      pos => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setLocation(next)
        setError(null)

        const now = Date.now()
        if (now - lastWriteRef.current < WRITE_THROTTLE_MS) return
        lastWriteRef.current = now
        // Routed through update_driver_location (schema.sql) — driver_profiles'
        // UPDATE policy is admin-only now, so a plain client update no
        // longer reaches this table at all.
        supabase
          .rpc('update_driver_location', { p_driver_id: driverProfileId, p_lat: next.lat, p_lng: next.lng })
          .then(({ error: writeErr }) => {
            if (writeErr) console.error('Failed to broadcast driver location:', writeErr.message)
          })
      },
      err => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [active, driverProfileId])

  return { location, error }
}
