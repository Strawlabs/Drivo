import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth.jsx'
import {
  fetchPlans, fetchCurrentSubscription, fetchSubscriptionHistory,
  checkAndUpdateSubscriptionStatus, activateSubscription, renewSubscription,
} from '@/lib/riderSubscriptions'

const PLAN_BENEFITS = {
  care:   ['Save unlimited preferred drivers', 'Request them directly for future & scheduled rides'],
  family: ['Everything in Care', '90-day validity — better value for regular riders'],
}

const STATUS_LABEL = {
  active: { text: 'Active', color: 'var(--color-primary)', bg: 'rgba(46,204,113,0.12)' },
  grace_period: { text: 'Grace Period', color: '#b45309', bg: 'rgba(245,158,11,0.14)' },
  expired: { text: 'Expired', color: 'var(--color-error)', bg: 'rgba(186,26,26,0.1)' },
  cancelled: { text: 'Cancelled', color: 'var(--color-secondary)', bg: 'var(--color-surface-container-low)' },
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function PlanCard({ plan, isCurrent, currentStatus, highlight, onSubscribe, onRenew }) {
  const benefits = PLAN_BENEFITS[plan.name] ?? []
  const label = plan.name.charAt(0).toUpperCase() + plan.name.slice(1)

  return (
    <div style={{
      background: 'white', borderRadius: 16, padding: 20, position: 'relative',
      border: highlight ? '2px solid var(--color-primary)' : '1px solid rgba(241,245,249,1)',
      boxShadow: highlight ? '0 8px 24px rgba(0,109,55,0.12)' : '0 2px 8px rgba(26,43,60,0.05)',
    }}>
      {highlight && (
        <span style={{ position: 'absolute', top: -1, right: 16, background: 'var(--color-primary)', color: 'white', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: '0 0 8px 8px' }}>
          BEST VALUE
        </span>
      )}
      <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-on-surface)' }}>{label} Plan</p>
      <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-on-surface)', marginTop: 6 }}>
        ₹{Number(plan.price).toFixed(0)}<span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-secondary)' }}> / {plan.duration_days} days</span>
      </p>
      <div style={{ marginTop: 14, marginBottom: 16 }}>
        {benefits.map(b => (
          <div key={b} className="flex items-center gap-2" style={{ marginBottom: 6 }}>
            <span style={{ color: 'var(--color-primary)', fontSize: 14 }}>✓</span>
            <span style={{ fontSize: 13, color: 'var(--color-on-surface)' }}>{b}</span>
          </div>
        ))}
      </div>
      {isCurrent ? (
        currentStatus === 'grace_period' ? (
          <button onClick={() => onRenew(plan)} style={{ width: '100%', height: 44, background: '#b45309', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Renew Now — Grace Period
          </button>
        ) : (
          <button disabled style={{ width: '100%', height: 44, background: 'var(--color-surface-container-low)', color: 'var(--color-secondary)', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'default' }}>
            Current Plan
          </button>
        )
      ) : (
        <button onClick={() => onSubscribe(plan)} style={{ width: '100%', height: 44, background: highlight ? 'var(--color-primary)' : 'white', color: highlight ? 'white' : 'var(--color-on-surface)', border: highlight ? 'none' : '1px solid var(--color-outline-variant)', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          {currentStatus ? 'Switch Plan' : 'Subscribe'}
        </button>
      )}
    </div>
  )
}

function PaymentPanel({ plan, mode, onConfirm, onClose, onSimulateFailure, submitting, error, failedWarning }) {
  const [upiRef, setUpiRef] = useState('')
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: 'white', width: '100%', maxWidth: 480, margin: '0 auto', borderRadius: '20px 20px 0 0', padding: 24 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
          {mode === 'renew' ? 'Renew' : 'Subscribe to'} {plan.name.charAt(0).toUpperCase() + plan.name.slice(1)}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--color-secondary)', marginBottom: 16 }}>
          Pay ₹{Number(plan.price).toFixed(0)} via UPI to <strong>drivo.subscriptions@upi</strong>, then enter the reference below to confirm.
        </p>
        {failedWarning && (
          <p style={{ fontSize: 13, color: 'var(--color-error)', background: 'rgba(186,26,26,0.08)', padding: '10px 12px', borderRadius: 10, marginBottom: 12 }}>
            Payment failed or was not completed. Your {mode === 'renew' ? 'current plan stays active until it expires' : 'account has not been charged'} — please try again.
          </p>
        )}
        <input type="text" placeholder="UPI transaction reference" value={upiRef} onChange={e => setUpiRef(e.target.value)}
          style={{ width: '100%', height: 46, padding: '0 14px', background: '#F8F9FA', border: 'none', borderRadius: 10, fontSize: 14, marginBottom: 8, boxSizing: 'border-box' }} />
        {error && <p style={{ fontSize: 12, color: 'var(--color-error)', marginBottom: 8 }}>{error}</p>}
        <button onClick={() => onConfirm(upiRef)} disabled={submitting}
          style={{ width: '100%', height: 46, background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', marginBottom: 8 }}>
          {submitting ? 'Confirming…' : 'Confirm Payment'}
        </button>
        <button onClick={onClose} style={{ width: '100%', height: 40, background: 'none', border: 'none', color: 'var(--color-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Cancel
        </button>
        {!failedWarning && (
          <button onClick={onSimulateFailure} style={{ width: '100%', marginTop: 4, background: 'none', border: 'none', color: 'var(--color-secondary)', fontSize: 11, textDecoration: 'underline', cursor: 'pointer' }}>
            (test) Simulate payment failure
          </button>
        )}
      </div>
    </div>
  )
}

export default function RiderSubscriptionPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState([])
  const [current, setCurrent] = useState(null)
  const [history, setHistory] = useState([])

  const [panel, setPanel] = useState(null) // { plan, mode: 'new'|'renew' }
  const [submitting, setSubmitting] = useState(false)
  const [panelError, setPanelError] = useState('')
  const [failedWarning, setFailedWarning] = useState(false)

  const load = useCallback(async (riderId) => {
    await checkAndUpdateSubscriptionStatus(riderId)
    const [p, c, h] = await Promise.all([
      fetchPlans(),
      fetchCurrentSubscription(riderId),
      fetchSubscriptionHistory(riderId),
    ])
    setPlans(p)
    setCurrent(c)
    setHistory(h)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!user) return
    load(user.id)
  }, [user, load])

  const currentStatus = current && ['active', 'grace_period'].includes(current.status) ? current.status : null

  function openPanel(plan, mode) {
    setPanel({ plan, mode })
    setPanelError('')
    setFailedWarning(false)
  }

  async function handleConfirm(upiRef) {
    if (submitting || !panel || !user) return
    setSubmitting(true)
    setPanelError('')
    try {
      if (panel.mode === 'renew') {
        await renewSubscription({ riderId: user.id, currentSubscription: current, planId: panel.plan.id, upiReference: upiRef })
      } else {
        await activateSubscription({ riderId: user.id, planId: panel.plan.id, upiReference: upiRef })
      }
      setPanel(null)
      await load(user.id)
    } catch (err) {
      setPanelError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function simulateFailure() {
    setFailedWarning(true)
    setPanelError('')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-background)' }}>
        <p style={{ color: 'var(--color-secondary)' }}>Loading…</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-background)', fontFamily: 'var(--font-sans)' }}>
      <header className="sticky top-0 z-40 flex items-center gap-3 px-5 py-3"
        style={{ background: 'var(--color-surface)', boxShadow: '0 1px 0 var(--color-surface-container-low)' }}>
        <button onClick={() => navigate(-1)}
          style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-surface-container-low)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-on-surface)' }}>🎖️ Subscription</h1>
          <p style={{ fontSize: 12, color: 'var(--color-secondary)' }}>Care & Family rider plans</p>
        </div>
      </header>

      <main style={{ maxWidth: 480, width: '100%', margin: '0 auto', padding: '20px 20px 60px' }}>

        {/* Current status */}
        {current && (
          <div style={{ background: 'white', borderRadius: 14, padding: 16, marginBottom: 20, border: '1px solid rgba(241,245,249,1)' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-on-surface)' }}>
                {current.rider_subscription_plans?.name?.charAt(0).toUpperCase() + current.rider_subscription_plans?.name?.slice(1)} Plan
              </p>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 9999, background: STATUS_LABEL[current.status]?.bg, color: STATUS_LABEL[current.status]?.color }}>
                {STATUS_LABEL[current.status]?.text ?? current.status}
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--color-secondary)' }}>
              {current.status === 'expired' ? 'Expired' : 'Renews'} on {formatDate(current.expiry_date)}
            </p>
            <p style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 2 }}>
              Payment: {current.payment_reference ? `Paid via UPI (${current.payment_reference})` : 'No payment on file'}
            </p>
            {current.status === 'grace_period' && (
              <p style={{ fontSize: 12, color: '#b45309', marginTop: 8, fontWeight: 600 }}>
                Your plan lapsed on {formatDate(current.expiry_date)}. Renew before the grace period ends to keep saving preferred drivers.
              </p>
            )}
            {current.status === 'expired' && (
              <p style={{ fontSize: 12, color: 'var(--color-error)', marginTop: 8, fontWeight: 600 }}>
                Preferred Drivers is now restricted until you renew.
              </p>
            )}
          </div>
        )}

        {/* Plans */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
          {plans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={current?.plan_id === plan.id && currentStatus !== null}
              currentStatus={current?.plan_id === plan.id ? currentStatus : null}
              highlight={plan.name === 'family'}
              onSubscribe={p => openPanel(p, 'new')}
              onRenew={p => openPanel(p, 'renew')}
            />
          ))}
        </div>

        {/* History */}
        {history.length > 0 && (
          <section>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: 12 }}>Subscription History</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.map(h => (
                <div key={h.id} style={{ background: 'white', borderRadius: 12, padding: 12, border: '1px solid rgba(241,245,249,1)' }}>
                  <div className="flex items-center justify-between">
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-on-surface)' }}>
                      {h.rider_subscription_plans?.name?.charAt(0).toUpperCase() + h.rider_subscription_plans?.name?.slice(1)} · ₹{Number(h.rider_subscription_plans?.price ?? 0).toFixed(0)}
                    </p>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, background: STATUS_LABEL[h.status]?.bg, color: STATUS_LABEL[h.status]?.color }}>
                      {STATUS_LABEL[h.status]?.text ?? h.status}
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--color-secondary)', marginTop: 4 }}>
                    {formatDate(h.start_date)} → {formatDate(h.expiry_date)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {panel && (
        <PaymentPanel
          plan={panel.plan}
          mode={panel.mode}
          onConfirm={handleConfirm}
          onClose={() => setPanel(null)}
          onSimulateFailure={simulateFailure}
          submitting={submitting}
          error={panelError}
          failedWarning={failedWarning}
        />
      )}
    </div>
  )
}
