import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth.jsx'
import RiderBottomNav from '@/components/RiderBottomNav'

/*
  A history view over the safety features that already exist elsewhere
  (SOS trigger and trip sharing live on the Active Ride screen;
  emergency contacts live on the Family Dashboard) rather than a
  separate feature of its own — real SOS/share records, not a
  duplicate management UI.
*/
export default function SafetyCenterPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [sosEvents, setSosEvents] = useState([])
  const [sharedTrips, setSharedTrips] = useState([])

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('sos_events').select('id, resolved_at, created_at, rides(pickup_address, destination_address)').eq('triggered_by', user.id).order('created_at', { ascending: false }),
      supabase.from('shared_trip_links').select('id, token, created_at, expires_at, rides(pickup_address, destination_address)').eq('created_by', user.id).order('created_at', { ascending: false }),
    ]).then(([sos, shared]) => {
      setSosEvents(sos.data ?? [])
      setSharedTrips(shared.data ?? [])
      setLoading(false)
    })
  }, [user])

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-background)', fontFamily: 'var(--font-sans)' }}>
      <header className="sticky top-0 z-40 flex items-center gap-3 px-5 py-3"
        style={{ background: 'var(--color-surface)', boxShadow: '0 1px 0 var(--color-surface-container-low)' }}>
        <button onClick={() => navigate(-1)}
          style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-surface-container-low)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-on-surface)' }}>Safety Center</h1>
      </header>

      <main style={{ maxWidth: 480, width: '100%', margin: '0 auto', padding: '20px 20px 110px' }}>
        <a href="tel:112" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'var(--color-on-surface)', borderRadius: 16, padding: 20, marginBottom: 20, textDecoration: 'none' }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'white', marginBottom: 4 }}>Emergency Helpline</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>National Emergency Number — 112</p>
          </div>
          <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-error)', color: 'white', padding: '10px 16px', borderRadius: 9999, fontSize: 13, fontWeight: 700 }}>Call</span>
        </a>

        <button onClick={() => navigate('/rider/family')}
          className="w-full flex items-center justify-between"
          style={{ background: 'white', border: 'none', borderRadius: 14, padding: 16, marginBottom: 24, cursor: 'pointer', textAlign: 'left', boxShadow: '0 1px 6px rgba(26,43,60,0.06)' }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-on-surface)' }}>Emergency Contacts</p>
            <p style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 2 }}>Managed from your Family Dashboard</p>
          </div>
          <span className="material-symbols-outlined" style={{ color: 'var(--color-secondary)' }}>chevron_right</span>
        </button>

        {loading ? (
          <p style={{ fontSize: 14, color: 'var(--color-secondary)' }}>Loading…</p>
        ) : (
          <>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-secondary)', marginBottom: 10 }}>SOS History</p>
            {sosEvents.length === 0 && <p style={{ fontSize: 13, color: 'var(--color-secondary)', marginBottom: 20 }}>No SOS events triggered — that's a good thing.</p>}
            <div className="flex flex-col gap-2" style={{ marginBottom: 24 }}>
              {sosEvents.map(e => (
                <div key={e.id} style={{ background: 'white', borderRadius: 12, padding: 14, boxShadow: '0 1px 6px rgba(26,43,60,0.06)' }}>
                  <div className="flex justify-between items-start">
                    <p style={{ fontSize: 13, color: 'var(--color-on-surface)' }}>{e.rides?.pickup_address ?? '—'} → {e.rides?.destination_address ?? '—'}</p>
                    <span style={{ fontSize: 11, fontWeight: 700, color: e.resolved_at ? 'var(--color-primary)' : 'var(--color-error)', background: e.resolved_at ? 'rgba(46,204,113,0.12)' : 'rgba(186,26,26,0.1)', padding: '2px 8px', borderRadius: 6, flexShrink: 0, marginLeft: 8 }}>
                      {e.resolved_at ? 'Resolved' : 'Open'}
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--color-secondary)', marginTop: 4 }}>{new Date(e.created_at).toLocaleString('en-IN')}</p>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-secondary)', marginBottom: 10 }}>Shared Trips</p>
            {sharedTrips.length === 0 && <p style={{ fontSize: 13, color: 'var(--color-secondary)' }}>You haven't shared a trip yet.</p>}
            <div className="flex flex-col gap-2">
              {sharedTrips.map(t => {
                const expired = new Date(t.expires_at) < new Date()
                return (
                  <div key={t.id} style={{ background: 'white', borderRadius: 12, padding: 14, boxShadow: '0 1px 6px rgba(26,43,60,0.06)' }}>
                    <div className="flex justify-between items-start">
                      <p style={{ fontSize: 13, color: 'var(--color-on-surface)' }}>{t.rides?.pickup_address ?? '—'} → {t.rides?.destination_address ?? '—'}</p>
                      <span style={{ fontSize: 11, fontWeight: 700, color: expired ? 'var(--color-secondary)' : 'var(--color-primary)', background: expired ? 'var(--color-surface-container)' : 'rgba(46,204,113,0.12)', padding: '2px 8px', borderRadius: 6, flexShrink: 0, marginLeft: 8 }}>
                        {expired ? 'Expired' : 'Active'}
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--color-secondary)', marginTop: 4 }}>Shared {new Date(t.created_at).toLocaleString('en-IN')}</p>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </main>

      <RiderBottomNav active="profile" />
    </div>
  )
}
