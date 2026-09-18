import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth.jsx'
import RiderBottomNav from '@/components/RiderBottomNav'

// Same estimate used on Home/Profile (src/pages/rider/HomePage.jsx) —
// kept identical so this detail page and the summary widget never
// disagree with each other.
const CO2_SAVED_G_PER_KM = 120

export default function EcoImpactPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [rides, setRides] = useState([])

  useEffect(() => {
    if (!user) return
    supabase.from('rides').select('distance_km, completed_at').eq('rider_id', user.id).eq('status', 'completed')
      .then(({ data }) => { setRides(data ?? []); setLoading(false) })
  }, [user])

  const totalDistanceKm = rides.reduce((sum, r) => sum + Number(r.distance_km || 0), 0)
  const totalCo2Kg = (totalDistanceKm * CO2_SAVED_G_PER_KM) / 1000

  // Last 6 months, real completed-ride distance per month.
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - (5 - i))
    return d
  })
  const monthlyKm = months.map(m => {
    const km = rides
      .filter(r => r.completed_at && new Date(r.completed_at).getFullYear() === m.getFullYear() && new Date(r.completed_at).getMonth() === m.getMonth())
      .reduce((sum, r) => sum + Number(r.distance_km || 0), 0)
    return { label: m.toLocaleDateString('en-IN', { month: 'short' }), km }
  })
  const maxKm = Math.max(1, ...monthlyKm.map(m => m.km))

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-background)', fontFamily: 'var(--font-sans)' }}>
      <header className="sticky top-0 z-40 flex items-center gap-3 px-5 py-3"
        style={{ background: 'var(--color-surface)', boxShadow: '0 1px 0 var(--color-surface-container-low)' }}>
        <button onClick={() => navigate(-1)}
          style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-surface-container-low)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-on-surface)' }}>Eco Impact Report</h1>
      </header>

      <main style={{ maxWidth: 480, width: '100%', margin: '0 auto', padding: '20px 20px 110px' }}>
        {loading ? (
          <p style={{ fontSize: 14, color: 'var(--color-secondary)' }}>Loading…</p>
        ) : (
          <>
            <div style={{ background: 'rgba(0,109,55,0.08)', border: '1px solid rgba(0,109,55,0.2)', borderRadius: 16, padding: 20, marginBottom: 20, textAlign: 'center' }}>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-primary)', marginBottom: 6 }}>Total CO₂ Saved</p>
              <p style={{ fontSize: 36, fontWeight: 700, color: 'var(--color-primary)' }}>{totalCo2Kg.toFixed(1)}kg</p>
              <p style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 4 }}>Across {rides.length} completed EV {rides.length === 1 ? 'ride' : 'rides'} · {totalDistanceKm.toFixed(1)} km</p>
            </div>

            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-secondary)', marginBottom: 12 }}>Last 6 Months</p>
            <div style={{ background: 'white', borderRadius: 16, padding: 20, boxShadow: '0 1px 6px rgba(26,43,60,0.06)', marginBottom: 20 }}>
              <div className="flex items-end justify-between gap-2" style={{ height: 100, marginBottom: 8 }}>
                {monthlyKm.map((m, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                    <div style={{ width: '100%', height: `${Math.max(2, (m.km / maxKm) * 100)}%`, background: i === monthlyKm.length - 1 ? 'var(--color-primary)' : 'var(--color-surface-container)', borderRadius: '4px 4px 0 0' }} />
                  </div>
                ))}
              </div>
              <div className="flex justify-between">
                {monthlyKm.map((m, i) => <span key={i} style={{ fontSize: 11, color: 'var(--color-secondary)', flex: 1, textAlign: 'center' }}>{m.label}</span>)}
              </div>
            </div>

            <p style={{ fontSize: 12, color: 'var(--color-secondary)', lineHeight: 1.6 }}>
              Estimate based on {CO2_SAVED_G_PER_KM}g CO₂ saved per km versus an equivalent petrol trip, using the real distance of your completed rides.
            </p>
          </>
        )}
      </main>

      <RiderBottomNav active="profile" />
    </div>
  )
}
