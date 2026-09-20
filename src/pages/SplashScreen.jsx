/*
  Branded cold-start splash (Stitch: drivo_splash_screen). Shows once per
  browser session on first load, then hands off to the router. The Stitch
  frame uses a photographic EV render; we draw an on-brand SVG instead so
  the app ships no external image assets.
*/
export default function SplashScreen() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--color-background)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
        padding: 24,
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Logo lockup */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: 'var(--color-on-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 12px 32px rgba(11,28,48,0.25)',
          }}
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
            <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" fill="#4ae183" />
          </svg>
        </div>
        <span style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-on-surface)' }}>
          Drivo
        </span>
      </div>

      <p
        style={{
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.28em',
          color: 'var(--color-secondary)',
          textTransform: 'uppercase',
        }}
      >
        Driver First. Ride Better.
      </p>

      {/* EV silhouette */}
      <div
        style={{
          width: '100%',
          maxWidth: 360,
          aspectRatio: '16 / 10',
          borderRadius: 24,
          background: 'linear-gradient(135deg, #0f1923 0%, #123024 55%, #0b1c30 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 50% 120%, rgba(74,225,131,0.35), transparent 60%)',
          }}
        />
        <svg width="72%" viewBox="0 0 240 90" fill="none" style={{ position: 'relative' }}>
          <path
            d="M12 62 L34 44 C42 38 54 34 68 34 L150 34 C166 34 180 40 192 52 L214 58 C224 60 230 66 230 72 L230 74 L12 74 Z"
            fill="rgba(255,255,255,0.06)"
            stroke="#4ae183"
            strokeWidth="2"
          />
          <circle cx="66" cy="74" r="13" fill="#0f1923" stroke="#4ae183" strokeWidth="3" />
          <circle cx="182" cy="74" r="13" fill="#0f1923" stroke="#4ae183" strokeWidth="3" />
        </svg>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--color-primary)',
            display: 'inline-block',
            animation: 'splashPulse 1.2s ease-in-out infinite',
          }}
        />
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--color-secondary)' }}>
          Starting up…
        </span>
      </div>

      <style>{`
        @keyframes splashPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.35; transform: scale(1.4); }
        }
      `}</style>
    </div>
  )
}
