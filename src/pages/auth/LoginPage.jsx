import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState('details')   // 'details' | 'otp'
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isNewUser, setIsNewUser] = useState(false)
  const [codePreviouslySent, setCodePreviouslySent] = useState(false)

  async function handleSendOtp(e) {
    e?.preventDefault()
    setLoading(true)
    setError(null)

    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })

    setLoading(false)

    if (otpErr) {
      const isRateLimit =
        otpErr.status === 429 ||
        otpErr.message?.toLowerCase().includes('rate') ||
        otpErr.message?.toLowerCase().includes('email send')
      if (isRateLimit) {
        setCodePreviouslySent(true)
        setStep('otp')
      } else {
        setError(otpErr.message)
      }
    } else {
      setStep('otp')
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    })

    setLoading(false)
    if (error) { setError(error.message); return }
    navigate('/')
  }

  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center px-5 py-10 relative overflow-hidden"
      style={{ background: 'var(--color-background)' }}
    >
      {/* Background glow blobs */}
      <div
        className="pointer-events-none absolute"
        style={{
          bottom: -100, left: -100,
          width: 320, height: 320,
          background: 'var(--color-primary)',
          opacity: 0.08,
          filter: 'blur(120px)',
          borderRadius: '50%',
        }}
      />
      <div
        className="pointer-events-none absolute"
        style={{
          top: -50, right: -50,
          width: 256, height: 256,
          background: 'var(--color-primary-container)',
          opacity: 0.15,
          filter: 'blur(100px)',
          borderRadius: '50%',
        }}
      />

      <div className="w-full max-w-sm flex flex-col items-center gap-8 relative z-10">

        {/* Brand header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div
            className="w-16 h-16 flex items-center justify-center"
            style={{
              background: 'var(--color-primary)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0px 10px 30px rgba(26,43,60,0.18)',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M5 17H3a1 1 0 01-1-1v-4l2.5-5h11L18 12v4a1 1 0 01-1 1h-2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="7.5" cy="17.5" r="1.5" fill="white"/>
              <circle cx="14.5" cy="17.5" r="1.5" fill="white"/>
              <path d="M15 7l2 2-2 2M9 7l-2 2 2 2" stroke="#4ae183" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h1
              className="font-semibold"
              style={{ fontSize: 24, lineHeight: '32px', letterSpacing: '-0.01em', color: 'var(--color-on-surface)' }}
            >
              Drivo
            </h1>
            <p style={{ fontSize: 14, color: 'var(--color-on-secondary-container)', lineHeight: '20px', maxWidth: 280 }}>
              Premium sustainable mobility. Secure access for a greener future.
            </p>
          </div>
        </div>

        {/* Card */}
        <div
          className="w-full flex flex-col gap-5 p-6"
          style={{
            background: '#ffffff',
            borderRadius: 24,
            boxShadow: '0px 10px 30px rgba(26,43,60,0.12)',
            border: '1px solid var(--color-surface-variant)',
          }}
        >
          <div className="flex flex-col gap-1">
            <h2 style={{ fontSize: 24, fontWeight: 600, color: 'var(--color-on-surface)', lineHeight: '32px' }}>
              {step === 'details' ? 'Welcome Back' : 'Check your inbox'}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--color-on-surface-variant)', lineHeight: '20px' }}>
              {step === 'details'
                ? 'Enter your details to continue'
                : `We sent a 6-digit code to ${email}`}
            </p>
          </div>

          {step === 'details' ? (
            <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
              {/* Phone number */}
              <div className="flex flex-col gap-1">
                <label style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-on-surface)', marginLeft: 4 }}>
                  Mobile Number
                </label>
                <div className="relative flex items-center">
                  <span
                    className="absolute flex items-center justify-center pointer-events-none"
                    style={{ left: 16, color: 'var(--color-secondary)' }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <rect x="7" y="2" width="10" height="20" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                      <circle cx="12" cy="18" r="1" fill="currentColor"/>
                    </svg>
                  </span>
                  <input
                    type="tel"
                    placeholder="+91 00000 00000"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    required
                    autoFocus
                    autoComplete="tel"
                    className="w-full"
                    style={{
                      height: 56,
                      paddingLeft: 52,
                      paddingRight: 16,
                      background: 'var(--color-surface-container-low)',
                      borderRadius: 12,
                      border: 'none',
                      fontSize: 16,
                      color: 'var(--color-on-surface)',
                      outline: 'none',
                    }}
                    onFocus={e => e.target.style.boxShadow = '0 0 0 2px rgba(0,109,55,0.25)'}
                    onBlur={e => e.target.style.boxShadow = 'none'}
                  />
                </div>
              </div>

              {/* Email — for receiving OTP only */}
              <div className="flex flex-col gap-1">
                <label style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-on-surface)', marginLeft: 4 }}>
                  Email{' '}
                  <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-on-surface-variant)' }}>
                    (we'll send your login code here)
                  </span>
                </label>
                <div className="relative flex items-center">
                  <span
                    className="absolute flex items-center justify-center pointer-events-none"
                    style={{ left: 16, color: 'var(--color-secondary)' }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M2 7l10 7 10-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </span>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="w-full"
                    style={{
                      height: 56,
                      paddingLeft: 52,
                      paddingRight: 16,
                      background: 'var(--color-surface-container-low)',
                      borderRadius: 12,
                      border: 'none',
                      fontSize: 16,
                      color: 'var(--color-on-surface)',
                      outline: 'none',
                    }}
                    onFocus={e => e.target.style.boxShadow = '0 0 0 2px rgba(0,109,55,0.25)'}
                    onBlur={e => e.target.style.boxShadow = 'none'}
                  />
                </div>
              </div>

              {error && (
                <p style={{ fontSize: 13, color: 'var(--color-error)' }}>{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2"
                style={{
                  height: 48,
                  width: '100%',
                  background: loading ? 'var(--color-outline-variant)' : 'var(--color-on-surface)',
                  color: '#ffffff',
                  borderRadius: 9999,
                  border: 'none',
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: '0.01em',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0px 10px 30px rgba(26,43,60,0.12)',
                  transition: 'all 0.15s ease',
                }}
              >
                {loading ? 'Checking…' : 'Log In'}
                {!loading && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                {codePreviouslySent && (
                  <div
                    style={{
                      background: 'rgba(46,204,113,0.1)',
                      border: '1px solid rgba(46,204,113,0.3)',
                      borderRadius: 10,
                      padding: '10px 14px',
                      fontSize: 13,
                      color: 'var(--color-on-primary-container)',
                      marginBottom: 4,
                    }}
                  >
                    A code was already sent — enter it below to sign in.
                  </div>
                )}

                <div className="flex justify-between items-center" style={{ paddingLeft: 4, paddingRight: 4 }}>
                  <label style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-on-surface)' }}>
                    One-Time Password
                  </label>
                  <button
                    type="button"
                    onClick={() => handleSendOtp()}
                    disabled={loading}
                    style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Resend code
                  </button>
                </div>

                <div className="relative flex items-center">
                  <span
                    className="absolute flex items-center justify-center pointer-events-none"
                    style={{ left: 16, color: 'var(--color-secondary)' }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="0  0  0  0  0  0"
                    maxLength={6}
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                    className="w-full text-center"
                    style={{
                      height: 56,
                      paddingLeft: 52,
                      paddingRight: 16,
                      background: 'var(--color-surface-container-low)',
                      borderRadius: 12,
                      border: 'none',
                      fontSize: 20,
                      fontWeight: 600,
                      letterSpacing: '0.5em',
                      color: 'var(--color-on-surface)',
                      outline: 'none',
                    }}
                    onFocus={e => e.target.style.boxShadow = '0 0 0 2px rgba(0,109,55,0.25)'}
                    onBlur={e => e.target.style.boxShadow = 'none'}
                  />
                </div>
              </div>

              {error && (
                <p style={{ fontSize: 13, color: 'var(--color-error)' }}>{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="flex items-center justify-center gap-2"
                style={{
                  height: 48,
                  width: '100%',
                  background: 'var(--color-primary)',
                  color: '#ffffff',
                  borderRadius: 9999,
                  border: 'none',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: loading || otp.length < 6 ? 'not-allowed' : 'pointer',
                  opacity: loading || otp.length < 6 ? 0.5 : 1,
                  boxShadow: '0 0 15px rgba(46,204,113,0.3)',
                  transition: 'all 0.15s ease',
                }}
              >
                {loading ? 'Verifying…' : 'Verify & Continue'}
                {!loading && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.5"/>
                  </svg>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setStep('details'); setError(null); setOtp(''); setIsNewUser(false); setCodePreviouslySent(false) }}
                style={{ fontSize: 13, color: 'var(--color-on-surface-variant)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ← Back
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="flex items-center gap-2 px-4 py-2"
            style={{
              background: 'var(--color-surface-container-high)',
              borderRadius: 9999,
              border: '1px solid var(--color-surface-variant)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2l3 4h4l-2 4 2 4h-4l-3 4-3-4H3l2-4-2-4h4l3-4z" fill="var(--color-primary)" stroke="var(--color-primary)" strokeWidth="0.5"/>
              <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', color: 'var(--color-on-surface-variant)' }}>
              Secure SSL Encrypted Connection
            </span>
          </div>
          <nav className="flex gap-6">
            <a href="#" style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', color: 'var(--color-secondary)', textDecoration: 'none' }}>
              Privacy Policy
            </a>
            <a href="#" style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', color: 'var(--color-secondary)', textDecoration: 'none' }}>
              Terms of Service
            </a>
          </nav>
        </div>

      </div>
    </div>
  )
}
