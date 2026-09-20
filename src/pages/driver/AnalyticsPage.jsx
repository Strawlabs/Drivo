import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth.jsx'

/*
  Earnings/revenue already live on the Rides tab (RidesTab, "Performance
  Insights") — this is deliberately the other half: real trends that
  tab doesn't show. Rating trend can't distinguish "you rejected an
  offer" from "it was reassigned" (dispatch_pending_rides doesn't keep
  that kind of event log, only the current driver_id), so an
  acceptance-rate stat isn't buildable honestly from what's actually
  tracked — left out rather than approximated.
*/
export default function DriverAnalyticsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [ratings, setRatings] = useState([])
  const [goHomeSessions, setGoHomeSessions] = useState([])
  const [preferredCount, setPreferredCount] = useState(0)

  useEffect(() => {
    if (!user) return
    supabase.from('driver_profiles').select('id').eq('user_id', user.id).maybeSingle().then(({ data: dp }) => {
      if (!dp) { setLoading(false); return }
      Promise.all([
        supabase.from('ride_ratings').select('rating, created_at').eq('driver_id', dp.id).order('created_at', { ascending: true }),
        supabase.from('go_home_sessions').select('status, created_at').eq('driver_id', dp.id).order('created_at', { ascending: false }),
        supabase.from('preferred_drivers').select('id', { count: 'exact', head: true }).eq('driver_id', dp.id).eq('status', 'active'),
      ]).then(([r, g, p]) => {
        setRatings(r.data ?? [])
        setGoHomeSessions(g.data ?? [])
        setPreferredCount(p.count ?? 0)
        setLoading(false)
      })
    })
  }, [user])

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - (5 - i))
    return d
  })
  const monthlyRating = months.map(m => {
    const inMonth = ratings.filter(r => {
      const rd = new Date(r.created_at)
      return rd.getFullYear() === m.getFullYear() && rd.getMonth() === m.getMonth()
    })
    const avg = inMonth.length ? inMonth.reduce((s, r) => s + r.rating, 0) / inMonth.length : null
    return { label: m.toLocaleDateString('en-IN', { month: 'short' }), avg, count: inMonth.length }
  })
  const overallAvg = ratings.length ? (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(2) : '—'

  const goHomeByStatus = ['completed', 'expired', 'cancelled', 'active'].map(status => ({
    status, count: goHomeSessions.filter(s => s.status === status).length,
  })).filter(s => s.count > 0)

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-background)', fontFamily: 'var(--font-sans)' }}>
      <header className="sticky top-0 z-40 flex items-center gap-3 px-5 py-3"
        style={{ background: 'var(--color-surface)', boxShadow: '0 1px 0 var(--color-surface-container-low)' }}>
        <button onClick={() => navigate(-1)}
          style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-surface-container-low)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-on-surface)' }}>📊 Analytics</h1>
      </header>

      <main style={{ maxWidth: 480, width: '100%', margin: '0 auto', padding: '20px 20px 60px' }}>
        {loading ? (
          <p style={{ fontSize: 14, color: 'var(--color-secondary)' }}>Loading…</p>
        ) : (
          <>
            <div style={{ background: 'rgba(0,109,55,0.06)', border: '1px solid rgba(0,109,55,0.2)', borderRadius: 14, padding: 18, marginBottom: 20, textAlign: 'center' }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-primary)', marginBottom: 4 }}>Overall Rating</p>
              <p style={{ fontSize: 32, fontWeight: 700, color: 'var(--color-primary)' }}>⭐ {overallAvg}</p>
              <p style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 2 }}>From {ratings.length} rider {ratings.length === 1 ? 'review' : 'reviews'}</p>
            </div>

            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-secondary)', marginBottom: 10 }}>Rating Trend (6 Months)</p>
            <div style={{ background: 'white', borderRadius: 14, padding: 18, marginBottom: 20, border: '1px solid rgba(241,245,249,1)' }}>
              <div className="flex items-end justify-between gap-2" style={{ height: 90, marginBottom: 8 }}>
                {monthlyRating.map((m, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }} title={m.avg ? `${m.avg.toFixed(2)}★ (${m.count})` : 'No reviews'}>
                    <div style={{ width: '100%', height: m.avg ? `${(m.avg / 5) * 100}%` : '2%', background: i === monthlyRating.length - 1 ? 'var(--color-primary)' : 'var(--color-surface-container)', borderRadius: '4px 4px 0 0' }} />
                  </div>
                ))}
              </div>
              <div className="flex justify-between">
                {monthlyRating.map((m, i) => <span key={i} style={{ fontSize: 11, color: 'var(--color-secondary)', flex: 1, textAlign: 'center' }}>{m.label}</span>)}
              </div>
            </div>

            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-secondary)', marginBottom: 10 }}>Go Home Mode</p>
            <div style={{ background: 'white', borderRadius: 14, padding: 16, marginBottom: 20, border: '1px solid rgba(241,245,249,1)' }}>
              {goHomeSessions.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--color-secondary)' }}>You haven't used Go Home Mode yet.</p>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: 'var(--color-on-surface)', marginBottom: 10 }}>{goHomeSessions.length} total {goHomeSessions.length === 1 ? 'session' : 'sessions'}</p>
                  {goHomeByStatus.map(s => (
                    <div key={s.status} className="flex justify-between" style={{ padding: '6px 0', borderTop: '1px solid var(--color-outline-variant)', textTransform: 'capitalize', fontSize: 13 }}>
                      <span style={{ color: 'var(--color-on-surface)' }}>{s.status}</span>
                      <span style={{ fontWeight: 700, color: 'var(--color-on-surface)' }}>{s.count}</span>
                    </div>
                  ))}
                </>
              )}
            </div>

            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-secondary)', marginBottom: 10 }}>Preferred Riders</p>
            <div style={{ background: 'white', borderRadius: 14, padding: 16, border: '1px solid rgba(241,245,249,1)' }}>
              <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-on-surface)' }}>{preferredCount}</p>
              <p style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 2 }}>{preferredCount === 1 ? 'rider has' : 'riders have'} you saved as preferred</p>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
