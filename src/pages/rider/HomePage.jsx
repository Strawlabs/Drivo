import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth.jsx'

// ── Mock data ──────────────────────────────────────────────────
const NEARBY_DRIVERS = [
  { id: 1, name: 'Ramesh K.',   rating: 4.9, eta: '3 mins', type: 'EV Sedan',     battery: 94, avatar: 'RK', trips: 1240, safety: 4.9, languages: ['Hindi', 'English'], tags: ['EV Certified', 'Background Checked'] },
  { id: 2, name: 'Priya S.',    rating: 4.8, eta: '5 mins', type: 'EV Hatchback', battery: 82, avatar: 'PS', trips: 870,  safety: 4.8, languages: ['Tamil', 'English'],  tags: ['EV Certified', 'Background Checked'] },
  { id: 3, name: 'Anita M.',    rating: 5.0, eta: '7 mins', type: 'EV Auto',      battery: 76, avatar: 'AM', trips: 2100, safety: 5.0, languages: ['Kannada', 'English'], tags: ['EV Certified', 'Background Checked', 'Premium Tier'] },
  { id: 4, name: 'Venkatesh R.', rating: 4.7, eta: '9 mins', type: 'EV Sedan',   battery: 88, avatar: 'VR', trips: 560,  safety: 4.7, languages: ['Telugu', 'English'],  tags: ['EV Certified'] },
]

const PAST_TRIPS = [
  { id: 1, from: 'Koramangala 5th Block', to: 'MG Road Metro Station', date: 'Today, 9:14 AM',      fare: '₹184', distance: '6.2 km', duration: '18 mins', driver: 'Ramesh K.', rating: 5, status: 'completed' },
  { id: 2, from: 'HSR Layout Sector 2',  to: 'Indiranagar 100 Ft Rd',  date: 'Yesterday, 7:42 PM',  fare: '₹312', distance: '9.8 km', duration: '27 mins', driver: 'Priya S.',  rating: 4, status: 'completed' },
  { id: 3, from: 'Whitefield ITPL Gate', to: 'Bellandur Lake Road',     date: 'Jun 20, 2:30 PM',    fare: '₹520', distance: '14.1 km', duration: '38 mins', driver: 'Anita M.',  rating: 5, status: 'completed' },
  { id: 4, from: 'Electronic City Ph 1', to: 'Silk Board Junction',     date: 'Jun 19, 8:05 AM',    fare: '₹248', distance: '7.6 km', duration: '22 mins', driver: 'Venkatesh R.', rating: 4, status: 'completed' },
]

// ── Small shared components ─────────────────────────────────────
function StarIcon({ filled = true, size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? '#F59E0B' : 'none'} stroke={filled ? 'none' : '#D1D5DB'} strokeWidth="1.5">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  )
}

function Stars({ rating, max = 5 }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => <StarIcon key={i} filled={i < rating} />)}
    </div>
  )
}

