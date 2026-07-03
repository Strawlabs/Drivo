import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const VEHICLE_OPTIONS = [
  { id: 'luxe',  label: 'Drivo Luxe',  sub: 'EV Sedan · 4 min',  icon: '🚗', fare: 284 },
  { id: 'space', label: 'Drivo Space', sub: 'EV SUV · 7 min',    icon: '🚙', fare: 380 },
]

export default function BookRidePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const driver = location.state?.driver ?? {
    name: 'Ramesh K.', rating: 4.9, avatar: 'RK', type: 'EV Sedan', battery: 94, eta: '3 mins',
  }

  const [selected, setSelected] = useState('luxe')
  const fare = VEHICLE_OPTIONS.find(v => v.id === selected).fare

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-background)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center gap-3 px-5 py-3"
        style={{ background: 'var(--color-surface)', boxShadow: '0 1px 0 var(--color-surface-container-low)' }}>
        <button onClick={() => navigate(-1)}
          style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-surface-container-low)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-on-surface)' }}>Book Ride</h1>
      </header>

      {/* Map Placeholder */}
      <div style={{ position: 'relative', height: 220, background: 'linear-gradient(135deg, #0f1923 0%, #1a2b1a 50%, #0b1c30 100%)', overflow: 'hidden', flexShrink: 0 }}>
        {[20, 40, 60, 80].map(p => (
          <div key={`h${p}`} style={{ position: 'absolute', top: `${p}%`, left: 0, right: 0, height: 1, background: 'rgba(46,204,113,0.12)' }} />
        ))}
        {[15, 30, 50, 65, 80].map(p => (
          <div key={`v${p}`} style={{ position: 'absolute', left: `${p}%`, top: 0, bottom: 0, width: 1, background: 'rgba(46,204,113,0.12)' }} />
        ))}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 390 220" preserveAspectRatio="none">
          <path d="M60 180 Q120 100 180 120 Q240 140 300 60 L340 40" stroke="#2ecc71" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.9"/>
          <circle cx="60" cy="180" r="6" fill="#2ecc71"/>
          <circle cx="340" cy="40" r="6" fill="#4ae183"/>
          <circle cx="340" cy="40" r="12" fill="none" stroke="#4ae183" strokeWidth="1.5" opacity="0.5"/>
        </svg>
        {/* Pickup label */}
        <div style={{ position: 'absolute', bottom: 20, left: 20, background: 'rgba(248,249,255,0.92)', backdropFilter: 'blur(10px)', borderRadius: 8, padding: '6px 10px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-on-surface)', letterSpacing: '0.04em' }}>📍 Current Location</p>
        </div>
        {/* Destination label */}
        <div style={{ position: 'absolute', top: 16, right: 20, background: 'var(--color-primary)', borderRadius: 8, padding: '6px 10px' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'white', letterSpacing: '0.04em' }}>🏁 MG Road Metro</p>
        </div>
      </div>

      {/* Bottom Sheet */}
      <div style={{ flex: 1, background: 'var(--color-surface)', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: '20px 20px 32px', marginTop: -16, overflowY: 'auto' }}>

        {/* Grabber */}
        <div style={{ width: 32, height: 4, background: 'var(--color-outline-variant)', borderRadius: 2, margin: '0 auto 20px' }} />

        {/* Route Summary */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex flex-col items-center gap-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--color-primary)"><circle cx="12" cy="12" r="5"/></svg>
            <div style={{ width: 1, height: 24, background: 'var(--color-outline-variant)' }} />
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
          </div>
          <div className="flex flex-col gap-4 flex-1">
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', color: 'var(--color-secondary)', marginBottom: 2 }}>PICKUP</p>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-on-surface)' }}>Current Location</p>
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', color: 'var(--color-secondary)', marginBottom: 2 }}>DESTINATION</p>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-on-surface)' }}>MG Road Metro Station</p>
            </div>
          </div>
        </div>

        {/* Vehicle Selection */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          {VEHICLE_OPTIONS.map(v => {
            const isSelected = selected === v.id
            return (
              <button key={v.id} onClick={() => setSelected(v.id)}
                style={{
                  position: 'relative', padding: 14, borderRadius: 14, textAlign: 'center', cursor: 'pointer',
                  background: isSelected ? 'white' : 'var(--color-surface-container-low)',
                  border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-outline-variant)',
                  boxShadow: isSelected ? '0 2px 12px rgba(0,109,55,0.15)' : 'none',
                  transition: 'all 0.15s ease', opacity: isSelected ? 1 : 0.7,
                }}>
                {isSelected && (
                  <div style={{ position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                )}
                <div style={{ fontSize: 32, marginBottom: 6 }}>{v.icon}</div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: 2 }}>{v.label}</p>
                <p style={{ fontSize: 11, color: 'var(--color-secondary)' }}>{v.sub}</p>
              </button>
            )
          })}
        </div>

        {/* Driver + Fare Card */}
        <div className="flex items-center justify-between mb-5"
          style={{ background: 'white', border: '1px solid var(--color-outline-variant)', borderRadius: 14, padding: 14, boxShadow: '0 1px 4px rgba(26,43,60,0.06)' }}>
          <div className="flex items-center gap-3">
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
              {driver.avatar}
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-on-surface)' }}>{driver.name}</p>
              <div className="flex items-center gap-1" style={{ marginTop: 2 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#F59E0B"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>{driver.rating} · EV Certified</span>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-primary)', lineHeight: 1 }}>₹{fare}</p>
            <p style={{ fontSize: 11, color: 'var(--color-secondary)', marginTop: 2 }}>Est. Fare</p>
          </div>
        </div>

        {/* Payment Method */}
        <div className="flex items-center justify-between mb-5 px-1">
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-on-surface)' }}>UPI / Saved Card</span>
          </div>
          <button style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>Change</button>
        </div>

        {/* Confirm Button */}
        <button
          onClick={() => navigate('/rider/active-ride', { state: { driver, fare } })}
          style={{ width: '100%', height: 56, background: 'var(--color-primary-container)', color: 'var(--color-on-primary-container)', borderRadius: 14, border: 'none', fontSize: 17, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 16px rgba(0,109,55,0.2)', transition: 'transform 0.1s' }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          Confirm Ride
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
    </div>
  )
}
