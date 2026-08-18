import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth.jsx'
import { notifyDriverProfile } from '@/lib/notifications'
import { estimateFare } from '@/lib/fare'
import { fetchDrivingRoute } from '@/lib/routing'
import { getCurrentLocation } from '@/lib/geocoding'
import RealMap from '@/components/RealMap'
import LocationSearchInput from '@/components/LocationSearchInput'

const VEHICLE_TYPES = [
  { id: 'luxe',  label: 'Drivo Luxe',  type: 'EV Sedan', icon: 'electric_car' },
  { id: 'space', label: 'Drivo Space', type: 'EV SUV',    icon: 'directions_car' },
]

const BANGALORE_CENTER = { lat: 12.9716, lng: 77.5946 }

export default function BookRidePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  const driver = location.state?.driver ?? {
    name: 'Ramesh K.', rating: 4.9, avatar: 'RK', type: 'EV Sedan', eta: '3 mins',
  }

  // Each is { address, lat, lng } — lat/lng stay null until a real place is
  // resolved (typing alone doesn't count; only picking a search result or
  // using current location does), so fare/route/confirm all gate on that.
  const [pickup, setPickup] = useState(
    location.state?.pickup ? { address: location.state.pickup, ...location.state.pickupCoords } : { address: '', lat: null, lng: null }
  )
  const [destination, setDestination] = useState(
    location.state?.destination ? { address: location.state.destination, ...location.state.destinationCoords } : { address: '', lat: null, lng: null }
  )
  const [locatingCurrent, setLocatingCurrent] = useState(false)

  const [selected, setSelected]   = useState('luxe')
  const [confirming, setConfirming] = useState(false)
  const [locationError, setLocationError] = useState('')

  // Auto-detect current location for pickup on arrival, matching Uber/
  // Rapido — same real address the rider would otherwise have to search
  // for themselves. Only if nothing was already carried over via nav state
  // (e.g. re-requesting a different driver after one expires).
  useEffect(() => {
    if (location.state?.pickup) return
    setLocatingCurrent(true)
    getCurrentLocation()
      .then(loc => setPickup({ address: loc.address, lat: loc.lat, lng: loc.lng }))
      .catch(() => {}) // rider can still search/type a pickup manually
      .finally(() => setLocatingCurrent(false))
  }, [])

  function handleSwap() {
    setPickup(destination)
    setDestination(pickup)
  }

  function handleUseCurrentLocation(setter) {
    setLocatingCurrent(true)
    getCurrentLocation()
      .then(loc => setter({ address: loc.address, lat: loc.lat, lng: loc.lng }))
      .catch(err => setLocationError(err.message))
      .finally(() => setLocatingCurrent(false))
  }

  const bothResolved = pickup.lat != null && pickup.lng != null && destination.lat != null && destination.lng != null
  const sameLocation = bothResolved && pickup.lat === destination.lat && pickup.lng === destination.lng

  // Real driving route between the two resolved real coordinates, refetched
  // whenever either changes. Falls back to a straight line if OSRM is
  // unreachable (src/lib/routing.js) rather than breaking the map.
  const [routeCoords, setRouteCoords] = useState([])
  useEffect(() => {
    if (!bothResolved || sameLocation) { setRouteCoords([]); return }
    let cancelled = false
    fetchDrivingRoute(pickup, destination).then(route => { if (!cancelled) setRouteCoords(route.coordinates) })
    return () => { cancelled = true }
  }, [pickup.lat, pickup.lng, destination.lat, destination.lng, bothResolved, sameLocation])

  const vehicleOptions = useMemo(() => VEHICLE_TYPES.map(v => {
    if (!bothResolved || sameLocation) return { ...v, fare: 0, distanceKm: 0, etaMin: 0, sub: `${v.type}` }
    const { fare, distanceKm, etaMin } = estimateFare(pickup, destination, v.id)
    return { ...v, fare, distanceKm, etaMin, sub: `${v.type} · ${etaMin} min` }
  }), [pickup.lat, pickup.lng, destination.lat, destination.lng, bothResolved, sameLocation])

  const selectedVehicle = vehicleOptions.find(v => v.id === selected)
  const fare = selectedVehicle.fare

  async function handleConfirm() {
    if (confirming || !user) return
    if (!bothResolved) {
      setLocationError('Pick a pickup and destination first.')
      return
    }
    if (sameLocation) {
      setLocationError("Pickup and destination can't be the same place.")
      return
    }
    setLocationError('')
    setConfirming(true)
    try {
      const { data, error } = await supabase.from('rides').insert({
        rider_id: user.id,
        driver_id: driver.id ?? null,
        vehicle_id: driver.vehicleId ?? null,
        pickup_address: pickup.address,
        pickup_latitude: pickup.lat,
        pickup_longitude: pickup.lng,
        destination_address: destination.address,
        destination_latitude: destination.lat,
        destination_longitude: destination.lng,
        estimated_fare: fare,
        status: 'requested',
      }).select().single()
      if (error) throw error

      if (driver.id) {
        notifyDriverProfile(driver.id, {
          category: 'driver_request',
          title: 'New ride request',
          body: `A rider wants a ride from ${pickup.address} to ${destination.address}.`,
          data: { rideId: data.id },
        }).catch(() => {})
      }

      navigate('/rider/active-ride', {
        state: {
          rideId: data.id, driver, fare, rideStatus: 'requested',
          pickup: pickup.address, pickupCoords: { lat: pickup.lat, lng: pickup.lng },
          destination: destination.address, destinationCoords: { lat: destination.lat, lng: destination.lng },
          distanceKm: selectedVehicle.distanceKm, etaMin: selectedVehicle.etaMin,
        },
      })
    } catch (err) {
      alert('Could not create ride: ' + err.message)
      setConfirming(false)
    }
  }

  const mapCenter = pickup.lat != null ? [pickup.lat, pickup.lng] : [BANGALORE_CENTER.lat, BANGALORE_CENTER.lng]

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-background)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-5 py-3"
        style={{ background: 'var(--color-surface)', boxShadow: '0 1px 0 var(--color-surface-container-low)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            style={{ width: 40, height: 40, borderRadius: '50%', background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>arrow_back</span>
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-on-surface)' }}>Book Ride</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>notifications</span>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700 }}>
            {driver.avatar?.[0] ?? 'U'}
          </div>
        </div>
      </header>

      {/* Map — real OpenStreetMap tiles, real pickup/destination coordinates
          (geolocation + free-text search, not a fixed list), real driving
          route via OSRM re-fetched whenever either location changes. */}
      <div className="relative flex-1" style={{ minHeight: 220 }}>
        <RealMap
          center={mapCenter}
          zoom={13}
          interactive={false}
          bounds={bothResolved && !sameLocation ? [[pickup.lat, pickup.lng], [destination.lat, destination.lng]] : null}
          route={routeCoords}
          markers={[
            pickup.lat != null && { id: 'pickup', type: 'dot', color: 'var(--color-primary)', position: [pickup.lat, pickup.lng] },
            !sameLocation && destination.lat != null && { id: 'destination', type: 'pin', color: '#4ae183', position: [destination.lat, destination.lng] },
          ].filter(Boolean)}
        />
      </div>

      {/* Bottom sheet */}
      <div style={{ background: 'var(--color-surface)', borderTopLeftRadius: 24, borderTopRightRadius: 24, boxShadow: '0 -10px 30px rgba(26,43,60,0.12)', padding: '12px 20px 32px', marginTop: -24, position: 'relative', zIndex: 10 }}>
        {/* Grabber */}
        <div style={{ width: 32, height: 4, background: '#E2E8F0', borderRadius: 2, margin: '0 auto 16px' }} />

        {/* Route — free-text search with live suggestions and a "use
            current location" shortcut, matching Uber/Rapido, instead of a
            fixed 9-place dropdown. */}
        <div className="flex items-center gap-4 mb-5">
          <div className="flex flex-col items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--color-primary)' }}>radio_button_checked</span>
            <div style={{ width: 1, height: 40, borderLeft: '2px dashed var(--color-outline-variant)' }} />
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--color-primary)' }}>location_on</span>
          </div>
          <div className="flex-1 flex flex-col gap-3">
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', color: 'var(--color-on-surface-variant)', marginBottom: 4 }}>Pickup</p>
              <LocationSearchInput
                value={pickup.address}
                onChange={text => setPickup({ address: text, lat: null, lng: null })}
                onSelect={result => setPickup(result)}
                placeholder={locatingCurrent ? 'Finding your location…' : 'Search pickup location'}
                onUseCurrentLocation={() => handleUseCurrentLocation(setPickup)}
                locatingCurrent={locatingCurrent}
              />
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', color: 'var(--color-on-surface-variant)', marginBottom: 4 }}>Destination</p>
              <LocationSearchInput
                value={destination.address}
                onChange={text => setDestination({ address: text, lat: null, lng: null })}
                onSelect={result => setDestination(result)}
                placeholder="Where to?"
                autoFocus={!destination.address}
              />
            </div>
          </div>
          <button onClick={handleSwap} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-secondary)' }}>swap_vert</span>
          </button>
        </div>

        {/* Vehicle options */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {vehicleOptions.map(v => (
            <button key={v.id} onClick={() => setSelected(v.id)}
              style={{ position: 'relative', background: selected === v.id ? 'white' : 'var(--color-surface-container-low)', border: `2px solid ${selected === v.id ? 'var(--color-primary)' : 'var(--color-outline-variant)'}`, borderRadius: 12, padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', cursor: 'pointer', opacity: selected === v.id ? 1 : 0.65, transition: 'all 0.15s' }}>
              {selected === v.id && (
                <span className="material-symbols-outlined" style={{ position:'absolute', top:6, right:6, fontSize:18, color:'var(--color-primary)', fontVariationSettings:"'FILL' 1" }}>check_circle</span>
              )}
              <span className="material-symbols-outlined" style={{ fontSize: 40, color: 'var(--color-primary)', marginBottom: 6 }}>{v.icon}</span>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-on-surface)' }}>{v.label}</p>
              <p style={{ fontSize: 11, color: 'var(--color-on-surface-variant)', marginTop: 2 }}>{v.sub}</p>
            </button>
          ))}
        </div>

        {/* Driver + fare */}
        <div className="flex items-center justify-between mb-5" style={{ background: 'var(--color-surface-container-lowest)', border: '1px solid var(--color-outline-variant)', borderRadius: 12, padding: 14 }}>
          <div className="flex items-center gap-3">
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 16 }}>
              {driver.avatar}
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-on-surface)' }}>{driver.name}</p>
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#F59E0B', fontVariationSettings:"'FILL' 1" }}>star</span>
                <span style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>{driver.rating} · EV Certified</span>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-primary)', lineHeight: 1 }}>{bothResolved && !sameLocation ? `₹${fare}` : '—'}</p>
            <p style={{ fontSize: 11, color: 'var(--color-on-surface-variant)', marginTop: 2 }}>Est. Fare</p>
          </div>
        </div>

        {/* Payment — the actual method is chosen after the ride, on the
            ride-complete screen, not here. A "Change" link implied a
            choice existed at this step that doesn't. */}
        <div className="flex items-center gap-2 px-1 mb-4">
          <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: 20 }}>payments</span>
          <span style={{ fontSize: 14, color: 'var(--color-on-surface)' }}>Pay via UPI or cash after your ride</span>
        </div>

        {(locationError || sameLocation) && (
          <p style={{ fontSize: 13, color: 'var(--color-error)', marginBottom: 12, textAlign: 'center' }}>
            {locationError || "Pickup and destination can't be the same place."}
          </p>
        )}

        {/* CTA */}
        <button onClick={handleConfirm} disabled={confirming || !bothResolved || sameLocation}
          style={{ width: '100%', height: 52, background: 'var(--color-primary-container)', color: 'var(--color-on-primary-container)', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: (confirming || !bothResolved || sameLocation) ? 'not-allowed' : 'pointer', opacity: (confirming || !bothResolved || sameLocation) ? 0.6 : 1, boxShadow: '0 4px 16px rgba(0,109,55,0.2)' }}>
          {confirming ? 'Confirming…' : 'Confirm Ride'}
          {!confirming && <span className="material-symbols-outlined">chevron_right</span>}
        </button>
      </div>
    </div>
  )
}
