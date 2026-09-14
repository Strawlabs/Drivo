import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth.jsx'
import {
  fetchCampaigns, createCampaign, updateCampaignStatus,
  fetchCampaignAssignments, fetchEligibleDriversForCampaign,
  assignCampaignToDriver, completeAssignment,
} from '@/lib/ads'
import { fetchPlatformData, summarizeReports, REPORT_PERIODS } from '@/lib/reports'
import { fetchFlaggedPayments, resolveFlaggedPayment } from '@/lib/payments'

function Avatar({ name = '?', size = 40 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: '#d2e4fb', display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: '#4f6073', fontWeight: 700,
      fontSize: size * 0.38, flexShrink: 0
    }}>
      {name[0]?.toUpperCase()}
    </div>
  )
}

function DocsBadge({ status }) {
  // "submitted" used to read "✓ Verified" here — nobody had, since there
  // was no way to even view the uploaded files (see DriverDocumentsPanel).
  // Submitted means uploaded and awaiting review, not verified.
  if (status === 'submitted') return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:12, fontWeight:600, color:'#b45309', background:'rgba(245,158,11,0.14)', padding:'3px 10px', borderRadius:6 }}>
      <span className="material-symbols-outlined" style={{ fontSize:15 }}>hourglass_top</span> Docs Submitted
    </span>
  )
  if (status === 'pending') return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:12, fontWeight:600, color:'#ba1a1a', background:'rgba(186,26,26,0.08)', padding:'3px 10px', borderRadius:6 }}>
      <span className="material-symbols-outlined" style={{ fontSize:15 }}>error</span> Docs Pending
    </span>
  )
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:12, fontWeight:600, color:'#4f6073', background:'#e5eeff', padding:'3px 10px', borderRadius:6 }}>
      {status}
    </span>
  )
}

const KYC_DOC_LABELS = { license: "Driver's License", insurance: 'Vehicle Insurance', ev_cert: 'EV Certification' }