function Avatar({ initials, size = 48, bg = 'var(--color-primary)' }) {
  return (
    <div
      className="flex items-center justify-center text-white font-semibold flex-shrink-0"
      style={{ width: size, height: size, borderRadius: '50%', background: bg, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  )
}

// ── TAB: Home ───────────────────────────────────────────────────
function HomeTab({ firstName, greeting, onBookDriver, onSchedule }) {
  const [search, setSearch] = useState('')

  return (
    <>
      {/* Greeting */}
      <section className="px-5 mt-6 mb-6">
        <h2 style={{ fontSize: 24, fontWeight: 600, lineHeight: '32px', color: 'var(--color-on-surface)' }}>
          {greeting}, {firstName}
        </h2>
        <p style={{ fontSize: 16, color: 'var(--color-secondary)', opacity: 0.85, marginTop: 2 }}>
          Ready for a sustainable ride today?
        </p>
      </section>

      {/* Search Bar */}
      <section className="px-5 mb-8">
        <div className="relative flex items-center">
          <span className="absolute pointer-events-none" style={{ left: 16 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="var(--color-primary)" strokeWidth="1.5"/>
              <path d="M16.5 16.5L21 21" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </span>
          <input
            type="text"
            placeholder="Where would you like to go?"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full"
            style={{
              height: 56, paddingLeft: 48, paddingRight: 48,
              background: 'var(--color-surface-container-low)',
              border: 'none', borderRadius: 12, fontSize: 16,
              color: 'var(--color-on-surface)', outline: 'none',
              boxShadow: '0 1px 4px rgba(26,43,60,0.06)',
            }}
            onFocus={e => e.target.style.boxShadow = '0 0 0 2px rgba(0,109,55,0.2)'}
            onBlur={e => e.target.style.boxShadow = '0 1px 4px rgba(26,43,60,0.06)'}
          />
          <span className="absolute" style={{ right: 16 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="9" y="2" width="6" height="11" rx="3" stroke="var(--color-secondary)" strokeWidth="1.5"/>
              <path d="M5 10a7 7 0 0014 0" stroke="var(--color-secondary)" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M12 17v4M9 21h6" stroke="var(--color-secondary)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </span>
        </div>
      </section>

      {/* Map Snippet */}
      <section className="px-5 mb-8">
        <div className="relative overflow-hidden" style={{ height: 192, borderRadius: 16, boxShadow: '0 4px 16px rgba(26,43,60,0.12)' }}>
          <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, #0f1923 0%, #1a2b1a 50%, #0b1c30 100%)', position: 'relative', overflow: 'hidden' }}>
            {[20, 40, 60, 80].map(p => <div key={`h${p}`} style={{ position: 'absolute', top: `${p}%`, left: 0, right: 0, height: 1, background: 'rgba(46,204,113,0.12)' }} />)}
            {[15, 30, 50, 65, 80].map(p => <div key={`v${p}`} style={{ position: 'absolute', left: `${p}%`, top: 0, bottom: 0, width: 1, background: 'rgba(46,204,113,0.12)' }} />)}
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 360 192" preserveAspectRatio="none">
              <path d="M40 160 Q90 80 150 100 Q200 120 260 60 L300 40" stroke="#2ecc71" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.8"/>
              <circle cx="40" cy="160" r="5" fill="#2ecc71" opacity="0.9"/>
              <circle cx="300" cy="40" r="5" fill="#4ae183"/>
              <circle cx="300" cy="40" r="10" fill="none" stroke="#4ae183" strokeWidth="1.5" opacity="0.4"/>
            </svg>
          </div>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.18), transparent)', pointerEvents: 'none' }} />
          <div className="absolute flex items-center gap-1.5" style={{ bottom: 12, left: 12, background: 'rgba(248,249,255,0.92)', backdropFilter: 'blur(12px)', borderRadius: 9999, padding: '4px 10px', boxShadow: '0 2px 8px rgba(26,43,60,0.12)', border: '1px solid var(--color-outline-variant)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', display: 'inline-block', animation: 'livePulse 2s infinite' }} />
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', color: 'var(--color-on-surface)' }}>Live EV availability</span>
          </div>
        </div>
      </section>

      {/* Quick Categories */}
      <section className="px-5 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-on-surface)' }}>Quick Categories</h3>
          <button style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>View All</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[{ label: 'EV Auto', icon: '🛺' }, { label: 'EV Car', icon: '🚗' }].map(({ label, icon }) => (
            <button
              key={label}
              className="flex flex-col items-center justify-center"
              style={{ padding: 20, background: 'var(--color-surface)', border: '1px solid rgba(187,203,187,0.3)', borderRadius: 16, boxShadow: '0 1px 4px rgba(26,43,60,0.05)', cursor: 'pointer', transition: 'all 0.15s ease' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.background = 'rgba(46,204,113,0.05)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(187,203,187,0.3)'; e.currentTarget.style.background = 'var(--color-surface)' }}
            >
              <div style={{ width: 64, height: 64, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-surface-container-highest)', borderRadius: '50%', fontSize: 28 }}>
                {icon}
              </div>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-on-surface)' }}>{label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Nearby Drivers */}
      <section className="mb-8">
        <div className="flex justify-between items-center mb-4 px-5">
          <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-on-surface)' }}>Nearby Drivers</h3>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', color: 'var(--color-secondary)', background: 'var(--color-surface-container)', padding: '2px 10px', borderRadius: 9999 }}>
            8 active now
          </span>
        </div>
        <div className="flex overflow-x-auto gap-3 px-5 pb-1" style={{ scrollbarWidth: 'none' }}>
          {NEARBY_DRIVERS.map(driver => (
            <div key={driver.id} className="flex flex-col gap-3" style={{ minWidth: 280, background: 'var(--color-surface)', border: '1px solid rgba(187,203,187,0.4)', borderRadius: 16, boxShadow: '0 1px 4px rgba(26,43,60,0.06)', padding: 16, flexShrink: 0 }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar initials={driver.avatar} />
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-on-surface)' }}>{driver.name}</p>
                    <div className="flex items-center gap-1" style={{ marginTop: 2 }}>
                      <StarIcon />
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-on-surface)' }}>{driver.rating}</span>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', letterSpacing: '0.05em' }}>{driver.eta} away</p>
                  <p style={{ fontSize: 10, color: 'var(--color-secondary)', marginTop: 2 }}>{driver.type}</p>
                </div>
              </div>
              <div className="flex justify-between items-center" style={{ background: 'var(--color-surface-container-low)', padding: '8px 12px', borderRadius: 12 }}>
                <div className="flex items-center gap-1.5">
                  <span style={{ fontSize: 13 }}>🔋</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-on-surface)' }}>{driver.battery}%</span>
                </div>
                <button
                  onClick={() => onBookDriver(driver)}
                  style={{ background: 'var(--color-primary)', color: 'white', padding: '5px 16px', borderRadius: 9999, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  Book
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Schedule a Ride */}
      <section className="px-5 mb-8">
        <button
          onClick={onSchedule}
          className="w-full flex items-center justify-between"
          style={{ background: 'var(--color-surface)', border: '1px solid rgba(187,203,187,0.4)', borderRadius: 16, padding: '16px 18px', cursor: 'pointer', boxShadow: '0 1px 4px rgba(26,43,60,0.06)', textAlign: 'left' }}
        >
          <div className="flex items-center gap-3">
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(46,204,113,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/></svg>
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-on-surface)' }}>Schedule a Ride</p>
              <p style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 2 }}>Book ahead — pick a date & time</p>
            </div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-secondary)" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </section>

      {/* Eco-Warrior Card */}
      <section className="px-5 mb-8">
        <div className="flex items-center justify-between" style={{ background: 'rgba(46,204,113,0.08)', border: '2px dashed var(--color-primary-container)', borderRadius: 16, padding: 20 }}>
          <div style={{ maxWidth: '60%' }}>
            <h4 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-on-primary-container)', marginBottom: 4 }}>Eco-Warrior Status</h4>
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', color: 'var(--color-on-secondary-container)' }}>
              You saved 12kg of CO₂ this week! Keep it up for premium rewards.
            </p>
          </div>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-primary-container)', fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            🌿
          </div>
        </div>
      </section>
    </>
  )
}

