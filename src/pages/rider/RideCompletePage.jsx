import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const FEEDBACK_BADGES = ['Clean Car', 'Expert Driving', 'Great Chat', 'On Time', 'Safe Driver']

function Particle({ color, style }) {
  return <div style={{ position: 'absolute', borderRadius: '50%', opacity: 0.2, background: color, ...style }} />
}

export default function RideCompletePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const driver = location.state?.driver ?? { name: 'Ramesh K.', rating: 4.9, avatar: 'RK' }
  const fare = location.state?.fare ?? 284

  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  const [selectedBadges, setSelectedBadges] = useState([])
  const [particles] = useState(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      color: i % 2 === 0 ? '#2ecc71' : '#006d37',
      style: {
        width: Math.random() * 16 + 6,
        height: Math.random() * 16 + 6,
        left: `${Math.random() * 100}vw`,
        top: `${Math.random() * 40}vh`,
        animation: `floatParticle ${Math.random() * 4 + 3}s ease-in-out infinite`,
        animationDelay: `${Math.random() * 2}s`,
      }
    }))
  )

  function toggleBadge(b) {
    setSelectedBadges(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b])
  }

  function handleSubmit() {
    navigate('/rider/home')
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-background)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <style>{`
        @keyframes floatParticle {
          0%   { transform: translateY(0); }
          50%  { transform: translateY(-14px); }
          100% { transform: translateY(0); }
        }
      `}</style>

      {/* Celebration particles */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        {particles.map(p => <Particle key={p.id} color={p.color} style={p.style} />)}
      </div>

      {/* Header */}
      <header style={{ width: '100%', maxWidth: 480, padding: '28px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
        <div className="flex items-center gap-3">
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-on-surface)' }}>Arrived!</h1>
        </div>
        <button onClick={() => navigate('/rider/home')}
          style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--color-surface-container)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface)" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </header>

      <main style={{ width: '100%', maxWidth: 480, padding: '20px 20px 40px', flex: 1, overflowY: 'auto', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Fare Hero Card */}
        <section style={{ position: 'relative', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', border: '1px solid var(--color-outline-variant)', borderRadius: 20, padding: 28, textAlign: 'center', overflow: 'hidden', boxShadow: '0 4px 20px rgba(26,43,60,0.05)' }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, background: 'rgba(46,204,113,0.15)', borderRadius: '50%', filter: 'blur(20px)' }} />
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--color-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>Total Fare</p>
          <h2 style={{ fontSize: 44, fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: 20, letterSpacing: '-0.02em' }}>₹{typeof fare === 'number' ? fare.toFixed(2) : fare}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, borderTop: '1px solid var(--color-outline-variant)', paddingTop: 16 }}>
            <div>
              <p style={{ fontSize: 12, color: 'var(--color-secondary)', marginBottom: 4 }}>Distance</p>
              <p style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-primary)' }}>8.4 km</p>
            </div>
            <div>
              <p style={{ fontSize: 12, color: 'var(--color-secondary)', marginBottom: 4 }}>Duration</p>
              <p style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-primary)' }}>22 mins</p>
            </div>
          </div>
        </section>

        {/* Payment Options */}
        <section>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--color-secondary)', textTransform: 'uppercase', marginBottom: 10, paddingLeft: 4 }}>Payment</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button style={{ width: '100%', height: 52, background: 'var(--color-inverse-surface)', color: 'var(--color-inverse-on-surface)', borderRadius: 12, border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
              <div className="flex items-center gap-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
                <span>Pay via UPI</span>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            </button>
            <button style={{ width: '100%', height: 52, background: 'var(--color-surface-container)', color: 'var(--color-on-surface)', borderRadius: 12, border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
              <div className="flex items-center gap-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="4" width="22" height="16" rx="2"/><circle cx="9" cy="12" r="4" fill="currentColor" opacity="0.4"/><circle cx="15" cy="12" r="4" fill="currentColor" opacity="0.6"/></svg>
                <span>Pay Cash</span>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            </button>
            <button style={{ width: '100%', height: 40, background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              Download Receipt
            </button>
          </div>
        </section>

        {/* Rating Section */}
        <section style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', border: '1px solid var(--color-outline-variant)', borderRadius: 20, padding: 20, boxShadow: '0 2px 8px rgba(26,43,60,0.04)' }}>
          <div className="flex items-center gap-3 mb-5">
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 18, border: '2px solid var(--color-primary-container)' }}>
                {driver.avatar}
              </div>
              <div style={{ position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
              </div>
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-on-surface)' }}>Rate your Driver</h3>
              <p style={{ fontSize: 13, color: 'var(--color-secondary)', marginTop: 2 }}>{driver.name} · EV Specialist</p>
            </div>
          </div>

          {/* Stars */}
          <div className="flex justify-center gap-3 mb-5">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setStars(n)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, transition: 'transform 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill={n <= stars ? '#2ecc71' : 'none'} stroke={n <= stars ? 'none' : '#D1D5DB'} strokeWidth="1.5">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </button>
            ))}
          </div>

          {/* Comment */}
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Add a comment (optional)..."
            style={{ width: '100%', height: 88, padding: 14, background: 'var(--color-surface-container-low)', border: 'none', borderRadius: 12, resize: 'none', fontSize: 15, color: 'var(--color-on-surface)', fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => e.target.style.boxShadow = '0 0 0 2px rgba(0,109,55,0.25)'}
            onBlur={e => e.target.style.boxShadow = 'none'}
          />
        </section>

        {/* Feedback Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {FEEDBACK_BADGES.map(b => {
            const active = selectedBadges.includes(b)
            return (
              <button key={b} onClick={() => toggleBadge(b)}
                style={{ padding: '7px 16px', borderRadius: 9999, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid', transition: 'all 0.15s', background: active ? 'rgba(46,204,113,0.15)' : 'transparent', borderColor: active ? 'var(--color-primary-container)' : 'var(--color-outline-variant)', color: active ? 'var(--color-on-primary-container)' : 'var(--color-secondary)' }}>
                {b}
              </button>
            )
          })}
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          style={{ width: '100%', height: 56, background: 'var(--color-primary)', color: 'white', borderRadius: 9999, border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,109,55,0.3)', transition: 'transform 0.1s' }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          Submit Feedback & Done
        </button>
      </main>
    </div>
  )
}
