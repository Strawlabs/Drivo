import { Link, useNavigate } from 'react-router-dom'

/*
  Public marketing page (Stitch: drivo_web_landing_page). Shown at "/" to
  logged-out visitors; logged-in users are redirected past it by
  SmartRedirect. The Stitch frame includes named customer testimonials and
  a live "2,481 active drivers" counter — both are invented social proof,
  so they're replaced here with a factual "how the money moves" section.
*/

function FeatureCard({ title, body, points, icon }) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-outline-variant)',
        borderRadius: 20,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: 'var(--color-primary-container)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </div>
      <h3 style={{ fontSize: 19, fontWeight: 700, color: 'var(--color-on-surface)' }}>{title}</h3>
      <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--color-secondary)' }}>{body}</p>
      <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
        {points.map(p => (
          <li key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-on-surface)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" fill="rgba(0,109,55,0.14)" />
              <path d="M8 12.5l2.5 2.5L16 9" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {p}
          </li>
        ))}
      </ul>
    </div>
  )
}

function MoneyStep({ n, label, sub }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'var(--color-primary)',
          color: 'white',
          fontWeight: 700,
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {n}
      </div>
      <div>
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-on-surface)' }}>{label}</p>
        <p style={{ fontSize: 13, color: 'var(--color-secondary)', marginTop: 2 }}>{sub}</p>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-background)', fontFamily: 'var(--font-sans)' }}>
      {/* Nav */}
      <header
        className="sticky top-0 z-40"
        style={{
          background: 'rgba(248,249,255,0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--color-outline-variant)',
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            padding: '14px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--color-on-surface)' }}>Drivo</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link
              to="/login"
              style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-on-surface)', textDecoration: 'none', padding: '8px 14px' }}
            >
              Log in
            </Link>
            <button
              onClick={() => navigate('/welcome')}
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'white',
                background: 'var(--color-primary)',
                border: 'none',
                borderRadius: 9999,
                padding: '9px 18px',
                cursor: 'pointer',
              }}
            >
              Get started
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>
        {/* Hero */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: 32,
            padding: '56px 0',
            alignItems: 'center',
          }}
          className="lg:grid-cols-2"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <span
              style={{
                alignSelf: 'flex-start',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--color-on-primary-container)',
                background: 'var(--color-primary-container)',
                padding: '5px 12px',
                borderRadius: 9999,
              }}
            >
              Premium EV Mobility
            </span>
            <h1 style={{ fontSize: 44, lineHeight: 1.08, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--color-on-surface)' }}>
              The future of mobility is <span style={{ color: 'var(--color-primary)' }}>driver-first</span>.
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.55, color: 'var(--color-secondary)', maxWidth: 460 }}>
              Electric rides with no commission on the driver and no surge on the rider. Drivers pay a flat
              subscription and keep 100% of every fare — riders pay them directly over UPI.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('/welcome')}
                style={{
                  height: 48,
                  padding: '0 24px',
                  borderRadius: 9999,
                  border: 'none',
                  background: 'var(--color-primary)',
                  color: 'white',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(0,109,55,0.22)',
                }}
              >
                Book a ride
              </button>
              <button
                onClick={() => navigate('/welcome')}
                style={{
                  height: 48,
                  padding: '0 24px',
                  borderRadius: 9999,
                  border: '1px solid var(--color-outline)',
                  background: 'none',
                  color: 'var(--color-on-surface)',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Become a driver
              </button>
            </div>
          </div>

          {/* Hero visual */}
          <div
            style={{
              aspectRatio: '4 / 3',
              borderRadius: 28,
              background: 'linear-gradient(135deg, #0f1923 0%, #123024 55%, #0b1c30 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'radial-gradient(circle at 50% 120%, rgba(74,225,131,0.30), transparent 60%)',
              }}
            />
            <svg width="74%" viewBox="0 0 240 110" fill="none" style={{ position: 'relative' }}>
              <path
                d="M12 78 L38 54 C48 46 62 42 78 42 L156 42 C174 42 190 48 202 62 L222 68 C232 70 238 76 238 84 L238 88 L12 88 Z"
                fill="rgba(255,255,255,0.06)"
                stroke="#4ae183"
                strokeWidth="2"
              />
              <circle cx="74" cy="88" r="14" fill="#0f1923" stroke="#4ae183" strokeWidth="3" />
              <circle cx="190" cy="88" r="14" fill="#0f1923" stroke="#4ae183" strokeWidth="3" />
            </svg>
          </div>
        </section>

        {/* Feature trio */}
        <section style={{ padding: '24px 0 8px', textAlign: 'center' }}>
          <h2 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-on-surface)' }}>
            Redefining the standard
          </h2>
          <p style={{ fontSize: 15, color: 'var(--color-secondary)', marginTop: 8, maxWidth: 520, margin: '8px auto 0' }}>
            Built for the people behind the wheel and the people in the seat.
          </p>
        </section>
        <section
          style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16, padding: '32px 0' }}
          className="md:grid-cols-3"
        >
          <FeatureCard
            title="Fair for drivers"
            body="A flat subscription replaces the commission. Earnings scale with the work, not with a cut."
            points={['No per-ride commission', 'Instant UPI payouts', 'Go Home Mode for the return trip']}
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-primary-container)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 13l1.5-4.5A2 2 0 0 1 6.4 7h11.2a2 2 0 0 1 1.9 1.5L21 13" />
                <rect x="2" y="13" width="20" height="5" rx="2" />
                <circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" />
              </svg>
            }
          />
          <FeatureCard
            title="Trusted for riders"
            body="Save the drivers you like and rebook them by name — familiarity built into every trip."
            points={['Preferred Drivers', 'No surge pricing', 'Live trip sharing & SOS']}
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-primary-container)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" />
              </svg>
            }
          />
          <FeatureCard
            title="Good for the planet"
            body="Only electric autos and cars are onboarded — every ride is a zero-tailpipe ride."
            points={['100% EV fleet', 'EV-certified vehicles only', 'Part of India’s EV transition']}
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-primary-container)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 21c8 0 14-6 14-14V5h-2C9 5 5 11 5 19v2z" />
                <path d="M5 21c3-6 6-9 12-12" />
              </svg>
            }
          />
        </section>

        {/* Money-flow band */}
        <section
          style={{
            background: 'linear-gradient(135deg, #0f1923 0%, #123024 60%, #0b1c30 100%)',
            borderRadius: 28,
            padding: 32,
            margin: '24px 0',
            color: 'white',
          }}
        >
          <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 6 }}>
            Keep 100% of your earnings.
          </h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 24, maxWidth: 520 }}>
            Drivo changes how money moves between rider, driver, and platform — the platform’s account is never
            in the transaction.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 16 }} className="sm:grid-cols-3">
            <MoneyStep n="1" label="Driver subscribes" sub="A flat monthly fee — Basic, Pro, or Elite." />
            <MoneyStep n="2" label="Rider pays the driver" sub="A UPI deep link opens the rider’s payment app, pre-filled." />
            <MoneyStep n="3" label="Money lands instantly" sub="Straight to the driver. No settlement delay, no float." />
          </div>
          <button
            onClick={() => navigate('/welcome')}
            style={{
              marginTop: 26,
              height: 46,
              padding: '0 22px',
              borderRadius: 9999,
              border: 'none',
              background: '#4ae183',
              color: '#00210c',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Sign up to drive
          </button>
        </section>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--color-outline-variant)', background: 'var(--color-surface-container-low)' }}>
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            padding: '32px 24px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 24,
            justifyContent: 'space-between',
          }}
        >
          <div style={{ maxWidth: 240 }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-on-surface)' }}>Drivo</p>
            <p style={{ fontSize: 13, color: 'var(--color-secondary)', marginTop: 6 }}>
              Driver-first EV ride-hailing for Indian cities.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
            {[
              { h: 'Product', items: ['Book a ride', 'Become a driver', 'Subscriptions'] },
              { h: 'Company', items: ['About', 'Careers', 'Sustainability'] },
              { h: 'Legal', items: ['Privacy Policy', 'Terms of Service'] },
            ].map(col => (
              <div key={col.h}>
                <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-secondary)', marginBottom: 10 }}>
                  {col.h}
                </p>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {col.items.map(i => (
                    <li key={i} style={{ fontSize: 13, color: 'var(--color-on-surface-variant)' }}>{i}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--color-outline-variant)', padding: '16px 24px', maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontSize: 12, color: 'var(--color-secondary)' }}>© {new Date().getFullYear()} S.T.R.A.W. Labs. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
