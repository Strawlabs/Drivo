import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

export default function ActiveRidePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const driver = location.state?.driver ?? { name: 'Ramesh K.', rating: 4.9, avatar: 'RK', type: 'EV Sedan', battery: 94 }
  const initialFare = location.state?.fare ?? 284

  const [fare, setFare] = useState(initialFare)
  const [eta, setEta] = useState(8)
  const [progress, setProgress] = useState(33)
  const [showSos, setShowSos] = useState(false)

  // Tick fare and ETA forward
  useEffect(() => {
    const interval = setInterval(() => {
      setFare(f => parseFloat((f + 0.5).toFixed(2)))
      setEta(e => Math.max(0, e - 1))
      setProgress(p => Math.min(100, p + 8))
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  // Auto-advance to completion when ETA hits 0
  useEffect(() => {
    if (eta === 0) {
      const t = setTimeout(() => navigate('/rider/ride-complete', { state: { driver, fare } }), 1500)
      return () => clearTimeout(t)
    }
  }, [eta])

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-background)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* SOS Modal */}
      {showSos && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(11,28,48,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ width: '100%', maxWidth: 380, background: 'white', borderRadius: 20, padding: 28, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ba1a1a" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: 8 }}>Emergency SOS</h3>
            <p style={{ fontSize: 14, color: 'var(--color-secondary)', marginBottom: 24 }}>This will alert Drivo Safety, share your live location, and contact your emergency numbers.</p>
            <button style={{ width: '100%', height: 50, background: '#ba1a1a', color: 'white', borderRadius: 12, border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}>
              Call Emergency (112)
            </button>
            <button onClick={() => setShowSos(false)} style={{ width: '100%', height: 44, background: 'none', border: 'none', color: 'var(--color-secondary)', fontSize: 14, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-5 py-3"
        style={{ background: 'var(--color-surface)', boxShadow: '0 1px 0 var(--color-surface-container-low)' }}>
        <div className="flex items-center gap-3">
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-on-surface)' }}>Active Ride</h1>
        </div>
        <div style={{ background: 'var(--color-primary-container)', color: 'var(--color-on-primary-container)', padding: '4px 12px', borderRadius: 9999, fontSize: 12, fontWeight: 700, letterSpacing: '0.04em' }}>
          EV Eco
        </div>
      </header>

      {/* Map */}
      <div style={{ position: 'relative', flex: '1 0 220px', background: 'linear-gradient(135deg, #0f1923 0%, #1a2b1a 50%, #0b1c30 100%)', overflow: 'hidden' }}>
        {[20, 40, 60, 80].map(p => (
          <div key={`h${p}`} style={{ position: 'absolute', top: `${p}%`, left: 0, right: 0, height: 1, background: 'rgba(46,204,113,0.12)' }} />
        ))}
        {[15, 30, 50, 65, 80].map(p => (
          <div key={`v${p}`} style={{ position: 'absolute', left: `${p}%`, top: 0, bottom: 0, width: 1, background: 'rgba(46,204,113,0.12)' }} />
        ))}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 390 280" preserveAspectRatio="none">
          <path d="M60 220 Q130 140 200 160 Q260 180 320 80 L360 50" stroke="#2ecc71" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.9" strokeDasharray="8 4"/>
          {/* Car position marker */}
          <circle cx="200" cy="160" r="14" fill="rgba(46,204,113,0.25)"/>
          <circle cx="200" cy="160" r="7" fill="#2ecc71"/>
          {/* Destination */}
          <circle cx="360" cy="50" r="7" fill="#4ae183"/>
          <circle cx="360" cy="50" r="14" fill="none" stroke="#4ae183" strokeWidth="1.5" opacity="0.5"/>
        </svg>
        {/* SOS button */}
        <button onClick={() => setShowSos(true)}
          style={{ position: 'absolute', top: 16, left: 16, background: '#ba1a1a', color: 'white', padding: '8px 16px', borderRadius: 9999, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 12px rgba(186,26,26,0.4)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
          SOS
        </button>
        {/* Destination label */}
        <div style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(248,249,255,0.9)', backdropFilter: 'blur(8px)', borderRadius: 8, padding: '6px 10px' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-on-surface)' }}>🏁 MG Road Metro</p>
        </div>
        {/* Map controls */}
        <div style={{ position: 'absolute', right: 16, bottom: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {['⊕', '⊖'].map((icon, i) => (
            <button key={i} style={{ width: 40, height: 40, background: 'rgba(248,249,255,0.92)', backdropFilter: 'blur(8px)', borderRadius: 10, border: 'none', fontSize: 18, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Sheet */}
      <div style={{ background: 'var(--color-surface)', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: '16px 20px 32px', boxShadow: '0px -10px 30px rgba(26,43,60,0.12)' }}>
        {/* Grabber */}
        <div style={{ width: 48, height: 4, background: 'var(--color-surface-container-highest)', borderRadius: 2, margin: '0 auto 16px' }} />

        {/* ETA + Fare */}
        <div className="flex items-end justify-between mb-4">
          <div>
            <p style={{ fontSize: 13, color: 'var(--color-secondary)', marginBottom: 2 }}>Arriving in</p>
            <p style={{ fontSize: 40, fontWeight: 700, color: 'var(--color-on-surface)', lineHeight: 1 }}>
              {eta} <span style={{ fontSize: 18, fontWeight: 400, color: 'var(--color-secondary)' }}>mins</span>
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 13, color: 'var(--color-secondary)', marginBottom: 2 }}>Estimated Fare</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-primary)' }}>₹{fare.toFixed(2)}</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ background: 'var(--color-surface-container)', height: 6, borderRadius: 9999, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'var(--color-primary)', borderRadius: 9999, transition: 'width 1s ease-in-out' }} />
        </div>
        <div className="flex justify-between mb-5" style={{ fontSize: 11, color: 'var(--color-secondary)' }}>
          <span>Pickup confirmed</span>
          <span>En route</span>
          <span>Arrived</span>
        </div>

        {/* Driver Info */}
        <div className="flex items-center gap-3 mb-5" style={{ background: 'var(--color-surface-container-low)', borderRadius: 14, padding: 14 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 18, border: '2px solid var(--color-primary-fixed)' }}>
              {driver.avatar}
            </div>
            <div style={{ position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--color-on-surface)' }}>{driver.name}</p>
            <p style={{ fontSize: 13, color: 'var(--color-secondary)', marginTop: 2 }}>{driver.rating} Rating · {driver.type}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-on-surface)', letterSpacing: '0.08em' }}>KA 05 EV 4821</p>
            <span style={{ background: 'var(--color-on-surface)', color: 'var(--color-surface)', borderRadius: 4, fontSize: 10, fontWeight: 700, padding: '1px 6px' }}>EV</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10 }}>
          <button style={{ height: 48, background: 'var(--color-on-surface)', color: 'var(--color-surface)', borderRadius: 12, border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            Contact
          </button>
          <button style={{ height: 48, background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)', borderRadius: 12, border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/></svg>
            Share Ride
          </button>
          <button
            onClick={() => navigate('/rider/ride-complete', { state: { driver, fare } })}
            style={{ width: 48, height: 48, background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)', borderRadius: 12, border: 'none', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ···
          </button>
        </div>
      </div>
    </div>
  )
}
