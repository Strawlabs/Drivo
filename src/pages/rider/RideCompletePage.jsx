import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

const BADGES = ['Clean Car', 'Expert Driving', 'Great Chat', 'On Time', 'Safe Driver']

export default function RideCompletePage() {
  const navigate = useNavigate()
  const location = useLocation()

  const rideId      = location.state?.rideId      ?? null
  const driver      = location.state?.driver      ?? { name: 'Ramesh K.', rating: 4.9, avatar: 'RK' }
  const fare        = location.state?.fare        ?? 284
  const pickup      = location.state?.pickup      ?? 'Koramangala 5th Block'
  const destination = location.state?.destination ?? 'MG Road Metro Station'

  const [stars, setStars]       = useState(0)
  const [badges, setBadges]     = useState([])
  const [comment, setComment]   = useState('')
  const [submitting, setSubmitting] = useState(false)

  function toggleBadge(b) {
    setBadges(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b])
  }

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)
    if (rideId) {
      await supabase.from('rides').update({ status: 'completed', final_fare: fare }).eq('id', rideId)
    }
    navigate('/rider/home', { replace: true })
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-background)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>

      {/* Floating particles */}
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} style={{
          position: 'fixed', borderRadius: '50%', opacity: 0.15, pointerEvents: 'none',
          background: i % 2 === 0 ? '#2ecc71' : '#006d37',
          width: Math.random() * 20 + 6, height: Math.random() * 20 + 6,
          left: `${(i * 5.3) % 100}vw`, top: `${(i * 7.1) % 100}vh`,
          animation: `float ${3 + (i % 4)}s ease-in-out infinite`,
          animationDelay: `${(i * 0.3) % 2}s`,
        }} />
      ))}

      {/* Header */}
      <header className="w-full flex justify-between items-center px-5 py-6" style={{ maxWidth: 480 }}>
        <div className="flex items-center gap-3">
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ color: 'white', fontSize: 20 }}>check_circle</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-on-surface)' }}>Arrived</h1>
        </div>
        <button onClick={() => navigate('/rider/home', { replace: true })}
          style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--color-surface-container)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--color-on-surface)' }}>close</span>
        </button>
      </header>

      <main className="w-full px-5 pb-10 flex flex-col gap-5" style={{ maxWidth: 480, overflowY: 'auto' }}>

        {/* Fare card */}
        <section style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', border: '1px solid #F1F5F9', borderRadius: 16, padding: 24, textAlign: 'center', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 20px rgba(26,43,60,0.06)' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: '50%', background: 'rgba(46,204,113,0.15)', filter: 'blur(30px)' }} />
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--color-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>Total Fare</p>
          <h2 style={{ fontSize: 44, fontWeight: 700, color: 'var(--color-on-surface)', letterSpacing: '-0.02em', marginBottom: 16 }}>₹{fare.toFixed ? fare.toFixed(2) : fare}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, paddingTop: 16, borderTop: '1px solid rgba(187,203,187,0.3)' }}>
            <div>
              <p style={{ fontSize: 12, color: 'var(--color-secondary)' }}>Distance</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-primary)' }}>12.4 km</p>
            </div>
            <div>
              <p style={{ fontSize: 12, color: 'var(--color-secondary)' }}>Duration</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-primary)' }}>34 mins</p>
            </div>
          </div>
        </section>

        {/* Payment */}
        <section className="flex flex-col gap-3">
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-on-surface-variant)', letterSpacing: '0.03em' }}>Payment Methods</p>
          {[
            { label: 'Pay via UPI', icon: 'account_balance_wallet', dark: true },
            { label: 'Pay Cash',    icon: 'payments',               dark: false },
          ].map(({ label, icon, dark }) => (
            <button key={label} style={{ width: '100%', minHeight: 52, background: dark ? 'var(--color-on-surface)' : 'var(--color-surface-container)', color: dark ? 'white' : 'var(--color-on-surface)', border: 'none', borderRadius: 12, padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined">{icon}</span>
                {label}
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          ))}
          <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '4px 0' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
            Download Receipt
          </button>
        </section>

        {/* Rating */}
        <section style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', border: '1px solid #F1F5F9', borderRadius: 16, padding: 20, boxShadow: '0 2px 12px rgba(26,43,60,0.05)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div style={{ position: 'relative' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 22, border: '2px solid var(--color-primary-container)' }}>
                {driver.avatar}
              </div>
              <div style={{ position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, background: 'var(--color-primary)', borderRadius: '50%', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 12, color: 'white' }}>check</span>
              </div>
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-on-surface)' }}>Rate your Driver</h3>
              <p style={{ fontSize: 13, color: 'var(--color-secondary)' }}>{driver.name} is an EV Specialist</p>
            </div>
          </div>

          {/* Stars */}
          <div className="flex justify-center gap-3 py-3">
            {[1,2,3,4,5].map(n => (
              <button key={n} onClick={() => setStars(n)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: 'transform 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                <span className="material-symbols-outlined" style={{ fontSize: 36, color: n <= stars ? 'var(--color-primary-container)' : 'var(--color-outline-variant)', fontVariationSettings: n <= stars ? "'FILL' 1" : "'FILL' 0" }}>star</span>
              </button>
            ))}
          </div>

          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Add a comment (optional)..."
            rows={3}
            style={{ width: '100%', background: 'var(--color-surface-container-low)', border: 'none', borderRadius: 12, padding: '10px 14px', fontSize: 14, color: 'var(--color-on-surface)', resize: 'none', outline: 'none', boxSizing: 'border-box', marginTop: 4 }}
          />
        </section>

        {/* Feedback badges */}
        <div className="flex flex-wrap gap-2">
          {BADGES.map(b => (
            <button key={b} onClick={() => toggleBadge(b)}
              style={{ padding: '5px 14px', borderRadius: 9999, fontSize: 12, fontWeight: 600, border: `1px solid ${badges.includes(b) ? 'var(--color-primary)' : 'rgba(0,109,55,0.2)'}`, background: badges.includes(b) ? 'rgba(0,109,55,0.1)' : 'rgba(46,204,113,0.06)', color: 'var(--color-on-primary-container)', cursor: 'pointer', transition: 'all 0.15s' }}>
              {b}
            </button>
          ))}
        </div>

        {/* Submit */}
        <button onClick={handleSubmit} disabled={submitting}
          style={{ width: '100%', height: 52, background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 9999, fontSize: 15, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1, boxShadow: '0 4px 16px rgba(0,109,55,0.25)', transition: 'all 0.2s' }}>
          {submitting ? 'Submitting…' : 'Submit Feedback & Done'}
        </button>
      </main>

      <style>{`
        @keyframes float {
          0%,100% { transform:translateY(0); }
          50% { transform:translateY(-12px); }
        }
      `}</style>
    </div>
  )
}
