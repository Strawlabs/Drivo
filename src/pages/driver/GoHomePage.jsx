import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth.jsx'
import {
  HOME_ZONES, validateGoHomeInput, activateGoHome, deactivateGoHome,
  fetchActiveGoHomeSession, toLocalDatetimeInputValue,
} from '@/lib/goHome'

/*
  Full-page Go Home Mode (Stitch: go_home_mode). Replaces the bottom-sheet
  modal opened from the driver Home "Quick Actions". Kept honest: the
  Stitch frame's "Est. Earnings $42–$65" card and its "Via I-80 E · 3
  optimal pickups" route options have no backing engine, so they're not
  shown; the real controls (home zone, radius, cutoff time, optional route
  note) match matchGoHomeRide's inputs.
*/
export default function GoHomePage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [driverProfileId, setDriverProfileId] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  const [zoneName, setZoneName] = useState(HOME_ZONES[0].name)
  const [radiusKm, setRadiusKm] = useState(3)
  const [endTime, setEndTime] = useState(() => toLocalDatetimeInputValue(new Date(Date.now() + 2 * 60 * 60 * 1000)))
  const [note, setNote] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!user) return
    async function load() {
      const { data: dp } = await supabase.from('driver_profiles').select('id').eq('user_id', user.id).maybeSingle()
      if (!dp) { setLoading(false); return }
      setDriverProfileId(dp.id)
      const active = await fetchActiveGoHomeSession(dp.id)
      setSession(active)
      if (active) {
        setZoneName(active.preferred_route?.zone_name ?? HOME_ZONES[0].name)
        setRadiusKm(active.home_zone_radius_km ?? 3)
        if (active.end_time) setEndTime(toLocalDatetimeInputValue(new Date(active.end_time)))
        setNote(active.preferred_route?.note ?? '')
      }
      setLoading(false)
    }
    load()
  }, [user])

  useEffect(() => {
    if (!session) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [session])

  async function handleActivate() {
    setError(null)
    const validationError = validateGoHomeInput({ zoneName, radiusKm: Number(radiusKm), endTime })
    if (validationError) { setError(validationError); return }
    setBusy(true)
    try {
      const newSession = await activateGoHome({ driverId: driverProfileId, zoneName, radiusKm: Number(radiusKm), endTime, note })
      setSession(newSession)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDeactivate() {
    setBusy(true)
    try {
      await deactivateGoHome(session.id, 'cancelled')
      setSession(null)
    } finally {
      setBusy(false)
    }
  }

  const msLeft = session ? new Date(session.end_time).getTime() - now : 0
  const minsLeft = Math.max(0, Math.floor(msLeft / 60000))
  const hoursLeft = Math.floor(minsLeft / 60)

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-background)', fontFamily: 'var(--font-sans)' }}>

      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center gap-3 px-5 py-3"
        style={{ background: 'var(--color-surface)', boxShadow: '0 1px 0 var(--color-surface-container-low)' }}>
        <button onClick={() => navigate(-1)}
          style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-surface-container-low)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-on-surface)' }}>Go Home Mode</h1>
      </header>

      <main style={{ maxWidth: 480, width: '100%', margin: '0 auto', padding: '20px 20px 60px' }}>

        {/* Intro card */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', background: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)', borderRadius: 16, padding: 16, marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--color-primary-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-primary-container)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21s7-7.4 7-12a7 7 0 1 0-14 0c0 4.6 7 12 7 12z"/><circle cx="12" cy="9" r="2.4"/>
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-on-surface)' }}>Get rides along your route home</p>
            <p style={{ fontSize: 13, color: 'var(--color-secondary)', marginTop: 2 }}>
              Only requests heading toward your home area are shown while this is on.
            </p>
          </div>
        </div>

        {loading && <p style={{ fontSize: 14, color: 'var(--color-secondary)', textAlign: 'center', padding: '24px 0' }}>Loading…</p>}

        {!loading && session && (
          <div className="flex flex-col gap-4">
            <div style={{ background: 'rgba(0,109,55,0.08)', border: '1px solid rgba(0,109,55,0.25)', borderRadius: 16, padding: 18 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 4 }}>
                ACTIVE — heading toward {session.preferred_route?.zone_name}
              </p>
              <p style={{ fontSize: 13, color: 'var(--color-on-surface)' }}>
                Radius: {session.home_zone_radius_km} km · Ends in {hoursLeft > 0 ? `${hoursLeft}h ` : ''}{minsLeft % 60}m
              </p>
              {session.preferred_route?.note && (
                <p style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 6 }}>Note: {session.preferred_route.note}</p>
              )}
            </div>
            <button onClick={handleDeactivate} disabled={busy}
              style={{ width: '100%', height: 52, background: 'var(--color-error-container)', color: 'var(--color-error)', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              {busy ? 'Ending…' : 'End Go Home Mode'}
            </button>
          </div>
        )}

        {!loading && !session && (
          <div className="flex flex-col gap-4">
            {error && (
              <p style={{ fontSize: 13, color: 'var(--color-error)', background: 'var(--color-error-container)', borderRadius: 10, padding: '8px 12px' }}>{error}</p>
            )}

            {/* Home area */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)', borderRadius: 16, padding: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-secondary)' }}>Home area</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                {HOME_ZONES.map(z => (
                  <button key={z.name} onClick={() => setZoneName(z.name)}
                    style={{ height: 42, borderRadius: 10, border: `2px solid ${zoneName === z.name ? 'var(--color-primary)' : 'var(--color-outline-variant)'}`, background: zoneName === z.name ? 'rgba(0,109,55,0.08)' : 'none', color: 'var(--color-on-surface)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {z.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Radius + cutoff */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-on-surface)' }}>Radius (km)</label>
                <input type="number" min={1} max={15} value={radiusKm} onChange={e => setRadiusKm(e.target.value)}
                  style={{ width: '100%', height: 46, borderRadius: 10, border: '1px solid var(--color-outline-variant)', padding: '0 12px', fontSize: 14, marginTop: 6, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-on-surface)' }}>End time</label>
                <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)}
                  style={{ width: '100%', height: 46, borderRadius: 10, border: '1px solid var(--color-outline-variant)', padding: '0 12px', fontSize: 14, marginTop: 6, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-on-surface)' }}>Preferred route note (optional)</label>
                <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. via Outer Ring Road"
                  style={{ width: '100%', height: 46, borderRadius: 10, border: '1px solid var(--color-outline-variant)', padding: '0 12px', fontSize: 14, marginTop: 6, boxSizing: 'border-box' }} />
              </div>
            </div>

            <button onClick={handleActivate} disabled={busy || !driverProfileId}
              style={{ width: '100%', height: 52, background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 16px rgba(0,109,55,0.25)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/></svg>
              {busy ? 'Activating…' : 'Activate Go Home Mode'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