// ── TAB: Trips ──────────────────────────────────────────────────
function TripsTab() {
  const [selected, setSelected] = useState(null)

  if (selected) {
    const t = selected
    return (
      <div className="px-5 pt-6 pb-8">
        <button onClick={() => setSelected(null)} style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
          ← Back to Trips
        </button>

        {/* Arrived banner */}
        <div className="flex items-center gap-3 mb-6" style={{ background: 'rgba(46,204,113,0.1)', borderRadius: 16, padding: '14px 18px', border: '1px solid rgba(46,204,113,0.25)' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-on-surface)' }}>Arrived</span>
        </div>

        {/* Fare card */}
        <div style={{ background: 'white', borderRadius: 20, padding: 24, boxShadow: '0 2px 12px rgba(26,43,60,0.08)', marginBottom: 16, textAlign: 'center' }}>
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--color-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>Total Fare</p>
          <h2 style={{ fontSize: 44, fontWeight: 700, color: 'var(--color-on-surface)', letterSpacing: '-0.02em' }}>{t.fare}</h2>
          <div className="flex justify-around mt-5">
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-primary)' }}>{t.distance}</p>
              <p style={{ fontSize: 12, color: 'var(--color-secondary)' }}>Distance</p>
            </div>
            <div style={{ width: 1, background: 'var(--color-outline-variant)' }} />
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-primary)' }}>{t.duration}</p>
              <p style={{ fontSize: 12, color: 'var(--color-secondary)' }}>Duration</p>
            </div>
          </div>
        </div>

        {/* Route */}
        <div style={{ background: 'white', borderRadius: 16, padding: 16, boxShadow: '0 1px 6px rgba(26,43,60,0.06)', marginBottom: 16 }}>
          <div className="flex items-center gap-3 mb-3">
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 }} />
            <span style={{ fontSize: 14, color: 'var(--color-on-surface)' }}>{t.from}</span>
          </div>
          <div style={{ marginLeft: 4, width: 2, height: 16, background: 'var(--color-outline-variant)', marginBottom: 8 }} />
          <div className="flex items-center gap-3">
            <div style={{ width: 10, height: 10, borderRadius: 2, background: '#EF4444', flexShrink: 0 }} />
            <span style={{ fontSize: 14, color: 'var(--color-on-surface)' }}>{t.to}</span>
          </div>
        </div>

        {/* Payment */}
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-on-surface)', marginBottom: 10 }}>Payment Method</p>
        {[{ label: 'Pay via UPI', icon: '📱' }, { label: 'Pay Cash', icon: '💵' }].map(({ label, icon }) => (
          <div key={label} className="flex items-center justify-between" style={{ background: 'var(--color-on-surface)', borderRadius: 14, padding: '14px 18px', marginBottom: 10, cursor: 'pointer' }}>
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 18 }}>{icon}</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>{label}</span>
            </div>
            <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>›</span>
          </div>
        ))}

        {/* Rating */}
        <div style={{ background: 'white', borderRadius: 16, padding: 20, boxShadow: '0 1px 6px rgba(26,43,60,0.06)', marginTop: 16 }}>
          <div className="flex items-center gap-3 mb-4">
            <Avatar initials={t.driver.split(' ').map(w => w[0]).join('')} size={44} />
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-on-surface)' }}>Rate your Driver</p>
              <p style={{ fontSize: 12, color: 'var(--color-secondary)' }}>{t.driver} · EV Specialist</p>
            </div>
          </div>
          <Stars rating={t.rating} size={20} />
          <div style={{ background: 'var(--color-surface-container-low)', borderRadius: 10, padding: '10px 14px', marginTop: 12, fontSize: 14, color: 'var(--color-on-surface-variant)' }}>
            Add a comment (optional)…
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            {['Clean Car', 'Expert Driving', 'Great Chat'].map(tag => (
              <span key={tag} style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 9999, border: '1px solid var(--color-primary)', color: 'var(--color-primary)', background: 'rgba(0,109,55,0.05)' }}>{tag}</span>
            ))}
          </div>
        </div>

        <button style={{ width: '100%', height: 52, background: 'var(--color-primary)', color: 'white', borderRadius: 9999, border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 20 }}>
          Submit Feedback & Done
        </button>
      </div>
    )
  }

  return (
    <div className="px-5 pt-6 pb-8">
      <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: 4 }}>Your Trips</h2>
      <p style={{ fontSize: 14, color: 'var(--color-secondary)', marginBottom: 24 }}>Tap a trip to view details</p>

      <div className="flex flex-col gap-3">
        {PAST_TRIPS.map(trip => (
          <button
            key={trip.id}
            onClick={() => setSelected(trip)}
            className="text-left"
            style={{ background: 'white', borderRadius: 16, padding: 16, boxShadow: '0 1px 6px rgba(26,43,60,0.07)', border: '1px solid rgba(187,203,187,0.3)', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(26,43,60,0.12)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 6px rgba(26,43,60,0.07)'}
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <p style={{ fontSize: 13, color: 'var(--color-secondary)', marginBottom: 2 }}>{trip.date}</p>
                <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-on-surface)' }}>{trip.to}</p>
                <p style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 1 }}>from {trip.from}</p>
              </div>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-primary)' }}>{trip.fare}</span>
            </div>
            <div className="flex items-center justify-between" style={{ borderTop: '1px solid var(--color-outline-variant)', paddingTop: 10 }}>
              <div className="flex items-center gap-3">
                <Avatar initials={trip.driver.split(' ').map(w => w[0]).join('')} size={28} />
                <span style={{ fontSize: 13, color: 'var(--color-on-surface-variant)' }}>{trip.driver}</span>
              </div>
              <div className="flex items-center gap-1">
                <Stars rating={trip.rating} />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── TAB: Drivers ────────────────────────────────────────────────
function DriversTab() {
  const [selected, setSelected] = useState(null)

  if (selected) {
    const d = selected
    return (
      <div className="pb-8">
        {/* Hero */}
        <div style={{ position: 'relative', height: 200, background: 'linear-gradient(135deg, #0f2017, #1a3a1a)', display: 'flex', alignItems: 'flex-end', padding: 20 }}>
          <button onClick={() => setSelected(null)} style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', color: 'white', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ←
          </button>
          <div className="flex items-end gap-4">
            <Avatar initials={d.avatar} size={72} />
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: 'white' }}>{d.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <StarIcon />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#F59E0B' }}>{d.rating}</span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>· {d.trips.toLocaleString()} Trips</span>
              </div>
            </div>
          </div>
          {d.tags.includes('Premium Tier') && (
            <span style={{ position: 'absolute', top: 16, right: 16, background: 'var(--color-primary)', color: 'white', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', padding: '3px 10px', borderRadius: 9999 }}>PREMIUM TIER</span>
          )}
        </div>

        <div className="px-5 pt-5">
          {/* Vehicle */}
          <div style={{ background: 'white', borderRadius: 16, padding: 16, boxShadow: '0 1px 6px rgba(26,43,60,0.06)', marginBottom: 16 }}>
            <div className="flex justify-between items-center mb-2">
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Current Vehicle</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>🔋 {d.battery}% Charged</span>
            </div>
            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-on-surface)' }}>{d.type}</p>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {[{ label: 'Safety Rating', value: d.safety }, { label: 'Exp. Partner', value: '2y' }].map(({ label, value }) => (
              <div key={label} style={{ background: 'white', borderRadius: 16, padding: 16, textAlign: 'center', boxShadow: '0 1px 6px rgba(26,43,60,0.06)' }}>
                <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-on-surface)' }}>{value}</p>
                <p style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 4 }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Languages */}
          <div style={{ background: 'white', borderRadius: 16, padding: 16, boxShadow: '0 1px 6px rgba(26,43,60,0.06)', marginBottom: 16 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: 10 }}>🌐 Languages</p>
            <div className="flex gap-2 flex-wrap">
              {d.languages.map(lang => (
                <span key={lang} style={{ fontSize: 13, padding: '4px 12px', borderRadius: 9999, background: 'var(--color-surface-container-low)', color: 'var(--color-on-surface)' }}>{lang}</span>
              ))}
            </div>
          </div>

          {/* Trust */}
          <div style={{ background: 'white', borderRadius: 16, padding: 16, boxShadow: '0 1px 6px rgba(26,43,60,0.06)', marginBottom: 24 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: 10 }}>🛡️ Trust & Safety</p>
            {d.tags.map(tag => (
              <div key={tag} className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <span style={{ fontSize: 13, color: 'var(--color-on-surface)' }}>{tag}</span>
              </div>
            ))}
          </div>

          <button style={{ width: '100%', height: 52, background: 'var(--color-primary)', color: 'white', borderRadius: 9999, border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            ⚡ Request Ride Now
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-5 pt-6 pb-8">
      <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: 4 }}>Nearby Drivers</h2>
      <p style={{ fontSize: 14, color: 'var(--color-secondary)', marginBottom: 24 }}>Tap a driver to view their profile</p>

      <div className="flex flex-col gap-3">
        {NEARBY_DRIVERS.map(driver => (
          <button
            key={driver.id}
            onClick={() => setSelected(driver)}
            className="text-left"
            style={{ background: 'white', borderRadius: 16, padding: 16, boxShadow: '0 1px 6px rgba(26,43,60,0.07)', border: '1px solid rgba(187,203,187,0.3)', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(26,43,60,0.12)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 6px rgba(26,43,60,0.07)'}
          >
            <div className="flex items-center gap-4">
              <Avatar initials={driver.avatar} size={52} />
              <div style={{ flex: 1 }}>
                <div className="flex justify-between items-start">
                  <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-on-surface)' }}>{driver.name}</p>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>{driver.eta} away</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <StarIcon />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-on-surface)' }}>{driver.rating}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-secondary)' }}>· {driver.type}</span>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span style={{ fontSize: 12, color: 'var(--color-secondary)' }}>🔋 {driver.battery}%</span>
                  <span style={{ fontSize: 12, color: 'var(--color-secondary)' }}>· {driver.trips.toLocaleString()} trips</span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── TAB: Profile ────────────────────────────────────────────────
function ProfileTab({ firstName, email, onSignOut }) {
  return (
    <div className="px-5 pt-6 pb-8">
      {/* Profile hero */}
      <div className="flex items-center gap-4 mb-8">
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: 'white', flexShrink: 0 }}>
          {firstName[0].toUpperCase()}
        </div>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-on-surface)' }}>{firstName.charAt(0).toUpperCase() + firstName.slice(1)}</h2>
          <p style={{ fontSize: 14, color: 'var(--color-secondary)', marginTop: 2 }}>{email}</p>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--color-primary)', background: 'rgba(0,109,55,0.1)', padding: '2px 8px', borderRadius: 9999, display: 'inline-block', marginTop: 4 }}>ECO RIDER</span>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
        {[{ label: 'Trips', value: '24' }, { label: 'CO₂ Saved', value: '38kg' }, { label: 'Rating', value: '4.9' }].map(({ label, value }) => (
          <div key={label} style={{ background: 'white', borderRadius: 14, padding: '14px 8px', textAlign: 'center', boxShadow: '0 1px 4px rgba(26,43,60,0.06)' }}>
            <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-primary)' }}>{value}</p>
            <p style={{ fontSize: 11, color: 'var(--color-secondary)', marginTop: 2 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Menu sections */}
      {[
        {
          title: 'Account',
          items: [
            { icon: '👤', label: 'Personal Information' },
            { icon: '📱', label: 'Mobile Number' },
            { icon: '💳', label: 'Payment Methods' },
          ]
        },
        {
          title: 'Preferences',
          items: [
            { icon: '🚗', label: 'Preferred Drivers' },
            { icon: '🌿', label: 'Eco Impact Report' },
            { icon: '🔔', label: 'Notifications' },
          ]
        },
        {
          title: 'Support',
          items: [
            { icon: '🛡️', label: 'Safety Center' },
            { icon: '❓', label: 'Help & Support' },
            { icon: '📄', label: 'Terms & Privacy' },
          ]
        },
      ].map(({ title, items }) => (
        <div key={title} style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--color-secondary)', textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>{title}</p>
          <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(26,43,60,0.06)' }}>
            {items.map(({ icon, label }, i) => (
              <button
                key={label}
                className="flex items-center justify-between w-full text-left"
                style={{ padding: '14px 16px', background: 'none', border: 'none', borderTop: i > 0 ? '1px solid var(--color-outline-variant)' : 'none', cursor: 'pointer' }}
              >
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 18 }}>{icon}</span>
                  <span style={{ fontSize: 15, color: 'var(--color-on-surface)' }}>{label}</span>
                </div>
                <span style={{ color: 'var(--color-secondary)', fontSize: 18 }}>›</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={onSignOut}
        style={{ width: '100%', height: 48, background: 'none', border: '1px solid var(--color-error)', color: 'var(--color-error)', borderRadius: 9999, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 8, transition: 'all 0.15s ease' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-error)'; e.currentTarget.style.color = 'white' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--color-error)' }}
      >
        Sign Out
      </button>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────
export default function RiderHomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeNav, setActiveNav] = useState('home')
  const [firstName, setFirstName] = useState('Rider')

  useEffect(() => {
    if (!user) return
    supabase.from('users').select('name').eq('id', user.id).single()
      .then(({ data }) => {
        if (data?.name) setFirstName(data.name.split(' ')[0])
      })
  }, [user])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="relative flex flex-col" style={{ minHeight: '100dvh', background: 'var(--color-background)', fontFamily: 'var(--font-sans)' }}>

      {/* Top App Bar */}
      <header className="sticky top-0 z-40 flex justify-between items-center w-full px-5 py-2" style={{ background: 'var(--color-surface)', boxShadow: '0 1px 0 var(--color-surface-container-low)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-white font-semibold text-sm flex-shrink-0" style={{ background: 'var(--color-primary)', border: '2px solid var(--color-primary-container)' }}>
            {firstName[0].toUpperCase()}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-on-surface)', letterSpacing: '-0.01em' }}>Drivo</h1>
        </div>
        <button className="flex items-center justify-center rounded-full" style={{ width: 48, height: 48 }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M6 10a6 6 0 0112 0v4l2 2H4l2-2v-4z" stroke="var(--color-secondary)" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M10 18a2 2 0 004 0" stroke="var(--color-secondary)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-28">
        {activeNav === 'home'    && <HomeTab firstName={firstName.charAt(0).toUpperCase() + firstName.slice(1)} greeting={greeting} onBookDriver={driver => navigate('/rider/book-ride', { state: { driver } })} onSchedule={() => navigate('/rider/schedule')} />}
        {activeNav === 'trips'   && <TripsTab />}
        {activeNav === 'drivers' && <DriversTab />}
        {activeNav === 'profile' && <ProfileTab firstName={firstName} email={user?.email ?? ''} onSignOut={handleSignOut} />}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-4 pt-2" style={{ background: 'var(--color-surface)', boxShadow: '0px -4px 20px rgba(26,43,60,0.05)', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
        {[
          { key: 'home',    label: 'Home',    icon: '🏠' },
          { key: 'trips',   label: 'Trips',   icon: '🧾' },
          { key: 'drivers', label: 'Drivers', icon: '🚕' },
          { key: 'profile', label: 'Profile', icon: '👤' },
        ].map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveNav(key)}
            className="flex flex-col items-center justify-center"
            style={{ background: activeNav === key ? 'var(--color-primary-container)' : 'transparent', color: activeNav === key ? 'var(--color-on-primary-container)' : 'var(--color-on-secondary-container)', borderRadius: 9999, padding: activeNav === key ? '4px 16px' : '4px 8px', border: 'none', cursor: 'pointer', transition: 'all 0.2s ease', minWidth: 48 }}
          >
            <span style={{ fontSize: 20 }}>{icon}</span>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', marginTop: 2 }}>{label}</span>
          </button>
        ))}
      </nav>

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  )
}
