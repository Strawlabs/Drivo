import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth.jsx'
import { fetchPreferredDriversForRider, removePreferredDriver, fetchSubscriptionTier, ELIGIBLE_TIERS } from '@/lib/preferredDrivers'
import RiderBottomNav from '@/components/RiderBottomNav'

/*
  Full-page Preferred Drivers (Stitch: preferred_drivers). Replaces the
  earlier bottom-sheet modal opened from the Profile tab. Kept honest:
  the Stitch frame's per-driver "CHARGING (85%)" / "IN A RIDE (12 min)"
  states and "Notify Me" action have no backing data or feature, so they
  aren't shown; online/offline, rating, vehicle and last-ride date are all
  real. A preferred driver is still added only from the ride-completion
  screen, so "Add New Driver" routes to Discovery.
*/
export default function PreferredDriversPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [drivers, setDrivers] = useState([])
  const [tier, setTier] = useState('none')
  const [removingId, setRemovingId] = useState(null)

  const load = useCallback(async () => {
    if (!user) return
    const [list, t] = await Promise.all([
      fetchPreferredDriversForRider(user.id),
      fetchSubscriptionTier(user.id),
    ])
    setDrivers(list)
    setTier(t)
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const isEligible = ELIGIBLE_TIERS.includes(tier)

  async function handleRemove(preferredId) {
    setRemovingId(preferredId)
    try {
      await removePreferredDriver(preferredId)
      setDrivers(prev => prev.filter(d => d.preferredId !== preferredId))
    } finally {
      setRemovingId(null)
    }
  }

  function bookDriver(d) {
    navigate('/rider/book-ride', { state: { driver: { id: d.driverId, name: d.name, avatar: d.avatar, rating: d.rating, type: d.type, vehicleId: d.vehicleId } } })
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-background)', fontFamily: 'var(--font-sans)' }}>

      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center gap-3 px-5 py-3"
        style={{ background: 'var(--color-surface)', boxShadow: '0 1px 0 var(--color-surface-container-low)' }}>
        <button onClick={() => navigate(-1)}
          style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-surface-container-low)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-on-surface)' }}>Preferred Drivers</h1>
          <p style={{ fontSize: 12, color: 'var(--color-secondary)' }}>Requested first, whenever they're online</p>
        </div>
      </header>

      <main style={{ maxWidth: 480, width: '100%', margin: '0 auto', padding: '20px 20px 110px' }}>

        {/* Title block */}
        <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-primary)' }}>Your circle</p>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-on-secondary-container)', background: 'var(--color-secondary-container)', padding: '3px 10px', borderRadius: 9999 }}>
            {drivers.length} {drivers.length === 1 ? 'driver' : 'drivers'}
          </span>
        </div>
        <p style={{ fontSize: 14, color: 'var(--color-secondary)', marginBottom: 20 }}>
          Save someone you enjoyed riding with, then request them by name next time.
        </p>

        {!isEligible && (
          <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: '#B45309', marginBottom: 8 }}>
              {drivers.length > 0
                ? 'Your Care Plan / Family Plan has expired — upgrade to request these drivers directly again.'
                : 'Saving and requesting preferred drivers is a Care Plan / Family Plan benefit.'}
            </p>
            <button onClick={() => navigate('/rider/subscription')} style={{ background: 'none', border: 'none', color: '#B45309', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
              Upgrade Plan →
            </button>
          </div>
        )}

        {loading && <p style={{ fontSize: 14, color: 'var(--color-secondary)', textAlign: 'center', padding: '24px 0' }}>Loading…</p>}

        {!loading && drivers.length === 0 && (
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)', borderRadius: 16, padding: 24, textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: 'var(--color-secondary)' }}>
              No preferred drivers yet — save one from the ride-completion screen after your next ride.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {drivers.map(d => (
            <div key={d.preferredId} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)', borderRadius: 16, padding: 16, boxShadow: '0 1px 6px rgba(26,43,60,0.06)' }}>
              <div className="flex items-center gap-3 mb-3">
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
                  {d.avatar}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-on-surface)' }}>{d.name}</p>
                  <div className="flex items-center gap-1.5">
                    <span style={{ fontSize: 12, color: '#F59E0B' }}>★</span>
                    <span style={{ fontSize: 12, color: 'var(--color-on-surface)' }}>{d.rating}</span>
                    <span style={{ fontSize: 12, color: 'var(--color-secondary)' }}>· {d.type}</span>
                  </div>
                  <div className="flex items-center gap-1.5" style={{ marginTop: 3 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: d.isOnline ? 'var(--color-primary)' : 'var(--color-outline-variant)', display: 'inline-block' }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: d.isOnline ? 'var(--color-primary)' : 'var(--color-secondary)' }}>
                      {d.isOnline ? 'Available now' : 'Offline'}
                    </span>
                  </div>
                </div>
                <button onClick={() => handleRemove(d.preferredId)} disabled={removingId === d.preferredId}
                  style={{ padding: '6px 10px', background: 'none', border: '1px solid var(--color-outline-variant)', borderRadius: 9999, fontSize: 12, fontWeight: 600, color: 'var(--color-error)', cursor: 'pointer' }}>
                  {removingId === d.preferredId ? '…' : 'Remove'}
                </button>
              </div>

              <p style={{ fontSize: 12, color: 'var(--color-secondary)', marginBottom: 10 }}>
                Last ride: {d.lastRideAt ? new Date(d.lastRideAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No completed rides yet'}
              </p>

              {d.status === 'pending' && (
                <p style={{ fontSize: 12, color: 'var(--color-secondary)', fontStyle: 'italic' }}>Waiting for driver approval</p>
              )}
              {d.status === 'blocked_by_driver' && (
                <p style={{ fontSize: 12, color: 'var(--color-error)' }}>This driver isn't accepting your requests right now</p>
              )}
              {d.status === 'active' && (
                <button
                  onClick={() => bookDriver(d)}
                  disabled={!d.isOnline || !isEligible}
                  style={{ width: '100%', height: 40, background: (d.isOnline && isEligible) ? 'var(--color-primary)' : 'var(--color-surface-container)', color: (d.isOnline && isEligible) ? 'white' : 'var(--color-secondary)', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: (d.isOnline && isEligible) ? 'pointer' : 'default' }}>
                  {!isEligible ? 'Upgrade to request' : d.isOnline ? 'Request Ride' : 'Offline right now'}
                </button>
              )}
            </div>
          ))}

          {/* Add New Driver */}
          <button onClick={() => navigate('/rider/home', { state: { tab: 'drivers' } })}
            style={{ border: '2px dashed var(--color-outline-variant)', background: 'none', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-secondary-container)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-secondary-container)" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            </div>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-on-surface)' }}>Add New Driver</p>
            <p style={{ fontSize: 12, color: 'var(--color-secondary)' }}>Browse drivers, then save one after your ride</p>
          </button>
        </div>
      </main>

      <RiderBottomNav active="drivers" />
    </div>
  )
}
