import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

/*
  First-run intro carousel (Stitch: onboarding_flow). Three slides, Skip /
  Next / dots, last slide continues to Login. Marks itself seen in
  localStorage so the funnel can skip it next time. Copy is the real
  product story — no invented stats or testimonials.
*/
const SLIDES = [
  {
    key: 'trusted',
    title: 'Trusted Drivers',
    body: 'Save the drivers you like and request them by name next time — no more a different stranger every ride.',
    illustration: (
      <svg viewBox="0 0 200 160" fill="none">
        <circle cx="100" cy="66" r="34" fill="rgba(0,109,55,0.12)" />
        <circle cx="100" cy="58" r="18" fill="var(--color-primary)" />
        <path d="M64 118c0-20 16-32 36-32s36 12 36 32" fill="var(--color-primary)" opacity="0.85" />
        <path d="M132 44l7 7 13-14" stroke="#4ae183" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'upi',
    title: 'Pay the Driver Directly',
    body: 'Fares go straight to your driver over UPI. Drivo never holds the money and never takes a commission.',
    illustration: (
      <svg viewBox="0 0 200 160" fill="none">
        <rect x="44" y="52" width="112" height="72" rx="12" fill="rgba(0,109,55,0.12)" />
        <rect x="44" y="52" width="112" height="20" rx="10" fill="var(--color-primary)" />
        <path d="M92 96h44M92 108h28" stroke="var(--color-primary)" strokeWidth="6" strokeLinecap="round" />
        <path d="M150 30l-12 20h9l-4 16 16-22h-9z" fill="#4ae183" />
      </svg>
    ),
  },
  {
    key: 'gohome',
    title: 'Every Ride Is Electric',
    body: 'Only EV autos and cars. Drivers can even flip on Go Home Mode to catch a fare on the way back — nobody drives home empty.',
    illustration: (
      <svg viewBox="0 0 200 160" fill="none">
        <path d="M40 96l18-18c6-6 14-9 24-9h36c10 0 19 3 25 10l16 17" fill="rgba(0,109,55,0.14)" stroke="var(--color-primary)" strokeWidth="5" strokeLinejoin="round" />
        <rect x="34" y="96" width="132" height="26" rx="10" fill="var(--color-primary)" />
        <circle cx="66" cy="122" r="10" fill="#0b1c30" stroke="var(--color-primary)" strokeWidth="4" />
        <circle cx="134" cy="122" r="10" fill="#0b1c30" stroke="var(--color-primary)" strokeWidth="4" />
        <path d="M150 40l-10 16h7l-3 13 13-18h-7z" fill="#4ae183" />
      </svg>
    ),
  },
]

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)
  const isLast = index === SLIDES.length - 1

  function finish() {
    try { localStorage.setItem('drivo_onboarded', '1') } catch { /* private mode — just proceed */ }
    navigate('/login')
  }

  const slide = SLIDES[index]

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--color-background)',
        fontFamily: 'var(--font-sans)',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 24px 32px',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      {/* Top row */}
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--color-on-surface)' }}>Drivo</span>
        <button
          onClick={finish}
          style={{ background: 'none', border: 'none', fontSize: 15, fontWeight: 600, color: 'var(--color-secondary)', cursor: 'pointer' }}
        >
          Skip
        </button>
      </div>

      {/* Slide */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
        <div
          style={{
            width: '100%',
            aspectRatio: '5 / 4',
            borderRadius: 24,
            background: 'var(--color-surface-container-low)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 32,
          }}
        >
          <div style={{ width: '62%' }}>{slide.illustration}</div>
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-on-surface)', textAlign: 'center' }}>
          {slide.title}
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.5, color: 'var(--color-secondary)', textAlign: 'center', maxWidth: 340, margin: '0 auto' }}>
          {slide.body}
        </p>
      </div>

      {/* Dots */}
      <div className="flex items-center justify-center" style={{ gap: 8, marginBottom: 24 }}>
        {SLIDES.map((s, i) => (
          <span
            key={s.key}
            style={{
              height: 8,
              width: i === index ? 24 : 8,
              borderRadius: 9999,
              background: i === index ? 'var(--color-primary)' : 'var(--color-outline-variant)',
              transition: 'width 0.2s ease',
            }}
          />
        ))}
      </div>

      {/* CTA */}
      <div className="flex items-center justify-between" style={{ gap: 12 }}>
        <button
          onClick={() => setIndex(i => Math.max(0, i - 1))}
          disabled={index === 0}
          style={{
            height: 52,
            padding: '0 20px',
            borderRadius: 9999,
            border: 'none',
            background: 'none',
            fontSize: 15,
            fontWeight: 600,
            color: index === 0 ? 'transparent' : 'var(--color-secondary)',
            cursor: index === 0 ? 'default' : 'pointer',
          }}
        >
          Back
        </button>
        <button
          onClick={() => (isLast ? finish() : setIndex(i => i + 1))}
          style={{
            flex: 1,
            maxWidth: 200,
            height: 52,
            borderRadius: 9999,
            border: 'none',
            background: 'var(--color-primary)',
            color: 'white',
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,109,55,0.25)',
          }}
        >
          {isLast ? 'Get Started' : 'Next'}
        </button>
      </div>
    </div>
  )
}
