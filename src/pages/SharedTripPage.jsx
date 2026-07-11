import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { fetchSharedTrip } from '@/lib/safety'

const STATUS_LABEL = {
  requested: 'Looking for a driver…',
  accepted: 'Driver on the way',
  active: 'Ride in progress',
  completed: 'Ride completed',
  cancelled: 'Ride cancelled',
  expired: 'Ride expired',
}

export default function SharedTripPage() {
  const { token } = useParams()
  const [trip, setTrip] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchSharedTrip(token)
      .then(data => { if (!cancelled) { setTrip(data); setLoading(false) } })
      .catch(err => { if (!cancelled) { setError(err.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [token])

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-background)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400, background: 'white', borderRadius: 20, padding: 28, boxShadow: '0 4px 24px rgba(26,43,60,0.1)' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: 4 }}>🚗 Drivo Trip Status</h1>
        <p style={{ fontSize: 13, color: 'var(--color-secondary)', marginBottom: 24 }}>Shared trip — no login required</p>

        {loading && <p style={{ fontSize: 14, color: 'var(--color-secondary)' }}>Loading…</p>}

        {!loading && (error || !trip) && (
          <p style={{ fontSize: 14, color: 'var(--color-error)' }}>This trip link is invalid or has expired.</p>
        )}

        {!loading && trip && (
          <>
            <div style={{ background: 'var(--color-primary-container)', color: 'var(--color-on-primary-container)', borderRadius: 12, padding: '10px 16px', fontSize: 14, fontWeight: 700, marginBottom: 20, textAlign: 'center' }}>
              {STATUS_LABEL[trip.ride_status] ?? trip.ride_status}
            </div>

            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, color: 'var(--color-secondary)', marginBottom: 2 }}>Pickup</p>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-on-surface)' }}>{trip.pickup_address ?? '—'}</p>
            </div>
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, color: 'var(--color-secondary)', marginBottom: 2 }}>Destination</p>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-on-surface)' }}>{trip.destination_address ?? '—'}</p>
            </div>

            {trip.driver_name && (
              <div className="flex items-center gap-3" style={{ borderTop: '1px solid var(--color-outline-variant)', paddingTop: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--color-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  {trip.driver_name[0]}
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-on-surface)' }}>{trip.driver_name}</p>
                  {trip.vehicle_label && <p style={{ fontSize: 12, color: 'var(--color-secondary)' }}>{trip.vehicle_label}</p>}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