/*
  Actually lets the admin look at what a driver uploaded before approving
  them — previously "Approve" was a button with no way to ever see the
  license/insurance/EV-cert files DriverVerificationPage already uploads
  to the (private) kyc-documents bucket. Signed URLs, 10-minute expiry,
  fetched fresh every time this opens rather than cached/stored anywhere.
*/
function DriverDocumentsPanel({ driver, onClose }) {
  const [loading, setLoading] = useState(true)
  const [docs, setDocs] = useState({})
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const { data: files, error: listErr } = await supabase.storage.from('kyc-documents').list(driver.user_id)
      if (listErr) {
        if (!cancelled) { setError(listErr.message); setLoading(false) }
        return
      }
      const found = {}
      for (const f of files ?? []) {
        const docId = f.name.split('.')[0]
        const { data: signed } = await supabase.storage.from('kyc-documents')
          .createSignedUrl(`${driver.user_id}/${f.name}`, 600)
        if (signed?.signedUrl) found[docId] = signed.signedUrl
      }
      if (!cancelled) { setDocs(found); setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [driver.user_id])

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(11,28,48,0.5)', zIndex: 200 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'white', borderRadius: 16, padding: 24, width: 420, maxWidth: '90vw', zIndex: 201, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0b1c30', margin: 0 }}>{driver.users?.name ?? 'Driver'}'s documents</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#4f6073', lineHeight: 1 }}>✕</button>
        </div>
        <p style={{ fontSize: 12, color: '#4f6073', marginBottom: 16 }}>Links expire in 10 minutes.</p>

        {loading && <p style={{ fontSize: 13, color: '#4f6073' }}>Loading…</p>}
        {error && <p style={{ fontSize: 13, color: '#ba1a1a' }}>Couldn't load documents: {error}</p>}
        {!loading && !error && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(KYC_DOC_LABELS).map(([id, label]) => (
              <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f8f9ff', borderRadius: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#0b1c30' }}>{label}</span>
                {docs[id] ? (
                  <a href={docs[id]} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 700, color: '#006d37', textDecoration: 'underline' }}>View</a>
                ) : (
                  <span style={{ fontSize: 12, color: '#ba1a1a' }}>Not uploaded</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function SubscriptionAdminPanel() {
  const [plans, setPlans] = useState([])
  const [subs, setSubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)

  async function load() {
    setLoading(true)
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from('subscription_plans').select('*').order('price', { ascending: true }),
      supabase.from('driver_subscriptions').select('id, status, subscription_plans(name, price)'),
    ])
    setPlans(p ?? [])
    setSubs(s ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function updatePrice(planId, price) {
    setSavingId(planId)
    await supabase.from('subscription_plans').update({ price }).eq('id', planId)
    await load()
    setSavingId(null)
  }

  async function toggleActive(plan) {
    setSavingId(plan.id)
    await supabase.from('subscription_plans').update({ is_active: !plan.is_active }).eq('id', plan.id)
    await load()
    setSavingId(null)
  }

  const countsByPlan = plans.reduce((acc, plan) => {
    acc[plan.id] = subs.filter(s => s.subscription_plans?.name === plan.name && ['active', 'grace_period'].includes(s.status)).length
    return acc
  }, {})
  const totalRevenue = subs.reduce((sum, s) => sum + Number(s.subscription_plans?.price ?? 0), 0)
  const totalSubscribers = subs.filter(s => ['active', 'grace_period'].includes(s.status)).length

  if (loading) {
    return <p style={{ color: '#4f6073', fontSize: 14 }}>Loading…</p>
  }

  return (
    <>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 28 }}>
        {[
          { label: 'Active Subscribers', value: totalSubscribers, icon: 'groups' },
          { label: 'Total Revenue (all-time)', value: `₹${totalRevenue.toLocaleString('en-IN')}`, icon: 'account_balance_wallet' },
          { label: 'Plans', value: plans.length, icon: 'loyalty' },
        ].map(card => (
          <div key={card.label} style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid #f1f5f9', borderRadius: 18, padding: 24, boxShadow: '0 4px 20px rgba(26,43,60,0.05)' }}>
            <div style={{ padding: 10, background: '#d2e4fb', borderRadius: 12, display: 'inline-flex', marginBottom: 12 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#4f6073' }}>{card.icon}</span>
            </div>
            <p style={{ fontSize: 13, color: '#4f6073', marginBottom: 4 }}>{card.label}</p>
            <h3 style={{ fontSize: 28, fontWeight: 600, color: '#0b1c30', margin: 0 }}>{card.value}</h3>
          </div>
        ))}
      </section>

      <section style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid #f1f5f9', borderRadius: 18, boxShadow: '0 2px 8px rgba(26,43,60,0.05)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #bbcbbb' }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0b1c30', margin: 0 }}>Manage Plans</h2>
          <p style={{ fontSize: 12, color: '#4f6073', marginTop: 3 }}>Edit pricing and enable/disable Basic, Pro, and Elite.</p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#eff4ff' }}>
                {['Plan', 'Price', 'Duration', 'Subscribers', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '12px 24px', textAlign: h === '' ? 'right' : 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: '#4f6073', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plans.map(plan => (
                <tr key={plan.id} style={{ borderTop: '1px solid #e5eeff' }}>
                  <td style={{ padding: '16px 24px', fontSize: 13, fontWeight: 600, color: '#0b1c30' }}>
                    {plan.name.charAt(0).toUpperCase() + plan.name.slice(1)}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 13, color: '#4f6073' }}>₹</span>
                      <input type="number" defaultValue={plan.price} disabled={savingId === plan.id}
                        onBlur={e => { const v = Number(e.target.value); if (v > 0 && v !== plan.price) updatePrice(plan.id, v) }}
                        style={{ width: 80, height: 32, padding: '0 8px', border: '1px solid #bbcbbb', borderRadius: 6, fontSize: 13 }} />
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px', fontSize: 13, color: '#4f6073' }}>{plan.duration_days} days</td>
                  <td style={{ padding: '16px 24px', fontSize: 13, color: '#0b1c30' }}>{countsByPlan[plan.id] ?? 0}</td>
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: plan.is_active ? '#006d37' : '#ba1a1a', background: plan.is_active ? 'rgba(46,204,113,0.12)' : 'rgba(186,26,26,0.08)', padding: '3px 10px', borderRadius: 6 }}>
                      {plan.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <button onClick={() => toggleActive(plan)} disabled={savingId === plan.id}
                      style={{ padding: '6px 16px', border: '1px solid #6c7b6d', borderRadius: 8, background: 'none', color: '#3d4a3e', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      {plan.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

/*
  Same fix as SubscriptionAdminPanel's editable plan prices, applied to
  ride fares — base_fare/per_km_rate/min_fare/route_factor/avg_speed_kmh
  used to be hardcoded constants in src/lib/fare.js. The PRD leaves the
  actual fare model undecided; this at least makes changing the numbers
  a real, admin-controlled action instead of a code deploy.
*/
function PricingAdminPanel() {
  const [tiers, setTiers] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState(null)

  async function load() {
    setLoading(true)
    const [{ data: t }, { data: s }] = await Promise.all([
      supabase.from('fare_tiers').select('*').order('tier'),
      supabase.from('fare_settings').select('*').eq('id', 1).maybeSingle(),
    ])
    setTiers(t ?? [])
    setSettings(s ?? null)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function updateTier(tier, field, value) {
    setSavingKey(tier + field)
    await supabase.from('fare_tiers').update({ [field]: value, updated_at: new Date().toISOString() }).eq('tier', tier)
    await load()
    setSavingKey(null)
  }

  async function updateSettings(field, value) {
    setSavingKey('settings' + field)
    await supabase.from('fare_settings').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', 1)
    await load()
    setSavingKey(null)
  }

  if (loading) return <p style={{ color: '#4f6073', fontSize: 14 }}>Loading…</p>

  const numberField = (value, onCommit, key, { prefix = '', width = 80 } = {}) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {prefix && <span style={{ fontSize: 13, color: '#4f6073' }}>{prefix}</span>}
      <input type="number" defaultValue={value} disabled={savingKey === key}
        onBlur={e => { const v = Number(e.target.value); if (v > 0 && v !== Number(value)) onCommit(v) }}
        style={{ width, height: 32, padding: '0 8px', border: '1px solid #bbcbbb', borderRadius: 6, fontSize: 13 }} />
    </div>
  )

  return (
    <>
      <section style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid #f1f5f9', borderRadius: 18, boxShadow: '0 2px 8px rgba(26,43,60,0.05)', overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #bbcbbb' }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0b1c30', margin: 0 }}>Ride Fare Tiers</h2>
          <p style={{ fontSize: 12, color: '#4f6073', marginTop: 3 }}>Changes apply to every fare estimated from here on — riders currently mid-booking still see the value they already loaded.</p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#eff4ff' }}>
                {['Tier', 'Base Fare', 'Per-KM Rate', 'Minimum Fare'].map(h => (
                  <th key={h} style={{ padding: '12px 24px', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: '#4f6073', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tiers.map(t => (
                <tr key={t.tier} style={{ borderTop: '1px solid #e5eeff' }}>
                  <td style={{ padding: '16px 24px', fontSize: 13, fontWeight: 600, color: '#0b1c30' }}>{t.label}</td>
                  <td style={{ padding: '16px 24px' }}>{numberField(t.base_fare, v => updateTier(t.tier, 'base_fare', v), t.tier + 'base_fare', { prefix: '₹' })}</td>
                  <td style={{ padding: '16px 24px' }}>{numberField(t.per_km_rate, v => updateTier(t.tier, 'per_km_rate', v), t.tier + 'per_km_rate', { prefix: '₹/km' })}</td>
                  <td style={{ padding: '16px 24px' }}>{numberField(t.min_fare, v => updateTier(t.tier, 'min_fare', v), t.tier + 'min_fare', { prefix: '₹' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {settings && (
        <section style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid #f1f5f9', borderRadius: 18, boxShadow: '0 2px 8px rgba(26,43,60,0.05)', padding: '20px 24px' }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0b1c30', margin: '0 0 4px' }}>Route Assumptions</h2>
          <p style={{ fontSize: 12, color: '#4f6073', marginBottom: 20 }}>Shared across every tier — not a per-vehicle price, but how fare/ETA are estimated before a real route is fetched.</p>
          <div style={{ display: 'flex', gap: 32 }}>
            <div>
              <p style={{ fontSize: 12, color: '#4f6073', marginBottom: 6 }}>Route factor (real route ÷ straight-line distance)</p>
              {numberField(settings.route_factor, v => updateSettings('route_factor', v), 'settingsroute_factor', { width: 90 })}
            </div>
            <div>
              <p style={{ fontSize: 12, color: '#4f6073', marginBottom: 6 }}>Assumed average speed (km/h)</p>
              {numberField(settings.avg_speed_kmh, v => updateSettings('avg_speed_kmh', v), 'settingsavg_speed_kmh', { width: 90 })}
            </div>
          </div>
        </section>
      )}
    </>
  )
}

const INCIDENT_STATUS_COLOR = {
  open: { bg: 'rgba(186,26,26,0.08)', color: '#ba1a1a' },
  reviewing: { bg: '#e5eeff', color: '#4f6073' },
  resolved: { bg: 'rgba(46,204,113,0.12)', color: '#006d37' },
}

function SafetyAdminPanel() {
  const [incidents, setIncidents] = useState([])
  const [sosEvents, setSosEvents] = useState([])
  const [flaggedPayments, setFlaggedPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [notesDraft, setNotesDraft] = useState({})
  const { user } = useAuth()

  async function load() {
    setLoading(true)
    const [{ data: inc }, { data: sos }, flagged] = await Promise.all([
      supabase.from('incident_reports').select('*, users:reported_by(name, phone), rides(pickup_address, destination_address)').order('created_at', { ascending: false }),
      supabase.from('sos_events').select('*, rides(pickup_address, destination_address), users:triggered_by(name, phone)').order('created_at', { ascending: false }),
      fetchFlaggedPayments(),
    ])
    setIncidents(inc ?? [])
    setSosEvents(sos ?? [])
    setFlaggedPayments(flagged)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function updateStatus(id, status) {
    setSavingId(id)
    await supabase.from('incident_reports').update({
      status,
      resolution_notes: notesDraft[id] ?? null,
      reviewed_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    await load()
    setSavingId(null)
  }

  async function resolveSosEvent(id) {
    setSavingId(id)
    await supabase.from('sos_events').update({ resolved_at: new Date().toISOString() }).eq('id', id)
    await load()
    setSavingId(null)
  }

  async function resolvePayment(id, resolution) {
    setSavingId(id)
    try {
      await resolveFlaggedPayment(id, resolution)
      await load()
    } catch (err) {
      alert(err.message)
    } finally {
      setSavingId(null)
    }
  }

  if (loading) return <p style={{ color: '#4f6073', fontSize: 14 }}>Loading…</p>

  const openCount = incidents.filter(i => i.status === 'open').length
  const activeSosCount = sosEvents.filter(s => !s.resolved_at).length

  return (
    <>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 28 }}>
        {[
          { label: 'Open Incidents', value: openCount, icon: 'report' },
          { label: 'Active SOS Events', value: activeSosCount, icon: 'emergency_home' },
          { label: 'Flagged Payments', value: flaggedPayments.length, icon: 'flag' },
          { label: 'Total Reports', value: incidents.length, icon: 'assignment' },
        ].map(card => {
          const alert = (card.label === 'Active SOS Events' && activeSosCount > 0) || (card.label === 'Flagged Payments' && flaggedPayments.length > 0)
          return (
          <div key={card.label} style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid #f1f5f9', borderRadius: 18, padding: 24, boxShadow: '0 4px 20px rgba(26,43,60,0.05)' }}>
            <div style={{ padding: 10, background: alert ? 'rgba(186,26,26,0.12)' : '#d2e4fb', borderRadius: 12, display: 'inline-flex', marginBottom: 12 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 22, color: alert ? '#ba1a1a' : '#4f6073' }}>{card.icon}</span>
            </div>
            <p style={{ fontSize: 13, color: '#4f6073', marginBottom: 4 }}>{card.label}</p>
            <h3 style={{ fontSize: 28, fontWeight: 600, color: '#0b1c30', margin: 0 }}>{card.value}</h3>
          </div>
          )
        })}
      </section>

      <section style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid #f1f5f9', borderRadius: 18, boxShadow: '0 2px 8px rgba(26,43,60,0.05)', overflow: 'hidden', marginBottom: 28 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #bbcbbb' }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0b1c30', margin: 0 }}>SOS Events</h2>
          <p style={{ fontSize: 12, color: '#4f6073', marginTop: 3 }}>Audit log of every rider-triggered emergency.</p>
        </div>
        <div style={{ padding: '8px 24px 20px' }}>
          {sosEvents.length === 0 && <p style={{ fontSize: 13, color: '#4f6073', padding: '12px 0' }}>No SOS events recorded.</p>}
          {sosEvents.map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid #e5eeff' }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#0b1c30' }}>{s.users?.name ?? 'Unknown'} · {s.users?.phone}</p>
                <p style={{ fontSize: 12, color: '#4f6073' }}>{s.rides?.pickup_address ?? '—'} → {s.rides?.destination_address ?? '—'} · {new Date(s.created_at).toLocaleString('en-IN')}</p>
              </div>
              {s.resolved_at ? (
                <span style={{ fontSize: 12, fontWeight: 600, color: '#006d37', background: 'rgba(46,204,113,0.12)', padding: '4px 12px', borderRadius: 8 }}>Resolved</span>
              ) : (
                <button onClick={() => resolveSosEvent(s.id)} disabled={savingId === s.id}
                  style={{ padding: '6px 16px', border: 'none', borderRadius: 8, background: '#ba1a1a', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Mark Resolved
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid #f1f5f9', borderRadius: 18, boxShadow: '0 2px 8px rgba(26,43,60,0.05)', overflow: 'hidden', marginBottom: 28 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #bbcbbb' }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0b1c30', margin: 0 }}>Flagged Payments</h2>
          <p style={{ fontSize: 12, color: '#4f6073', marginTop: 3 }}>A UPI reference was reused across two payments — decide which (if either) actually paid.</p>
        </div>
        <div style={{ padding: '8px 24px 20px' }}>
          {flaggedPayments.length === 0 && <p style={{ fontSize: 13, color: '#4f6073', padding: '12px 0' }}>No flagged payments.</p>}
          {flaggedPayments.map(p => (
            <div key={p.id} style={{ padding: '14px 0', borderTop: '1px solid #e5eeff' }}>
              <div className="flex justify-between items-start" style={{ marginBottom: 6 }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#0b1c30' }}>
                    {p.users?.name ?? 'Unknown rider'} → {p.driver_profiles?.users?.name ?? 'Unknown driver'} · ₹{Number(p.amount).toFixed(2)}
                  </p>
                  <p style={{ fontSize: 12, color: '#4f6073' }}>
                    {p.rides?.pickup_address ?? '—'} → {p.rides?.destination_address ?? '—'} · {new Date(p.created_at).toLocaleString('en-IN')}
                  </p>
                  <p style={{ fontSize: 12, color: '#ba1a1a', marginTop: 4 }}>
                    Reference "{p.upi_reference}" also used by {p.conflictingPayment?.users?.name ?? 'another payment'}
                    {p.conflictingPayment ? ` (currently ${p.conflictingPayment.status})` : ''}.
                  </p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#ba1a1a', background: 'rgba(186,26,26,0.08)', padding: '3px 10px', borderRadius: 6, whiteSpace: 'nowrap' }}>flagged</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => resolvePayment(p.id, 'failed')} disabled={savingId === p.id}
                  style={{ padding: '6px 14px', border: '1px solid #ba1a1a', borderRadius: 8, background: 'none', color: '#ba1a1a', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Reject (Mark Failed)
                </button>
                <button onClick={() => resolvePayment(p.id, 'completed')} disabled={savingId === p.id}
                  style={{ padding: '6px 14px', border: 'none', borderRadius: 8, background: '#006d37', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Approve (Mark Completed)
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid #f1f5f9', borderRadius: 18, boxShadow: '0 2px 8px rgba(26,43,60,0.05)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #bbcbbb' }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0b1c30', margin: 0 }}>Incident Reports</h2>
          <p style={{ fontSize: 12, color: '#4f6073', marginTop: 3 }}>Review and resolve rider-submitted reports.</p>
        </div>
        <div style={{ padding: '8px 24px 20px' }}>
          {incidents.length === 0 && <p style={{ fontSize: 13, color: '#4f6073', padding: '12px 0' }}>No incident reports submitted.</p>}
          {incidents.map(i => {
            const colors = INCIDENT_STATUS_COLOR[i.status] ?? INCIDENT_STATUS_COLOR.open
            return (
              <div key={i.id} style={{ padding: '14px 0', borderTop: '1px solid #e5eeff' }}>
                <div className="flex justify-between items-start" style={{ marginBottom: 6 }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#0b1c30' }}>{i.users?.name ?? 'Unknown'} · {i.category}</p>
                    <p style={{ fontSize: 12, color: '#4f6073' }}>{i.rides?.pickup_address ?? '—'} → {i.rides?.destination_address ?? '—'} · {new Date(i.created_at).toLocaleString('en-IN')}</p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: colors.color, background: colors.bg, padding: '3px 10px', borderRadius: 6, whiteSpace: 'nowrap' }}>{i.status}</span>
                </div>
                <p style={{ fontSize: 13, color: '#0b1c30', marginBottom: 8 }}>{i.description}</p>
                {i.status !== 'resolved' && (
                  <div className="flex gap-2 items-center">
                    <input placeholder="Resolution notes (optional)" defaultValue={notesDraft[i.id] ?? i.resolution_notes ?? ''}
                      onChange={e => setNotesDraft(prev => ({ ...prev, [i.id]: e.target.value }))}
                      style={{ flex: 1, height: 32, padding: '0 10px', border: '1px solid #bbcbbb', borderRadius: 6, fontSize: 12 }} />
                    {i.status === 'open' && (
                      <button onClick={() => updateStatus(i.id, 'reviewing')} disabled={savingId === i.id}
                        style={{ padding: '6px 14px', border: '1px solid #6c7b6d', borderRadius: 8, background: 'none', color: '#3d4a3e', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        Mark Reviewing
                      </button>
                    )}
                    <button onClick={() => updateStatus(i.id, 'resolved')} disabled={savingId === i.id}
                      style={{ padding: '6px 14px', border: 'none', borderRadius: 8, background: '#006d37', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Resolve
                    </button>
                  </div>
                )}
                {i.status === 'resolved' && i.resolution_notes && (
                  <p style={{ fontSize: 12, color: '#4f6073', fontStyle: 'italic' }}>Resolution: {i.resolution_notes}</p>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </>
  )
}

const CAMPAIGN_STATUS_COLOR = {
  draft: { bg: '#e5eeff', color: '#4f6073' },
  active: { bg: 'rgba(46,204,113,0.12)', color: '#006d37' },
  completed: { bg: '#d2e4fb', color: '#4f6073' },
  cancelled: { bg: 'rgba(186,26,26,0.08)', color: '#ba1a1a' },
}

function AdsAdminPanel() {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', revenueSharePercent: 10, startDate: '', endDate: '' })
  const [selectedCampaignId, setSelectedCampaignId] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [eligibleDrivers, setEligibleDrivers] = useState([])
  const [creditDraft, setCreditDraft] = useState({})

  async function load() {
    setLoading(true)
    const data = await fetchCampaigns()
    setCampaigns(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function loadAssignments(campaignId) {
    const [a, e] = await Promise.all([fetchCampaignAssignments(campaignId), fetchEligibleDriversForCampaign(campaignId)])
    setAssignments(a)
    setEligibleDrivers(e)
  }

  async function handleSelectCampaign(id) {
    setSelectedCampaignId(id)
    await loadAssignments(id)
  }

  async function handleCreate() {
    if (!form.title.trim()) return
    await createCampaign({
      title: form.title.trim(),
      description: form.description.trim(),
      revenueSharePercent: Number(form.revenueSharePercent),
      startDate: form.startDate,
      endDate: form.endDate,
    })
    setForm({ title: '', description: '', revenueSharePercent: 10, startDate: '', endDate: '' })
    setShowCreate(false)
    await load()
  }

  async function handleStatusChange(id, status) {
    await updateCampaignStatus(id, status)
    await load()
    if (selectedCampaignId === id) await loadAssignments(id)
  }

  async function handleAssign(driverId) {
    if (!selectedCampaignId) return
    await assignCampaignToDriver({ campaignId: selectedCampaignId, driverId })
    await loadAssignments(selectedCampaignId)
    await load()
  }

  async function handleComplete(assignmentId) {
    const amount = Number(creditDraft[assignmentId])
    if (!amount || amount <= 0) return
    await completeAssignment(assignmentId, amount)
    await loadAssignments(selectedCampaignId)
    await load()
  }

  if (loading) return <p style={{ color: '#4f6073', fontSize: 14 }}>Loading…</p>

  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId)

  return (
    <>
      <section style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid #f1f5f9', borderRadius: 18, boxShadow: '0 2px 8px rgba(26,43,60,0.05)', overflow: 'hidden', marginBottom: 28 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #bbcbbb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0b1c30', margin: 0 }}>Ad Campaigns</h2>
            <p style={{ fontSize: 12, color: '#4f6073', marginTop: 3 }}>Assignable only to Elite-tier drivers.</p>
          </div>
          <button onClick={() => setShowCreate(s => !s)} style={{ padding: '8px 18px', border: 'none', borderRadius: 8, background: '#006d37', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {showCreate ? 'Cancel' : '+ Create Campaign'}
          </button>
        </div>

        {showCreate && (
          <div style={{ padding: 24, borderBottom: '1px solid #bbcbbb', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <input placeholder="Campaign title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              style={{ gridColumn: 'span 2', height: 40, padding: '0 12px', border: '1px solid #bbcbbb', borderRadius: 8, fontSize: 13 }} />
            <input placeholder="Description (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              style={{ gridColumn: 'span 2', height: 40, padding: '0 12px', border: '1px solid #bbcbbb', borderRadius: 8, fontSize: 13 }} />
            <div>
              <label style={{ fontSize: 11, color: '#4f6073' }}>Revenue share %</label>
              <input type="number" value={form.revenueSharePercent} onChange={e => setForm({ ...form, revenueSharePercent: e.target.value })}
                style={{ width: '100%', height: 40, padding: '0 12px', border: '1px solid #bbcbbb', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div />
            <div>
              <label style={{ fontSize: 11, color: '#4f6073' }}>Start date</label>
              <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })}
                style={{ width: '100%', height: 40, padding: '0 12px', border: '1px solid #bbcbbb', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#4f6073' }}>End date</label>
              <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })}
                style={{ width: '100%', height: 40, padding: '0 12px', border: '1px solid #bbcbbb', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <button onClick={handleCreate} style={{ gridColumn: 'span 2', height: 40, border: 'none', borderRadius: 8, background: '#006d37', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Save as Draft
            </button>
          </div>
        )}

        <div style={{ padding: '8px 24px 20px' }}>
          {campaigns.length === 0 && <p style={{ fontSize: 13, color: '#4f6073', padding: '12px 0' }}>No campaigns yet.</p>}
          {campaigns.map(c => {
            const colors = CAMPAIGN_STATUS_COLOR[c.status] ?? CAMPAIGN_STATUS_COLOR.draft
            return (
              <div key={c.id} onClick={() => handleSelectCampaign(c.id)}
                style={{ padding: '14px 12px', borderTop: '1px solid #e5eeff', cursor: 'pointer', background: selectedCampaignId === c.id ? '#f8f9ff' : 'transparent' }}>
                <div className="flex justify-between items-start" style={{ marginBottom: 6 }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#0b1c30' }}>{c.title}</p>
                    <p style={{ fontSize: 12, color: '#4f6073' }}>{c.revenue_share_percent}% share · {c.assignedCount} assigned · {c.acceptedCount} accepted · ₹{c.totalCredited.toLocaleString('en-IN')} credited</p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: colors.color, background: colors.bg, padding: '3px 10px', borderRadius: 6, whiteSpace: 'nowrap' }}>{c.status}</span>
                </div>
                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                  {c.status === 'draft' && (
                    <button onClick={() => handleStatusChange(c.id, 'active')} style={{ padding: '5px 12px', border: '1px solid #006d37', borderRadius: 6, background: 'none', color: '#006d37', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Activate</button>
                  )}
                  {c.status === 'active' && (
                    <>
                      <button onClick={() => handleStatusChange(c.id, 'completed')} style={{ padding: '5px 12px', border: '1px solid #6c7b6d', borderRadius: 6, background: 'none', color: '#3d4a3e', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Mark Completed</button>
                      <button onClick={() => handleStatusChange(c.id, 'cancelled')} style={{ padding: '5px 12px', border: '1px solid #ba1a1a', borderRadius: 6, background: 'none', color: '#ba1a1a', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {selectedCampaign && (
        <section style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid #f1f5f9', borderRadius: 18, boxShadow: '0 2px 8px rgba(26,43,60,0.05)', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #bbcbbb' }}>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0b1c30', margin: 0 }}>{selectedCampaign.title} — Assignments</h2>
          </div>
          <div style={{ padding: '20px 24px' }}>
            {eligibleDrivers.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#4f6073', marginBottom: 8, textTransform: 'uppercase' }}>Assign to Elite Driver</p>
                <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                  {eligibleDrivers.map(d => (
                    <button key={d.id} onClick={() => handleAssign(d.id)} style={{ padding: '6px 14px', border: '1px solid #006d37', borderRadius: 9999, background: 'none', color: '#006d37', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      + {d.name} (★{d.rating})
                    </button>
                  ))}
                </div>
              </div>
            )}
            {assignments.length === 0 ? (
              <p style={{ fontSize: 13, color: '#4f6073' }}>No drivers assigned to this campaign yet.</p>
            ) : assignments.map(a => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid #e5eeff' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#0b1c30' }}>{a.driverName}</p>
                  <p style={{ fontSize: 12, color: '#4f6073', textTransform: 'capitalize' }}>{a.status}{a.earningsCredited ? ` · ₹${a.earningsCredited} credited` : ''}</p>
                </div>
                {a.status === 'accepted' && (
                  <div className="flex gap-2 items-center">
                    <input type="number" placeholder="Amount (₹)" value={creditDraft[a.id] ?? ''}
                      onChange={e => setCreditDraft(prev => ({ ...prev, [a.id]: e.target.value }))}
                      style={{ width: 100, height: 32, padding: '0 10px', border: '1px solid #bbcbbb', borderRadius: 6, fontSize: 12 }} />
                    <button onClick={() => handleComplete(a.id)} style={{ padding: '6px 14px', border: 'none', borderRadius: 8, background: '#006d37', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Credit & Complete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}

function MiniBarChart({ buckets, series, height = 120 }) {
  const max = Math.max(1, ...buckets.flatMap(b => series.map(s => Number(b[s.key]) || 0)))
  return (
    <div style={{ height, display: 'flex', alignItems: 'flex-end', gap: 10 }}>
      {buckets.map(b => (
        <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%' }}>
          <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', gap: 2 }}>
            {series.map(s => (
              <div key={s.key} title={String(b[s.key])} style={{ flex: 1, height: `${(Number(b[s.key]) / max) * 100}%`, background: s.color, borderRadius: '3px 3px 0 0', minHeight: 2 }} />
            ))}
          </div>
          <span style={{ fontSize: 11, color: '#4f6073' }}>{b.label}</span>
        </div>
      ))}
    </div>
  )
}

function ReportCard({ title, subtitle, children }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid #f1f5f9', borderRadius: 18, padding: 24, boxShadow: '0 2px 8px rgba(26,43,60,0.05)' }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0b1c30', margin: 0 }}>{title}</h3>
      {subtitle && <p style={{ fontSize: 12, color: '#4f6073', marginTop: 3, marginBottom: 14 }}>{subtitle}</p>}
      {children}
    </div>
  )
}

function ReportsAdminPanel() {
  const [period, setPeriod] = useState('Monthly')
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchPlatformData().then(data => {
      if (cancelled) return
      setReport(summarizeReports(data, period))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [period])

  if (loading || !report) return <p style={{ color: '#4f6073', fontSize: 14 }}>Loading…</p>

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {REPORT_PERIODS.map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            style={{ padding: '8px 18px', borderRadius: 9999, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: period === p ? '#006d37' : '#e5eeff', color: period === p ? 'white' : '#3d4a3e' }}>
            {p}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <ReportCard title="Driver Growth" subtitle={`${report.driverGrowth.totalApproved} approved of ${report.driverGrowth.totalDrivers} total`}>
          <MiniBarChart buckets={report.driverGrowth.buckets} series={[{ key: 'newDrivers', color: '#006d37' }]} />
        </ReportCard>

        <ReportCard title="Ride Volume" subtitle={`${report.rideVolume.totalRidesAllTime} rides in the last 180 days`}>
          <MiniBarChart buckets={report.rideVolume.buckets} series={[{ key: 'total', color: '#d2e4fb' }, { key: 'completed', color: '#006d37' }]} />
        </ReportCard>

        <ReportCard title="Revenue" subtitle={`₹${report.revenue.totalRevenue.toLocaleString('en-IN')} total (₹${report.revenue.totalSubscriptionRevenue.toLocaleString('en-IN')} subscriptions + ₹${report.revenue.totalAdRevenue.toLocaleString('en-IN')} ads)`}>
          <MiniBarChart buckets={report.revenue.buckets} series={[{ key: 'subscriptionRevenue', color: '#006d37' }, { key: 'adRevenue', color: '#4f6073' }]} />
        </ReportCard>

        <ReportCard title="Preferred Driver Usage" subtitle={`${report.preferredDriverUsage.totalActivePreferred} active relationships today`}>
          <MiniBarChart buckets={report.preferredDriverUsage.buckets} series={[{ key: 'newSaves', color: '#2ecc71' }]} />
        </ReportCard>

        <ReportCard title="Cancellations" subtitle={`${report.cancellations.total} cancelled (${report.cancellations.rate}% of all rides)`}>
          <MiniBarChart buckets={report.cancellations.buckets} series={[{ key: 'cancelled', color: '#ba1a1a' }]} />
          {report.cancellations.byStage.map(s => (
            <div key={s.stage} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #e5eeff', fontSize: 12, color: '#4f6073' }}>
              <span>{{ before_acceptance: 'Before a driver accepted', after_acceptance: 'After acceptance, before start', after_start: 'After the ride started' }[s.stage]}</span>
              <span style={{ fontWeight: 700, color: '#0b1c30' }}>{s.count}</span>
            </div>
          ))}
        </ReportCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
        <ReportCard title="Subscription Mix" subtitle="Active + grace-period, by plan">
          {report.subscriptionMix.map(s => (
            <div key={s.plan} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #e5eeff', textTransform: 'capitalize', fontSize: 13, color: '#0b1c30' }}>
              <span>{s.plan}</span><span style={{ fontWeight: 700 }}>{s.count}</span>
            </div>
          ))}
        </ReportCard>

        <ReportCard title="EV Fleet Mix" subtitle="100% EV by design — auto vs. car split">
          {report.evFleetMix.map(v => (
            <div key={v.type} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #e5eeff', fontSize: 13, color: '#0b1c30' }}>
              <span>{v.type === 'ev_auto' ? 'EV Auto' : 'EV Car'}</span><span style={{ fontWeight: 700 }}>{v.count}</span>
            </div>
          ))}
        </ReportCard>

        <ReportCard title="Advertising Performance" subtitle={`${report.advertisingPerformance.acceptanceRate}% acceptance rate`}>
          {report.advertisingPerformance.campaignsByStatus.map(c => (
            <div key={c.status} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #e5eeff', textTransform: 'capitalize', fontSize: 13, color: '#0b1c30' }}>
              <span>{c.status}</span><span style={{ fontWeight: 700 }}>{c.count}</span>
            </div>
          ))}
          <p style={{ fontSize: 12, color: '#4f6073', marginTop: 10 }}>₹{report.advertisingPerformance.totalCredited.toLocaleString('en-IN')} credited across {report.advertisingPerformance.totalAssignments} assignments</p>
        </ReportCard>
      </div>
    </>
  )
}

const NAV = [
  { icon: 'analytics',  label: 'Analytics', active: true },
  { icon: 'payments',   label: 'Pricing' },
  { icon: 'loyalty',    label: 'Subscription' },
  { icon: 'shield',     label: 'Safety' },
  { icon: 'ads_click',  label: 'Ads' },
  { icon: 'assessment', label: 'Reports' },
]

export default function AdminDashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [viewingDriver, setViewingDriver] = useState(null)
  const [adminName, setAdminName] = useState('Admin')
  const [activeNav, setActiveNav] = useState('Analytics')

  useEffect(() => {
    if (!user) return
    supabase.from('users').select('name').eq('id', user.id).single()
      .then(({ data }) => { if (data?.name) setAdminName(data.name) })
  }, [user])

  async function fetchDrivers() {
    setLoading(true)
    const { data } = await supabase
      .from('driver_profiles')
      .select('*, vehicles(*), users(name, email, phone)')
      .order('created_at', { ascending: false })
    setDrivers(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchDrivers() }, [])

  async function approveDriver(id) {
    await supabase.from('driver_profiles').update({ status: 'approved', kyc_status: 'approved' }).eq('id', id)
    fetchDrivers()
  }

  async function rejectDriver(id) {
    await supabase.from('driver_profiles').update({ status: 'rejected', kyc_status: 'rejected' }).eq('id', id)
    fetchDrivers()
  }

  async function suspendDriver(id) {
    await supabase.from('driver_profiles').update({ status: 'suspended' }).eq('id', id)
    fetchDrivers()
  }

  async function reactivateDriver(id) {
    await supabase.from('driver_profiles').update({ status: 'approved' }).eq('id', id)
    fetchDrivers()
  }

  const [platformStats, setPlatformStats] = useState(null)
  const [campaignSummary, setCampaignSummary] = useState([])

  useEffect(() => {
    async function loadStats() {
      const data = await fetchPlatformData()
      const monthly = summarizeReports(data, 'Monthly')
      const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
      const ridesToday = data.rides.filter(r => new Date(r.created_at) >= startOfToday).length
      const { count: riderCount } = await supabase
        .from('users').select('id', { count: 'exact', head: true }).eq('role', 'rider')
      setPlatformStats({
        evAuto: monthly.evFleetMix.find(v => v.type === 'ev_auto')?.count ?? 0,
        evCar: monthly.evFleetMix.find(v => v.type === 'ev_car')?.count ?? 0,
        ridesToday,
        riders: riderCount ?? 0,
        monthlyRevenue: monthly.revenue.buckets[monthly.revenue.buckets.length - 1]?.total ?? 0,
        revenueTrend: monthly.revenue.buckets,
      })
      const campaigns = await fetchCampaigns()
      setCampaignSummary(campaigns.slice(0, 2))
    }
    loadStats()
  }, [])

  const pendingDrivers = drivers.filter(d => d.kyc_status === 'submitted' || d.kyc_status === 'pending')
  const manageableDrivers = drivers.filter(d => d.status === 'approved' || d.status === 'suspended')
  const activeDriverCount = drivers.filter(d => d.status === 'approved' && d.is_online).length
  const filteredDrivers = pendingDrivers.filter(d => {
    const name = d.users?.name ?? ''
    const email = d.users?.email ?? ''
    return name.toLowerCase().includes(search.toLowerCase()) || email.toLowerCase().includes(search.toLowerCase())
  })

  const totalApproved = drivers.filter(d => d.status === 'approved').length

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: '#f8f9ff', fontFamily: "'Geist', sans-serif" }}>
      {/* Sidebar */}
      <aside style={{
        position: 'fixed', inset: '0 auto 0 0', zIndex: 60,
        display: 'flex', flexDirection: 'column',
        padding: 16, background: 'white',
        width: 280, borderRadius: '0 16px 16px 0',
        boxShadow: '4px 0 24px rgba(26,43,60,0.08)'
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, padding: '0 12px' }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: '#006d37' }}>Drivo</span>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', background: '#2ecc71', color: '#005027', padding: '2px 10px', borderRadius: 9999 }}>Admin</span>
        </div>

        {/* Profile chip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, padding: '12px', background: '#eff4ff', borderRadius: 12 }}>
          <Avatar name={adminName} size={44} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#0b1c30' }}>{adminName}</p>
            <p style={{ fontSize: 11, color: '#4f6073', marginTop: 1 }}>Admin Dashboard</p>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(item => {
            const isActive = activeNav === item.label
            return (
              <a key={item.label} onClick={() => setActiveNav(item.label)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px',
                  borderRadius: 10, cursor: 'pointer', textDecoration: 'none',
                  background: isActive ? '#d2e4fb' : 'transparent',
                  color: isActive ? '#0b1c30' : '#3d4a3e',
                  fontWeight: isActive ? 700 : 400,
                  transform: isActive ? 'translateX(3px)' : 'none',
                  transition: 'all 0.15s',
                }}>
                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>{item.icon}</span>
                <span style={{ fontSize: 15 }}>{item.label}</span>
              </a>
            )
          })}
        </nav>

        {/* Sign out */}
        <div style={{ paddingTop: 16 }}>
          <button onClick={handleSignOut} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 10, padding: '12px 16px', borderRadius: 12, border: 'none',
            background: '#213145', color: '#eaf1ff', fontSize: 14, fontWeight: 600,
            cursor: 'pointer'
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>logout</span>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ marginLeft: 280, flex: 1, padding: 32, minHeight: '100dvh' }}>

        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.01em', color: '#0b1c30', margin: 0 }}>System Overview</h1>
            <p style={{ fontSize: 15, color: '#4f6073', marginTop: 4 }}>Real-time performance metrics and operations.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'white', boxShadow: '0 1px 4px rgba(26,43,60,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#0b1c30' }}>notifications</span>
              <span style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, background: '#ba1a1a', borderRadius: '50%' }} />
            </button>
            <div style={{ width: 1, height: 36, background: '#bbcbbb', margin: '0 4px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: '#3d4a3e' }}>{today}</span>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#4f6073' }}>calendar_today</span>
            </div>
          </div>
        </header>

        {activeNav === 'Pricing' ? (
          <PricingAdminPanel />
        ) : activeNav === 'Subscription' ? (
          <SubscriptionAdminPanel />
        ) : activeNav === 'Safety' ? (
          <SafetyAdminPanel />
        ) : activeNav === 'Ads' ? (
          <AdsAdminPanel />
        ) : activeNav === 'Reports' ? (
          <ReportsAdminPanel />
        ) : (
        <>
        {/* KPI Cards */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20, marginBottom: 28 }}>
          {[
            { icon: 'person_pin_circle', label: 'Active Drivers',  value: totalApproved },
            { icon: 'groups',            label: 'Riders',          value: platformStats ? platformStats.riders.toLocaleString('en-IN') : '…' },
            { icon: 'wifi_tethering',    label: 'Online Now',      value: activeDriverCount },
            { icon: 'electric_car',      label: 'EV Fleet Mix',    value: platformStats ? `${platformStats.evAuto} Auto · ${platformStats.evCar} Car` : '…' },
            { icon: 'account_balance_wallet', label: 'Revenue This Month', value: platformStats ? `₹${platformStats.monthlyRevenue.toLocaleString('en-IN')}` : '…' },
          ].map(card => (
            <div key={card.label} style={{
              background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)',
              border: '1px solid #f1f5f9', borderRadius: 18, padding: 24,
              boxShadow: '0 4px 20px rgba(26,43,60,0.05)', display: 'flex', flexDirection: 'column', gap: 12,
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 30px rgba(26,43,60,0.12)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(26,43,60,0.05)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ padding: 10, background: card.iconBg, borderRadius: 12 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 22, color: card.iconColor }}>{card.icon}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#006d37' }}>{card.badge}</span>
              </div>
              <div>
                <p style={{ fontSize: 13, color: '#4f6073', marginBottom: 4 }}>{card.label}</p>
                <h3 style={{ fontSize: 32, fontWeight: 600, color: '#0b1c30', letterSpacing: '-0.01em', margin: 0 }}>{card.value}</h3>
              </div>
              {card.progress && (
                <div style={{ height: 6, background: '#e5eeff', borderRadius: 9999 }}>
                  <div style={{ width: `${card.progress}%`, height: '100%', background: '#006d37', borderRadius: 9999 }} />
                </div>
              )}
            </div>
          ))}
        </section>

        {/* Charts row */}
        <section style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 28 }}>
          {/* Revenue Growth */}
          <div style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid #f1f5f9', borderRadius: 18, padding: 24, boxShadow: '0 2px 8px rgba(26,43,60,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0b1c30', margin: 0 }}>Revenue Growth</h2>
              <div style={{ display: 'flex', gap: 14 }}>
                {[{ color: '#006d37', label: 'Subscription' }, { color: '#4f6073', label: 'Ads' }].map(l => (
                  <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#3d4a3e' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: l.color, flexShrink: 0 }} />{l.label}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ height: 200, display: 'flex', alignItems: 'flex-end', gap: 16, paddingBottom: 24, position: 'relative' }}>
              {(() => {
                const bars = platformStats?.revenueTrend ?? []
                const max = Math.max(1, ...bars.map(b => b.total))
                return bars.map(bar => (
                  <div key={bar.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%' }}>
                    <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', gap: 3 }}>
                      <div style={{ flex: 1, height: `${(bar.subscriptionRevenue / max) * 100}%`, background: '#006d37', borderRadius: '4px 4px 0 0', transition: 'height 0.3s' }} />
                      <div style={{ flex: 1, height: `${(bar.adRevenue / max) * 100}%`, background: '#4f6073', borderRadius: '4px 4px 0 0', transition: 'height 0.3s' }} />
                    </div>
                    <span style={{ fontSize: 12, color: '#4f6073', fontWeight: 500 }}>{bar.label}</span>
                  </div>
                ))
              })()}
            </div>
          </div>

          {/* Manage Ads */}
          <div style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid #f1f5f9', borderRadius: 18, padding: 24, boxShadow: '0 2px 8px rgba(26,43,60,0.05)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0b1c30', margin: 0 }}>Manage Ads</h2>
              <button onClick={() => setActiveNav('Ads')} style={{ fontSize: 13, fontWeight: 600, color: '#006d37', background: 'none', border: 'none', cursor: 'pointer' }}>View All</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
              {campaignSummary.length === 0 && (
                <p style={{ fontSize: 13, color: '#4f6073' }}>No campaigns yet.</p>
              )}
              {campaignSummary.map(ad => (
                <div key={ad.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#e5eeff', borderRadius: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, background: 'white', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#4f6073' }}>brand_awareness</span>
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#0b1c30', margin: 0 }}>{ad.title}</p>
                      <p style={{ fontSize: 11, color: '#4f6073', margin: 0, textTransform: 'capitalize' }}>{ad.status} · {ad.assignedCount} assigned</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setActiveNav('Ads')} style={{
              marginTop: 16, padding: '12px 0', border: '2px dashed #bbcbbb', borderRadius: 12,
              background: 'none', color: '#4f6073', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'border-color 0.15s, color 0.15s'
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#006d37'; e.currentTarget.style.color = '#006d37' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#bbcbbb'; e.currentTarget.style.color = '#4f6073' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
              Create Campaign
            </button>
          </div>
        </section>

        {/* Driver Approval Table */}
        <section style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid #f1f5f9', borderRadius: 18, boxShadow: '0 2px 8px rgba(26,43,60,0.05)', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #bbcbbb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0b1c30', margin: 0 }}>Approve Drivers</h2>
              <p style={{ fontSize: 12, color: '#4f6073', marginTop: 3 }}>
                Verification pending for {pendingDrivers.length} candidate{pendingDrivers.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ position: 'relative' }}>
                <span className="material-symbols-outlined" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#4f6073' }}>search</span>
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name..."
                  style={{ paddingLeft: 38, paddingRight: 16, height: 38, border: 'none', borderRadius: 8, background: '#eff4ff', fontSize: 13, color: '#0b1c30', outline: 'none', width: 220 }}
                />
              </div>
              <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px', height: 38, background: '#006d37', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>filter_list</span>
                Filters
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#eff4ff' }}>
                  {['Candidate', 'Documents', 'Vehicle Type', 'Requested Date', ''].map(h => (
                    <th key={h} style={{ padding: '12px 24px', textAlign: h === '' ? 'right' : 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: '#4f6073', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#4f6073', fontSize: 14 }}>Loading…</td></tr>
                ) : filteredDrivers.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#4f6073', fontSize: 14 }}>No pending drivers.</td></tr>
                ) : filteredDrivers.map(driver => {
                  const name = driver.users?.name ?? 'Unknown'
                  const email = driver.users?.email ?? ''
                  const vehicle = driver.vehicles?.[0]
                  const vehicleLabel = vehicle ? `${vehicle.make ?? ''} ${vehicle.model ?? ''}`.trim() || vehicle.vehicle_type : '—'
                  const requestedAt = driver.created_at ? new Date(driver.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

                  return (
                    <tr key={driver.id}
                      style={{ borderTop: '1px solid #e5eeff', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8f9ff'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <Avatar name={name} size={40} />
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: '#0b1c30', margin: 0 }}>{name}</p>
                            <p style={{ fontSize: 12, color: '#4f6073', margin: 0 }}>{email}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <DocsBadge status={driver.kyc_status} />
                          <button onClick={() => setViewingDriver(driver)}
                            style={{ fontSize: 12, fontWeight: 700, color: '#006d37', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                            View
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#006d37' }}>bolt</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: '#0b1c30' }}>{vehicleLabel}</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px', fontSize: 13, color: '#4f6073' }}>{requestedAt}</td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                          <button onClick={() => rejectDriver(driver.id)}
                            style={{ padding: '6px 16px', border: '1px solid #6c7b6d', borderRadius: 8, background: 'none', color: '#3d4a3e', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#e5eeff'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                          >Reject</button>
                          <button onClick={() => approveDriver(driver.id)}
                            style={{ padding: '6px 16px', border: 'none', borderRadius: 8, background: '#006d37', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                          >Approve</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Manage Drivers — suspend/reactivate an already-approved driver */}
        <section style={{ marginTop: 28, background: 'rgba(255,255,255,0.85)', border: '1px solid #f1f5f9', borderRadius: 18, boxShadow: '0 2px 8px rgba(26,43,60,0.05)', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #bbcbbb' }}>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0b1c30', margin: 0 }}>Manage Drivers</h2>
            <p style={{ fontSize: 12, color: '#4f6073', marginTop: 3 }}>Suspend an approved driver, or reactivate a suspended one.</p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#eff4ff' }}>
                  {['Driver', 'Status', 'Rating', ''].map(h => (
                    <th key={h} style={{ padding: '12px 24px', textAlign: h === '' ? 'right' : 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: '#4f6073', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {manageableDrivers.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: '#4f6073', fontSize: 14 }}>No approved drivers yet.</td></tr>
                ) : manageableDrivers.map(driver => {
                  const name = driver.users?.name ?? 'Unknown'
                  const isSuspended = driver.status === 'suspended'
                  return (
                    <tr key={driver.id} style={{ borderTop: '1px solid #e5eeff' }}>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <Avatar name={name} size={40} />
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#0b1c30', margin: 0 }}>{name}</p>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: isSuspended ? '#ba1a1a' : '#006d37', background: isSuspended ? 'rgba(186,26,26,0.08)' : 'rgba(46,204,113,0.12)', padding: '3px 10px', borderRadius: 6, textTransform: 'capitalize' }}>
                          {driver.status}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', fontSize: 13, color: '#0b1c30' }}>{driver.rating ?? '—'}</td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        {isSuspended ? (
                          <button onClick={() => reactivateDriver(driver.id)}
                            style={{ padding: '6px 16px', border: 'none', borderRadius: 8, background: '#006d37', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                            Reactivate
                          </button>
                        ) : (
                          <button onClick={() => suspendDriver(driver.id)}
                            style={{ padding: '6px 16px', border: '1px solid #ba1a1a', borderRadius: 8, background: 'none', color: '#ba1a1a', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                            Suspend
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
        </>
        )}
      </main>

      {viewingDriver && (
        <DriverDocumentsPanel driver={viewingDriver} onClose={() => setViewingDriver(null)} />
      )}
    </div>
  )
}
