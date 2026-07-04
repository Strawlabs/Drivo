import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth.jsx'
import { buildUpiLink, initiateUpiPayment, confirmUpiPayment, failUpiPayment, payCash, generateReceipt } from '@/lib/payments'

const BADGES = ['Clean Car', 'Expert Driving', 'Great Chat', 'On Time', 'Safe Driver']
const UPI_TIMEOUT_SECONDS = 120

export default function RideCompletePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  const rideId = location.state?.rideId ?? null
  const driverFallback = location.state?.driver ?? { name: 'Ramesh K.', rating: 4.9, avatar: 'RK' }

  const [ride, setRide] = useState(null)
  const [driverInfo, setDriverInfo] = useState({ ...driverFallback, upiId: null })
  const [payment, setPayment] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const [payMethod, setPayMethod] = useState(null) // 'upi' | 'cash' | null — which flow the rider is mid-confirming
  const [upiRef, setUpiRef] = useState('')
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState(null)

  const [stars, setStars]       = useState(0)
  const [badges, setBadges]     = useState([])
  const [comment, setComment]   = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [secondsLeft, setSecondsLeft] = useState(null)
  const [timedOut, setTimedOut] = useState(false)

  const fare = ride?.final_fare ?? location.state?.fare ?? 284

  // UPI payments have no gateway callback for MVP — auto-fail a pending
  // payment if the rider never confirms within the timeout window, so it
  // doesn't sit at 'pending' forever. Timed from the payment's created_at
  // (not mount time) so this also recovers correctly after a page reload.
  useEffect(() => {
    if (payment?.status !== 'pending') return
    const createdAt = new Date(payment.created_at).getTime()
    let interval

    function tick() {
      const remaining = UPI_TIMEOUT_SECONDS - Math.floor((Date.now() - createdAt) / 1000)
      if (remaining <= 0) {
        clearInterval(interval)
        setSecondsLeft(0)
        handleUpiTimeout()
      } else {
        setSecondsLeft(remaining)
      }
    }

    tick()
    interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [payment?.id, payment?.status])

  async function handleUpiTimeout() {
    if (!payment) return
    setTimedOut(true)
    try {
      await failUpiPayment(payment.id)
    } catch {
      // best-effort — UI still shows the timed-out state either way
    }
    setPayment(p => (p && p.status === 'pending' ? { ...p, status: 'failed' } : p))
  }

  useEffect(() => {
    if (!rideId) return
    async function load() {
      const { data: rideRow } = await supabase.from('rides').select('*').eq('id', rideId).single()
      if (!rideRow) return
      setRide(rideRow)

      if (rideRow.driver_id) {
        const { data: dp } = await supabase
          .from('driver_profiles')
          .select('rating, upi_id, users(name)')
          .eq('id', rideRow.driver_id)
          .maybeSingle()
        if (dp) {
          const name = dp.users?.name ?? driverFallback.name
          setDriverInfo({
            name,
            avatar: name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
            rating: dp.rating ?? driverFallback.rating,
            upiId: dp.upi_id,
          })
        }
      }

      const { data: paymentRow } = await supabase
        .from('payments')
        .select('*')
        .eq('ride_id', rideId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (paymentRow) {
        setPayment(paymentRow)
        setPayMethod(paymentRow.method)
        if (paymentRow.status === 'completed') {
          const { data: existingReceipt } = await supabase
            .from('receipts').select('*').eq('payment_id', paymentRow.id).maybeSingle()
          if (existingReceipt) setReceipt(existingReceipt)
        }
      }
    }
    load()
  }, [rideId])

  function toggleBadge(b) {
    setBadges(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b])
  }

  async function handlePayUpi() {
    if (!ride || !user) return
    setPayError(null)
    setTimedOut(false)
    if (!driverInfo.upiId) {
      setPayError("This driver hasn't set up a UPI id yet — pay cash instead.")
      return
    }
    setPaying(true)
    try {
      const p = await initiateUpiPayment({ rideId: ride.id, riderId: user.id, driverId: ride.driver_id, amount: fare })
      setPayment(p)
      setPayMethod('upi')
      const link = buildUpiLink({
        upiId: driverInfo.upiId,
        payeeName: driverInfo.name,
        amount: fare,
        note: `Drivo ride ${ride.id.slice(0, 8)}`,
      })
      window.location.href = link
    } catch (err) {
      setPayError(err.message)
    } finally {
      setPaying(false)
    }
  }

  async function handleConfirmUpi() {
    if (!payment) return
    setPaying(true)
    setPayError(null)
    try {
      const updated = await confirmUpiPayment({ paymentId: payment.id, upiReference: upiRef })
      setPayment(updated)
      if (updated.status === 'completed') {
        const r = await generateReceipt({ payment: updated, ride, driverName: driverInfo.name })
        setReceipt(r)
      }
    } catch (err) {
      setPayError(err.message)
    } finally {
      setPaying(false)
    }
  }

  async function handleUpiFailed() {
    if (!payment) return
    setTimedOut(false)
    await failUpiPayment(payment.id)
    setPayment(p => ({ ...p, status: 'failed' }))
  }

  function handleRetryUpi() {
    setPayment(null)
    setUpiRef('')
    setPayError(null)
    handlePayUpi()
  }

  async function handleConfirmCash() {
    if (!ride || !user) return
    setPaying(true)
    setPayError(null)
    try {
      const p = await payCash({ rideId: ride.id, riderId: user.id, driverId: ride.driver_id, amount: fare })
      setPayment(p)
      const r = await generateReceipt({ payment: p, ride, driverName: driverInfo.name })
      setReceipt(r)
    } catch (err) {
      setPayError(err.message)
    } finally {
      setPaying(false)
    }
  }

  function handleDownloadReceipt() {
    if (receipt) window.open(receipt.receipt_url, '_blank')
  }

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)
    if (rideId && user && stars > 0) {
      const review = [comment.trim(), badges.length ? `Tags: ${badges.join(', ')}` : ''].filter(Boolean).join(' — ')
      const { error } = await supabase.from('ride_ratings').insert({
        ride_id: rideId,
        rider_id: user.id,
        driver_id: ride?.driver_id ?? null,
        rating: stars,
        review: review || null,
      })
      if (error) console.error('Failed to save rating:', error.message)
    }
    navigate('/rider/home', { replace: true })
  }

  const isPaid = payment?.status === 'completed'

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
          <h2 style={{ fontSize: 44, fontWeight: 700, color: 'var(--color-on-surface)', letterSpacing: '-0.02em', marginBottom: 16 }}>₹{Number(fare).toFixed(2)}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, paddingTop: 16, borderTop: '1px solid rgba(187,203,187,0.3)' }}>
            <div>
              <p style={{ fontSize: 12, color: 'var(--color-secondary)' }}>Distance</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-primary)' }}>{ride?.distance_km ? `${ride.distance_km} km` : '—'}</p>
            </div>
            <div>
              <p style={{ fontSize: 12, color: 'var(--color-secondary)' }}>Duration</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-primary)' }}>{ride?.duration_minutes ? `${ride.duration_minutes} mins` : '—'}</p>
            </div>
          </div>
        </section>

        {/* Payment */}
        <section className="flex flex-col gap-3">
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-on-surface-variant)', letterSpacing: '0.03em' }}>Payment</p>

          {payError && (
            <p style={{ fontSize: 13, color: 'var(--color-error)', background: 'var(--color-error-container)', borderRadius: 10, padding: '8px 12px' }}>{payError}</p>
          )}

          {!payment && (
            <>
              <button onClick={handlePayUpi} disabled={paying}
                style={{ width: '100%', minHeight: 52, background: 'var(--color-on-surface)', color: 'white', border: 'none', borderRadius: 12, padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 15, fontWeight: 500, cursor: paying ? 'not-allowed' : 'pointer', opacity: paying ? 0.7 : 1 }}>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined">account_balance_wallet</span>
                  Pay via UPI
                </div>
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
              <button onClick={() => setPayMethod('cash')} disabled={paying}
                style={{ width: '100%', minHeight: 52, background: 'var(--color-surface-container)', color: 'var(--color-on-surface)', border: 'none', borderRadius: 12, padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined">payments</span>
                  Pay Cash
                </div>
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </>
          )}

          {/* Cash confirmation step (before a payment row exists) */}
          {!payment && payMethod === 'cash' && (
            <div style={{ background: 'var(--color-surface-container-low)', borderRadius: 12, padding: 16 }}>
              <p style={{ fontSize: 13, color: 'var(--color-on-surface)', marginBottom: 10 }}>
                Confirm you've handed ₹{Number(fare).toFixed(2)} in cash to {driverInfo.name}.
              </p>
              <button onClick={handleConfirmCash} disabled={paying}
                style={{ width: '100%', height: 44, background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: paying ? 'not-allowed' : 'pointer', opacity: paying ? 0.7 : 1 }}>
                {paying ? 'Confirming…' : `Confirm ₹${Number(fare).toFixed(2)} Cash Received`}
              </button>
            </div>
          )}

          {/* UPI pending confirmation */}
          {payment?.status === 'pending' && (
            <div style={{ background: 'var(--color-surface-container-low)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 13, color: 'var(--color-on-surface)' }}>
                We opened your UPI app for ₹{Number(fare).toFixed(2)}. Once it goes through, enter the transaction reference below to confirm.
              </p>
              {secondsLeft !== null && (
                <p style={{ fontSize: 12, color: 'var(--color-secondary)' }}>
                  Times out in {String(Math.floor(secondsLeft / 60)).padStart(1, '0')}:{String(secondsLeft % 60).padStart(2, '0')} if not confirmed.
                </p>
              )}
              <input
                type="text"
                value={upiRef}
                onChange={e => setUpiRef(e.target.value)}
                placeholder="UPI transaction reference"
                style={{ height: 44, borderRadius: 10, border: '1px solid var(--color-outline-variant)', padding: '0 12px', fontSize: 14 }}
              />
              <button onClick={handleConfirmUpi} disabled={paying || !upiRef.trim()}
                style={{ width: '100%', height: 44, background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: paying || !upiRef.trim() ? 'not-allowed' : 'pointer', opacity: paying || !upiRef.trim() ? 0.6 : 1 }}>
                {paying ? 'Confirming…' : 'Confirm Payment'}
              </button>
              <button onClick={handleUpiFailed} disabled={paying}
                style={{ width: '100%', height: 40, background: 'none', border: '1px solid var(--color-outline-variant)', borderRadius: 10, fontSize: 13, fontWeight: 600, color: 'var(--color-secondary)', cursor: 'pointer' }}>
                Payment didn't go through
              </button>
            </div>
          )}

          {/* UPI failed → retry */}
          {payment?.status === 'failed' && (
            <div style={{ background: 'var(--color-error-container)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 13, color: 'var(--color-error)' }}>
                {timedOut ? 'This payment timed out waiting for confirmation.' : "That payment didn't complete."}
              </p>
              <button onClick={handleRetryUpi} disabled={paying}
                style={{ width: '100%', height: 44, background: 'var(--color-error)', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Retry Payment
              </button>
            </div>
          )}

          {/* Flagged — duplicate/suspicious reference */}
          {payment?.status === 'flagged' && (
            <div style={{ background: 'var(--color-error-container)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 13, color: 'var(--color-error)' }}>
                That UPI reference has already been used on another payment, so this one's been flagged for review instead of marked paid. Contact support, or try again with the correct reference.
              </p>
              <button onClick={handleRetryUpi} disabled={paying}
                style={{ width: '100%', height: 44, background: 'var(--color-on-surface)', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Try Again
              </button>
            </div>
          )}

          {/* Paid */}
          {isPaid && (
            <div style={{ background: 'rgba(46,204,113,0.1)', border: '1px solid rgba(46,204,113,0.3)', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>check_circle</span>
              <p style={{ fontSize: 13, color: 'var(--color-on-surface)' }}>
                Paid via {payment.method.toUpperCase()} · ₹{Number(payment.amount).toFixed(2)}
              </p>
            </div>
          )}

          <button onClick={handleDownloadReceipt} disabled={!receipt}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: 'none', border: 'none', color: receipt ? 'var(--color-primary)' : 'var(--color-outline-variant)', fontSize: 13, fontWeight: 600, cursor: receipt ? 'pointer' : 'not-allowed', padding: '4px 0' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
            {receipt ? 'Download Receipt' : 'Receipt available after payment'}
          </button>
        </section>

        {/* Rating */}
        <section style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', border: '1px solid #F1F5F9', borderRadius: 16, padding: 20, boxShadow: '0 2px 12px rgba(26,43,60,0.05)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div style={{ position: 'relative' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 22, border: '2px solid var(--color-primary-container)' }}>
                {driverInfo.avatar}
              </div>
              <div style={{ position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, background: 'var(--color-primary)', borderRadius: '50%', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 12, color: 'white' }}>check</span>
              </div>
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-on-surface)' }}>Rate your Driver</h3>
              <p style={{ fontSize: 13, color: 'var(--color-secondary)' }}>{driverInfo.name} is an EV Specialist</p>
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
