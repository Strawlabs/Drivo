import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth.jsx'
import { fetchDriverEarnings, summarizeForPeriod, bucketTrend, buildEarningsReportCsv, PERIOD_DAYS } from '@/lib/earnings'
import { HOME_ZONES, validateGoHomeInput, activateGoHome, deactivateGoHome, fetchActiveGoHomeSession, matchGoHomeRide, toLocalDatetimeInputValue } from '@/lib/goHome'

// ── Mock data ──────────────────────────────────────────────────
const DISCOVERY_DRIVERS = [
  { id: 1, name: 'Marcus Thorne',   rating: 4.98, vehicle: 'Tesla Model S',  status: 'available', preferred: true,  avatar: 'MT' },
  { id: 2, name: 'Elena Rodriguez', rating: 4.92, vehicle: 'Lucid Air Pure', status: 'available', preferred: false, eta: '5m', avatar: 'ER' },
  { id: 3, name: 'Sarah Jenkins',   rating: 5.00, vehicle: 'Rivian R1S',     status: 'on_ride',   preferred: true,  avatar: 'SJ' },
  { id: 4, name: 'Arjun Mehta',     rating: 4.87, vehicle: 'BYD Atto 3',    status: 'available', preferred: false, eta: '8m', avatar: 'AM' },
]

const FAMILY_MEMBERS = [
  { id: 1, name: 'Sarah',  relation: 'Daughter', status: 'Last ride: 2 hours ago', safe: true,  location: null,          avatar: 'SA' },
  { id: 2, name: 'Lucas',  relation: 'Son',      status: 'Currently at: Home',      safe: true,  location: 'Home',        avatar: 'LU' },
]

const SCHEDULED_RIDES = [
  { time: '08:30 AM', label: 'Gymnastics Practice', sub: 'Pick up: Lucas · EV Luxury' },
  { time: '05:00 PM', label: 'Family Dinner',        sub: 'Pick up: Sarah · Standard EV' },
]

// ── Shared ─────────────────────────────────────────────────────
function Avatar({ initials, size = 48, bg = 'var(--color-primary)' }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: size * 0.33, flexShrink: 0 }}>
      {initials}
    </div>
  )
}

function StarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="#F59E0B">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  )
}

// ── TAB: Home ───────────────────────────────────────────────────
function HomeTab({ displayName, greeting, isOnline, toggling, onToggle, vehicle, todayEarnings, todayTripsCount, driverRating, preferredRidersCount, subscription, goHomeSession, onOpenGoHome }) {
  return (
    <main className="mx-auto px-5 pb-32" style={{ maxWidth: 480, paddingTop: 24 }}>
      {/* Status Hero */}
      <section className="mb-8 text-center">
        <h1 style={{ fontSize: 40, fontWeight: 700, lineHeight: '48px', letterSpacing: '-0.02em', color: 'var(--color-on-background)', marginBottom: 4 }}>
          {greeting}, {displayName}
        </h1>
        <p style={{ fontSize: 16, color: 'var(--color-secondary)', marginBottom: 24 }}>
          Ready for a green commute today?
        </p>
        <div style={{ background: '#ffffff', borderRadius: 9999, padding: 8, boxShadow: '0px 4px 20px rgba(26,43,60,0.05)', border: isOnline ? '1px solid var(--color-primary)' : '1px solid #f1f5f9', transition: 'border 0.3s ease' }}>
          <button
            onClick={onToggle}
            disabled={toggling}
            className="flex items-center justify-center gap-3 w-full"
            style={{ height: 56, borderRadius: 9999, border: 'none', background: isOnline ? 'var(--color-error)' : 'var(--color-primary)', color: '#ffffff', fontSize: 16, fontWeight: 600, cursor: toggling ? 'not-allowed' : 'pointer', opacity: toggling ? 0.7 : 1, transition: 'background 0.3s ease' }}
          >
            <span style={{ fontSize: 22 }}>⏻</span>
            {toggling ? 'Updating…' : isOnline ? 'Go Offline' : 'Go Online'}
          </button>
        </div>
      </section>

      {/* Stats Bento */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 32 }}>
        <div style={{ gridColumn: 'span 2', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(12px)', border: '1px solid #f1f5f9', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(26,43,60,0.06)', position: 'relative', overflow: 'hidden' }}>
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--color-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Today's Earnings</p>
          <h2 style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-primary)', lineHeight: '48px' }}>₹{todayEarnings.toFixed(2)}</h2>
          <div className="flex items-center gap-1" style={{ marginTop: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-secondary)', letterSpacing: '0.05em' }}>
              {todayTripsCount} {todayTripsCount === 1 ? 'ride' : 'rides'} paid today
            </span>
          </div>
          <div style={{ position: 'absolute', right: -32, bottom: -32, width: 128, height: 128, background: 'rgba(0,109,55,0.05)', borderRadius: '50%', filter: 'blur(24px)' }} />
        </div>
        {[
          { icon: '🚗', label: 'Trips',            value: String(todayTripsCount) },
          { icon: '⭐', label: 'Rating',            value: Number(driverRating).toFixed(2) },
          { icon: '💚', label: 'Preferred Riders',  value: String(preferredRidersCount) },
          { icon: '🎖️', label: 'Subscription',      value: subscription?.subscription_plans?.name
              ? subscription.subscription_plans.name.charAt(0).toUpperCase() + subscription.subscription_plans.name.slice(1)
              : 'None' },
        ].map(({ icon, label, value }) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(12px)', border: '1px solid #f1f5f9', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(26,43,60,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <span style={{ fontSize: 22, marginBottom: 4 }}>{icon}</span>
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--color-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>{label}</p>
            <h3 style={{ fontSize: 24, fontWeight: 600, color: 'var(--color-on-surface)' }}>{value}</h3>
          </div>
        ))}
      </section>

      {/* Quick Actions */}
      <p style={{ fontSize: 14, fontWeight: 500, letterSpacing: '0.08em', color: 'var(--color-secondary)', textTransform: 'uppercase', marginBottom: 12 }}>Quick Actions</p>
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 32 }}>
        {[{ label: 'Go Home', icon: '📍', onClick: onOpenGoHome }, { label: 'Earnings', icon: '💰' }, { label: 'Drivo+', icon: '🎖️' }].map(({ label, icon, onClick }) => (
          <button key={label} onClick={onClick} className="flex flex-col items-center gap-2" style={{ padding: 16, borderRadius: 12, border: 'none', background: 'transparent', cursor: onClick ? 'pointer' : 'default', transition: 'background 0.15s ease', position: 'relative' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-container)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ width: 56, height: 56, background: 'var(--color-secondary-container)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, position: 'relative' }}>
              {icon}
              {label === 'Go Home' && goHomeSession && (
                <span style={{ position: 'absolute', top: -2, right: -2, width: 12, height: 12, borderRadius: '50%', background: 'var(--color-primary)', border: '2px solid white' }} />
              )}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', color: 'var(--color-on-surface)', textAlign: 'center' }}>{label}</span>
          </button>
        ))}
      </section>

      {/* Map */}
      <section style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(12px)', border: '1px solid #f1f5f9', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(26,43,60,0.06)' }}>
        <div className="flex justify-between items-center" style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-on-surface)' }}>Near You</span>
          <span className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', color: 'var(--color-primary)' }}>
            High Demand
            <span style={{ width: 8, height: 8, background: 'var(--color-primary-container)', borderRadius: '50%', display: 'inline-block', animation: 'mapPulse 2s infinite' }} />
          </span>
        </div>
        <div style={{ height: 160, position: 'relative', background: 'linear-gradient(135deg, #e8ecef 0%, #d4dce8 100%)' }}>
          {[20, 40, 60, 80].map(p => <div key={`h${p}`} style={{ position: 'absolute', top: `${p}%`, left: 0, right: 0, height: 1, background: 'rgba(100,116,139,0.2)' }} />)}
          {[15, 30, 50, 65, 80].map(p => <div key={`v${p}`} style={{ position: 'absolute', left: `${p}%`, top: 0, bottom: 0, width: 1, background: 'rgba(100,116,139,0.2)' }} />)}
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 40, height: 40, background: 'var(--color-primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 18, animation: 'carPulse 2s infinite' }}>⚡</div>
        </div>
      </section>
    </main>
  )
}

// ── TAB: Discovery ──────────────────────────────────────────────
function DiscoveryTab() {
  const [filter, setFilter] = useState('EV Auto')
  const filters = ['EV Auto', 'EV Car', 'Distance']

  return (
    <div className="px-5 pt-6 pb-8">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h2 style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-on-surface)' }}>Discovery</h2>
          <p style={{ fontSize: 14, color: 'var(--color-secondary)', marginTop: 2 }}>Find premium EV certified drivers near you</p>
        </div>
        <div className="flex gap-2">
          {['List', 'Map'].map(v => (
            <button key={v} style={{ padding: '6px 14px', borderRadius: 9999, border: 'none', background: v === 'List' ? 'var(--color-primary)' : 'var(--color-surface-container)', color: v === 'List' ? 'white' : 'var(--color-on-surface)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{v}</button>
          ))}
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-6 mt-4" style={{ overflowX: 'auto', scrollbarWidth: 'none' }}>
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 16px', borderRadius: 9999, border: `1px solid ${filter === f ? 'var(--color-primary)' : 'var(--color-outline-variant)'}`, background: filter === f ? 'rgba(0,109,55,0.08)' : 'white', color: filter === f ? 'var(--color-primary)' : 'var(--color-on-surface)', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {f === 'EV Auto' ? '🛺 ' : f === 'EV Car' ? '🚗 ' : '📍 '}{f}
          </button>
        ))}
      </div>

      {/* Driver list */}
      <div className="flex flex-col gap-3 mb-6">
        {DISCOVERY_DRIVERS.map(driver => (
          <div key={driver.id} style={{ background: 'white', borderRadius: 16, padding: 16, boxShadow: '0 1px 6px rgba(26,43,60,0.07)', border: '1px solid rgba(187,203,187,0.3)' }}>
            <div className="flex items-center gap-3 mb-3">
              <Avatar initials={driver.avatar} size={52} />
              <div style={{ flex: 1 }}>
                <div className="flex items-center gap-2">
                  <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-on-surface)' }}>{driver.name}</p>
                  {driver.preferred && (
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--color-primary)', background: 'rgba(0,109,55,0.1)', padding: '2px 7px', borderRadius: 9999 }}>PREFERRED</span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <StarIcon />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-on-surface)' }}>{driver.rating}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-secondary)' }}>· {driver.vehicle}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: driver.status === 'available' ? 'var(--color-primary)' : '#F59E0B', display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--color-secondary)' }}>
                    {driver.status === 'available' ? (driver.eta ? `Available in ${driver.eta}` : 'Available Now') : 'Currently on ride'}
                  </span>
                </div>
              </div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--color-secondary)' }}>♡</button>
            </div>
            <div className="flex gap-2">
              <button style={{ flex: 1, height: 40, background: 'white', border: '1px solid var(--color-outline-variant)', borderRadius: 9999, fontSize: 13, fontWeight: 600, color: 'var(--color-on-surface)', cursor: 'pointer' }}>View Profile</button>
              <button disabled={driver.status === 'on_ride'} style={{ flex: 1, height: 40, background: driver.status === 'on_ride' ? 'var(--color-surface-container)' : 'var(--color-on-surface)', border: 'none', borderRadius: 9999, fontSize: 13, fontWeight: 600, color: driver.status === 'on_ride' ? 'var(--color-secondary)' : 'white', cursor: driver.status === 'on_ride' ? 'default' : 'pointer' }}>
                {driver.status === 'on_ride' ? 'On Ride' : 'Request Ride'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Drivo Guarantee */}
      <div style={{ background: 'rgba(0,109,55,0.06)', border: '1px solid rgba(0,109,55,0.2)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
        <div className="flex items-center gap-2 mb-2">
          <span style={{ fontSize: 18 }}>🛡️</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '0.05em' }}>DRIVO GUARANTEE</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--color-on-surface-variant)', lineHeight: '20px' }}>Every driver in the Drivo network is 100% EV certified and undergoes rigorous hospitality training for a premium experience.</p>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {[{ value: '1.2k', label: 'kg CO₂ Saved Today', icon: '🌿' }, { value: '142', label: 'Active EV', icon: '⚡' }].map(({ value, label, icon }) => (
          <div key={label} style={{ background: 'white', borderRadius: 14, padding: 16, boxShadow: '0 1px 4px rgba(26,43,60,0.06)', textAlign: 'center' }}>
            <span style={{ fontSize: 22 }}>{icon}</span>
            <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-on-surface)', marginTop: 4 }}>{value}</p>
            <p style={{ fontSize: 11, color: 'var(--color-secondary)', marginTop: 2 }}>{label}</p>
          </div>
        ))}
      </div>

      <button style={{ width: '100%', height: 50, background: 'var(--color-on-surface)', color: 'white', borderRadius: 9999, border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        🗺️ Explore Map View
      </button>
    </div>
  )
}

// ── TAB: Rides (Performance Insights) ──────────────────────────
const PERIOD_LABEL = { Daily: "TODAY'S TOTAL", Weekly: "THIS WEEK'S TOTAL", Monthly: "THIS MONTH'S TOTAL" }

function RidesTab({ driverProfileId }) {
  const [period, setPeriod] = useState('Daily')
  const [earningsData, setEarningsData] = useState(null)

  useEffect(() => {
    if (!driverProfileId) return
    fetchDriverEarnings(driverProfileId).then(setEarningsData)
  }, [driverProfileId])

  const summary = earningsData ? summarizeForPeriod(earningsData, period) : null
  const bars = earningsData ? bucketTrend(earningsData, period) : []
  const maxBar = Math.max(1, ...bars.map(b => b.value))
  const recentTrips = earningsData ? earningsData.payments.slice(0, 10) : []
  const pct = (n) => (summary && summary.total > 0 ? Math.round((n / summary.total) * 100) : 0)

  function handleDownloadReport() {
    if (!summary) return
    const csv = buildEarningsReportCsv(summary.periodPayments, period)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `drivo-earnings-${period.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="px-5 pt-6 pb-8">
      <h2 style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: 4 }}>Performance Insights</h2>
      <p style={{ fontSize: 14, color: 'var(--color-secondary)', marginBottom: 20 }}>Monitor your sustainable growth and premium earnings.</p>

      {/* Period toggle */}
      <div className="flex gap-2 mb-6" style={{ background: 'var(--color-surface-container-low)', borderRadius: 9999, padding: 4, display: 'inline-flex' }}>
        {['Daily', 'Weekly', 'Monthly'].map(p => (
          <button key={p} onClick={() => setPeriod(p)} style={{ padding: '6px 18px', borderRadius: 9999, border: 'none', background: period === p ? 'white' : 'transparent', color: period === p ? 'var(--color-on-surface)' : 'var(--color-secondary)', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: period === p ? '0 1px 4px rgba(26,43,60,0.1)' : 'none', transition: 'all 0.2s' }}>{p}</button>
        ))}
      </div>

      {/* Earnings card with chart */}
      <div style={{ background: 'white', borderRadius: 20, padding: 20, boxShadow: '0 2px 12px rgba(26,43,60,0.08)', marginBottom: 16 }}>
        <div className="flex justify-between items-start mb-1">
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--color-primary)', background: 'rgba(0,109,55,0.1)', padding: '2px 8px', borderRadius: 9999 }}>{PERIOD_LABEL[period]}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-secondary)' }}>{summary?.tripCount ?? 0} rides</span>
        </div>
        <h2 style={{ fontSize: 40, fontWeight: 700, color: 'var(--color-on-surface)', letterSpacing: '-0.02em', margin: '8px 0 20px' }}>₹{(summary?.total ?? 0).toFixed(2)}</h2>
        {/* Bar chart */}
        <div className="flex items-end justify-between gap-1.5" style={{ height: 80, marginBottom: 8 }}>
          {bars.map((b, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
              <div style={{ width: '100%', height: `${Math.max(4, (b.value / maxBar) * 100)}%`, background: i === bars.length - 1 ? 'var(--color-primary)' : 'var(--color-surface-container)', borderRadius: '4px 4px 0 0', transition: 'height 0.3s' }} />
            </div>
          ))}
        </div>
        <div className="flex justify-between">
          {bars.map((b, i) => <span key={i} style={{ fontSize: 10, color: 'var(--color-secondary)', flex: 1, textAlign: 'center' }}>{b.label}</span>)}
        </div>
        <button onClick={handleDownloadReport} disabled={!summary}
          style={{ width: '100%', height: 40, marginTop: 16, background: 'var(--color-surface-container-low)', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, color: 'var(--color-primary)', cursor: summary ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
          Download {period} Earnings Report (CSV)
        </button>
      </div>

      {/* Digital Ad Revenue */}
      <div style={{ background: 'white', borderRadius: 16, padding: 16, boxShadow: '0 1px 6px rgba(26,43,60,0.06)', marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, background: 'var(--color-surface-container)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 8 }}>📡</div>
        <p style={{ fontSize: 13, color: 'var(--color-secondary)', marginBottom: 2 }}>Digital Ad Revenue</p>
        <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: 4 }}>₹{(summary?.adRevenue ?? 0).toFixed(2)}</p>
        <p style={{ fontSize: 12, color: 'var(--color-secondary)' }}>
          {summary?.adRevenue ? 'From active ad campaign assignments' : 'No ad campaigns assigned yet'}
        </p>
      </div>

      {/* Preferred Rider Earnings */}
      <div style={{ background: 'white', borderRadius: 16, padding: 16, boxShadow: '0 1px 6px rgba(26,43,60,0.06)', marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, background: 'var(--color-surface-container)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 8 }}>💚</div>
        <p style={{ fontSize: 13, color: 'var(--color-secondary)', marginBottom: 2 }}>Preferred Rider Earnings</p>
        <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: 10 }}>₹{(summary?.preferredRiderRides ?? 0).toFixed(2)}</p>
        <div style={{ background: 'rgba(0,109,55,0.07)', border: '1px solid rgba(0,109,55,0.2)', borderRadius: 10, padding: '8px 12px', fontSize: 13, color: 'var(--color-primary)', fontWeight: 600 }}>
          🎯 {earningsData?.preferredRiderIds.size ?? 0} riders have you as preferred
        </div>
      </div>

      {/* Revenue Breakdown */}
      <div style={{ background: 'white', borderRadius: 16, padding: 16, boxShadow: '0 1px 6px rgba(26,43,60,0.06)', marginBottom: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--color-secondary)', textTransform: 'uppercase', marginBottom: 14 }}>Revenue Breakdown</p>
        {[
          { label: 'Ride Payments',          amount: summary?.ridePayments ?? 0 },
          { label: 'Preferred Rider Rides',  amount: summary?.preferredRiderRides ?? 0 },
          { label: 'Ad Revenue',             amount: summary?.adRevenue ?? 0 },
        ].map(({ label, amount }) => (
          <div key={label} style={{ marginBottom: 14 }}>
            <div className="flex justify-between mb-1">
              <span style={{ fontSize: 14, color: 'var(--color-on-surface)' }}>{label}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-on-surface)' }}>₹{amount.toFixed(2)}</span>
            </div>
            <div style={{ height: 6, borderRadius: 9999, background: 'var(--color-surface-container)', overflow: 'hidden' }}>
              <div style={{ width: `${pct(amount)}%`, height: '100%', background: 'var(--color-primary)', borderRadius: 9999 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Ride History */}
      <div style={{ background: 'white', borderRadius: 16, padding: 16, boxShadow: '0 1px 6px rgba(26,43,60,0.06)' }}>
        <div className="flex justify-between items-center mb-4">
          <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-on-surface)' }}>Recent Completed Trips</p>
        </div>
        {recentTrips.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--color-secondary)', padding: '12px 0' }}>No completed, paid trips yet.</p>
        )}
        {recentTrips.length > 0 && (
          <div className="flex justify-between mb-3" style={{ paddingBottom: 8, borderBottom: '1px solid var(--color-outline-variant)' }}>
            {['TIME', 'RIDER', 'DISTANCE', 'FARE'].map(h => <span key={h} style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--color-secondary)' }}>{h}</span>)}
          </div>
        )}
        {recentTrips.map((p, i) => (
          <div key={p.id} className="flex justify-between items-center" style={{ paddingTop: 12, paddingBottom: 12, borderBottom: i < recentTrips.length - 1 ? '1px solid var(--color-outline-variant)' : 'none' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-on-surface)', minWidth: 44 }}>
              {p.paidAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <div className="flex items-center gap-2">
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-surface-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>👤</div>
              <span style={{ fontSize: 13, color: 'var(--color-on-surface)' }}>{p.users?.name ?? 'Rider'}</span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--color-secondary)' }}>{p.rides?.distance_km ? `${p.rides.distance_km} km` : '—'}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary)' }}>₹{Number(p.amount).toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── TAB: Family ─────────────────────────────────────────────────
function FamilyTab() {
  return (
    <div className="pb-8">
      <div className="px-5 pt-6 mb-6">
        <h2 style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: 4 }}>Family Dashboard</h2>
        <p style={{ fontSize: 14, color: 'var(--color-secondary)', marginBottom: 16 }}>Keep your loved ones safe and coordinated.</p>
        <button style={{ width: '100%', height: 48, background: 'var(--color-primary)', color: 'white', borderRadius: 9999, border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          👥 Add Family Member
        </button>
      </div>

      {/* Live ride map */}
      <div style={{ position: 'relative', height: 180, background: 'linear-gradient(135deg, #0f1923 0%, #1a2b1a 50%, #0b1c30 100%)', marginBottom: 20 }}>
        {[20, 40, 60, 80].map(p => <div key={p} style={{ position: 'absolute', top: `${p}%`, left: 0, right: 0, height: 1, background: 'rgba(46,204,113,0.1)' }} />)}
        {[20, 40, 60, 80].map(p => <div key={p} style={{ position: 'absolute', left: `${p}%`, top: 0, bottom: 0, width: 1, background: 'rgba(46,204,113,0.1)' }} />)}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 360 180" preserveAspectRatio="none">
          <path d="M60 140 Q120 80 200 90 Q260 100 300 50" stroke="#2ecc71" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7"/>
          <circle cx="60" cy="140" r="5" fill="#2ecc71"/>
          <circle cx="300" cy="50" r="6" fill="#4ae183"/>
          <circle cx="300" cy="50" r="12" fill="none" stroke="#4ae183" strokeWidth="1.5" opacity="0.4"/>
        </svg>
        {/* Live chip */}
        <div style={{ position: 'absolute', top: 12, left: 12, background: 'var(--color-primary)', color: 'white', borderRadius: 9999, padding: '4px 10px', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'white', display: 'inline-block', animation: 'livePulse 2s infinite' }} />
          Live Now: Sarah's Ride
        </div>
        {/* Destination */}
        <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>Destination</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>Highland Academy</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>Arrival</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-primary)' }}>4:12 PM</p>
          </div>
        </div>
      </div>

      <div className="px-5">
        {/* Family members */}
        <div className="flex flex-col gap-3 mb-6">
          {FAMILY_MEMBERS.map(member => (
            <div key={member.id} style={{ background: 'white', borderRadius: 16, padding: 16, boxShadow: '0 1px 6px rgba(26,43,60,0.06)', border: '1px solid rgba(187,203,187,0.3)' }}>
              <div className="flex items-center gap-3">
                <div style={{ position: 'relative' }}>
                  <Avatar initials={member.avatar} size={48} bg={member.id === 1 ? 'var(--color-primary)' : '#6366F1'} />
                  {member.safe && (
                    <div style={{ position: 'absolute', bottom: 0, right: 0, width: 16, height: 16, borderRadius: '50%', background: 'var(--color-primary)', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="flex justify-between items-center">
                    <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-on-surface)' }}>{member.name}</p>
                    <span style={{ fontSize: 18 }}>🛡️</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 2 }}>{member.relation}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span style={{ fontSize: 12 }}>📍</span>
                    <span style={{ fontSize: 12, color: 'var(--color-secondary)' }}>{member.status}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Safety Net */}
        <div style={{ background: 'white', borderRadius: 16, padding: 16, boxShadow: '0 1px 6px rgba(26,43,60,0.06)', marginBottom: 20 }}>
          <div className="flex justify-between items-center mb-4">
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-on-surface)' }}>Safety Net</p>
            <span style={{ fontSize: 20 }}>📡</span>
          </div>
          {[
            { initials: 'EM', name: 'Emma (Partner)', sub: '+1 (555) 012-3456', action: '📞', bg: '#8B5CF6' },
            { initials: 'DS', name: 'Drivo Support',  sub: 'Emergency 24/7',   action: '🛡️', bg: 'var(--color-primary)' },
          ].map(({ initials, name, sub, action, bg }) => (
            <div key={name} className="flex items-center gap-3 mb-3">
              <Avatar initials={initials} size={40} bg={bg} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-on-surface)' }}>{name}</p>
                <p style={{ fontSize: 12, color: 'var(--color-secondary)' }}>{sub}</p>
              </div>
              <span style={{ fontSize: 22, cursor: 'pointer' }}>{action}</span>
            </div>
          ))}
          <button style={{ width: '100%', height: 40, background: 'none', border: '1.5px dashed var(--color-outline-variant)', borderRadius: 10, fontSize: 13, fontWeight: 600, color: 'var(--color-secondary)', cursor: 'pointer', marginTop: 4 }}>
            + Edit Contacts
          </button>
        </div>

        {/* Scheduled rides */}
        <div style={{ background: 'var(--color-on-surface)', borderRadius: 16, padding: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>Scheduled for Tomorrow</p>
          {SCHEDULED_RIDES.map(({ time, label, sub }, i) => (
            <div key={i} className="flex gap-4" style={{ marginBottom: i < SCHEDULED_RIDES.length - 1 ? 16 : 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid var(--color-primary)', background: 'transparent', flexShrink: 0 }} />
                {i < SCHEDULED_RIDES.length - 1 && <div style={{ width: 2, height: 32, background: 'rgba(255,255,255,0.15)' }} />}
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>{time}</p>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 1 }}>{label}</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Go Home Mode ─────────────────────────────────────────────────
function GoHomeModal({ session, driverProfileId, onClose, onActivated, onDeactivated }) {
  const [zoneName, setZoneName] = useState(session?.preferred_route?.zone_name ?? HOME_ZONES[0].name)
  const [radiusKm, setRadiusKm] = useState(session?.home_zone_radius_km ?? 3)
  const [endTime, setEndTime] = useState(() => {
    if (session?.end_time) return toLocalDatetimeInputValue(new Date(session.end_time))
    return toLocalDatetimeInputValue(new Date(Date.now() + 2 * 60 * 60 * 1000))
  })
  const [note, setNote] = useState(session?.preferred_route?.note ?? '')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!session) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [session])

  async function handleActivate() {
    setError(null)
    const validationError = validateGoHomeInput({ zoneName, radiusKm: Number(radiusKm), endTime })
    if (validationError) { setError(validationError); return }
    setBusy(true)
    try {
      const newSession = await activateGoHome({ driverId: driverProfileId, zoneName, radiusKm: Number(radiusKm), endTime, note })
      onActivated(newSession)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDeactivate() {
    setBusy(true)
    try {
      await deactivateGoHome(session.id, 'cancelled')
      onDeactivated()
    } finally {
      setBusy(false)
    }
  }

  const msLeft = session ? new Date(session.end_time).getTime() - now : 0
  const minsLeft = Math.max(0, Math.floor(msLeft / 60000))
  const hoursLeft = Math.floor(minsLeft / 60)

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(11,28,48,0.6)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201, background: 'var(--color-surface)', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: '20px 20px 40px', boxShadow: '0 -10px 40px rgba(26,43,60,0.2)', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, background: 'var(--color-outline-variant)', borderRadius: 2, margin: '0 auto 20px' }} />
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-on-surface)' }}>📍 Go Home Mode</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--color-secondary)' }}>✕</button>
        </div>

        {session ? (
          <div className="flex flex-col gap-4">
            <div style={{ background: 'rgba(0,109,55,0.08)', border: '1px solid rgba(0,109,55,0.25)', borderRadius: 14, padding: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 4 }}>ACTIVE — heading toward {session.preferred_route?.zone_name}</p>
              <p style={{ fontSize: 13, color: 'var(--color-on-surface)' }}>Radius: {session.home_zone_radius_km} km · Ends in {hoursLeft > 0 ? `${hoursLeft}h ` : ''}{minsLeft % 60}m</p>
              {session.preferred_route?.note && <p style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 6 }}>Note: {session.preferred_route.note}</p>}
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-secondary)' }}>
              You'll get priority alerts for ride requests heading toward this area. Requests that aren't on your way home won't be shown while this is active.
            </p>
            <button onClick={handleDeactivate} disabled={busy}
              style={{ width: '100%', height: 48, background: 'var(--color-error-container)', color: 'var(--color-error)', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              {busy ? 'Ending…' : 'End Go Home Mode'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {error && (
              <p style={{ fontSize: 13, color: 'var(--color-error)', background: 'var(--color-error-container)', borderRadius: 10, padding: '8px 12px' }}>{error}</p>
            )}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-on-surface)' }}>Home area</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                {HOME_ZONES.map(z => (
                  <button key={z.name} onClick={() => setZoneName(z.name)}
                    style={{ height: 40, borderRadius: 10, border: `2px solid ${zoneName === z.name ? 'var(--color-primary)' : 'var(--color-outline-variant)'}`, background: zoneName === z.name ? 'rgba(0,109,55,0.08)' : 'none', color: 'var(--color-on-surface)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {z.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-on-surface)' }}>Radius (km)</label>
              <input type="number" min={1} max={15} value={radiusKm} onChange={e => setRadiusKm(e.target.value)}
                style={{ width: '100%', height: 44, borderRadius: 10, border: '1px solid var(--color-outline-variant)', padding: '0 12px', fontSize: 14, marginTop: 6 }} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-on-surface)' }}>End time</label>
              <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)}
                style={{ width: '100%', height: 44, borderRadius: 10, border: '1px solid var(--color-outline-variant)', padding: '0 12px', fontSize: 14, marginTop: 6 }} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-on-surface)' }}>Preferred route note (optional)</label>
              <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. via Outer Ring Road"
                style={{ width: '100%', height: 44, borderRadius: 10, border: '1px solid var(--color-outline-variant)', padding: '0 12px', fontSize: 14, marginTop: 6 }} />
            </div>
            <button onClick={handleActivate} disabled={busy}
              style={{ width: '100%', height: 48, background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              {busy ? 'Activating…' : 'Activate Go Home Mode'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// ── Incoming Ride Request Modal ─────────────────────────────────
function RideRequestModal({ ride, onAccept, onReject, goHomeMatch }) {
  const [countdown, setCountdown] = useState(30)
  useEffect(() => {
    const t = setInterval(() => setCountdown(c => {
      if (c <= 1) { clearInterval(t); onReject(); return 0 }
      return c - 1
    }), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <>
      <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(11,28,48,0.6)', backdropFilter:'blur(4px)' }} />
      <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:201, background:'var(--color-surface)', borderTopLeftRadius:24, borderTopRightRadius:24, padding:'20px 20px 40px', boxShadow:'0 -10px 40px rgba(26,43,60,0.2)' }}>
        <div style={{ width:40, height:4, background:'var(--color-outline-variant)', borderRadius:2, margin:'0 auto 20px' }} />
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontSize:20, fontWeight:700, color:'var(--color-on-surface)' }}>New Ride Request</h3>
          <div style={{ width:44, height:44, borderRadius:'50%', border:`3px solid var(--color-primary)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, color:'var(--color-primary)' }}>{countdown}</div>
        </div>
        {goHomeMatch && (
          <div style={{ background: 'rgba(0,109,55,0.1)', border: '1px solid rgba(0,109,55,0.3)', borderRadius: 12, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>📍</span>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>
              Priority Match — {goHomeMatch.distanceKm} km from home · ₹{ride.estimated_fare} potential earnings
            </p>
          </div>
        )}
        {/* Route */}
        <div className="flex gap-4 items-start mb-5" style={{ background:'var(--color-surface-container-low)', borderRadius:14, padding:'14px 16px' }}>
          <div className="flex flex-col items-center gap-1 pt-1">
            <div style={{ width:10, height:10, borderRadius:'50%', background:'var(--color-primary)', flexShrink:0 }} />
            <div style={{ width:2, height:24, background:'var(--color-outline-variant)' }} />
            <div style={{ width:10, height:10, borderRadius:2, background:'#EF4444', flexShrink:0 }} />
          </div>
          <div className="flex flex-col gap-3 flex-1">
            <div>
              <p style={{ fontSize:11, color:'var(--color-secondary)', fontWeight:600 }}>PICKUP</p>
              <p style={{ fontSize:15, fontWeight:600, color:'var(--color-on-surface)' }}>{ride.pickup_address}</p>
            </div>
            <div>
              <p style={{ fontSize:11, color:'var(--color-secondary)', fontWeight:600 }}>DESTINATION</p>
              <p style={{ fontSize:15, fontWeight:600, color:'var(--color-on-surface)' }}>{ride.destination_address}</p>
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            <p style={{ fontSize:22, fontWeight:700, color:'var(--color-primary)' }}>₹{ride.estimated_fare}</p>
            <p style={{ fontSize:11, color:'var(--color-secondary)' }}>Est. Fare</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onReject} style={{ flex:1, height:52, border:'1px solid var(--color-outline-variant)', background:'none', borderRadius:12, fontSize:15, fontWeight:700, color:'var(--color-on-surface)', cursor:'pointer' }}>
            Reject
          </button>
          <button onClick={onAccept} style={{ flex:2, height:52, background:'var(--color-primary)', color:'white', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            <span className="material-symbols-outlined">check_circle</span>
            Accept Ride
          </button>
        </div>
      </div>
    </>
  )
}

// ── Main Page ───────────────────────────────────────────────────
export default function DriverHomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [isOnline, setIsOnline]     = useState(false)
  const [toggling, setToggling]     = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeNav, setActiveNav]   = useState('home')
  const [vehicle, setVehicle]       = useState(null)
  const [driverProfileId, setDriverProfileId] = useState(null)
  const [incomingRide, setIncomingRide] = useState(null)
  const [activeRide, setActiveRide] = useState(null)
  const [todayEarnings, setTodayEarnings] = useState(0)
  const [todayTripsCount, setTodayTripsCount] = useState(0)
  const [driverRating, setDriverRating] = useState(5.0)
  const [preferredRidersCount, setPreferredRidersCount] = useState(0)
  const [subscription, setSubscription] = useState(null)
  const [goHomeSession, setGoHomeSession] = useState(null)
  const [showGoHomeModal, setShowGoHomeModal] = useState(false)
  const [goHomeMatch, setGoHomeMatch] = useState(null)

  const [displayName, setDisplayName] = useState('Driver')
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'

  useEffect(() => {
    if (!user) return
    async function load() {
      const [vRes, dRes, uRes] = await Promise.all([
        supabase.from('vehicles').select('*').eq('driver_id', user.id).maybeSingle(),
        supabase.from('driver_profiles').select('id, is_online, status, kyc_status, rating').eq('user_id', user.id).maybeSingle(),
        supabase.from('users').select('name').eq('id', user.id).single(),
      ])
      if (vRes.data) setVehicle(vRes.data)
      if (dRes.data) {
        setIsOnline(dRes.data.is_online ?? false)
        setDriverProfileId(dRes.data.id)
        setDriverRating(dRes.data.rating ?? 5.0)
        if (dRes.data.kyc_status !== 'approved') {
          navigate('/driver/verification', { replace: true })
        }
      }
      if (uRes.data?.name) setDisplayName(uRes.data.name.split(' ')[0])
    }
    load()
  }, [user])

  // Listen for new ride requests assigned to this driver
  useEffect(() => {
    if (!driverProfileId || !isOnline) return
    const channel = supabase
      .channel('driver-rides-' + driverProfileId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rides', filter: `driver_id=eq.${driverProfileId}` }, async payload => {
        if (payload.new.status !== 'requested') return
        if (goHomeSession) {
          const match = matchGoHomeRide(payload.new, goHomeSession)
          if (!match.compatible) {
            // Only route-compatible rides are suggested while Go Home Mode is active
            await supabase.from('rides').update({ status: 'expired' }).eq('id', payload.new.id)
            return
          }
          setGoHomeMatch(match)
        } else {
          setGoHomeMatch(null)
        }
        setIncomingRide(payload.new)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [driverProfileId, isOnline, goHomeSession])

  // Today's earnings — completed payments only, refreshed live as riders pay
  useEffect(() => {
    if (!driverProfileId) return

    async function loadEarnings() {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      const { data } = await supabase
        .from('payments')
        .select('amount')
        .eq('driver_id', driverProfileId)
        .eq('status', 'completed')
        .gte('paid_at', startOfDay.toISOString())
      const rows = data ?? []
      setTodayEarnings(rows.reduce((sum, r) => sum + Number(r.amount), 0))
      setTodayTripsCount(rows.length)
    }

    loadEarnings()

    const channel = supabase
      .channel('driver-earnings-' + driverProfileId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `driver_id=eq.${driverProfileId}` }, loadEarnings)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [driverProfileId])

  // Preferred riders — how many riders have saved this driver as preferred
  useEffect(() => {
    if (!driverProfileId) return
    supabase
      .from('preferred_drivers')
      .select('id', { count: 'exact', head: true })
      .eq('driver_id', driverProfileId)
      .eq('status', 'active')
      .then(({ count }) => setPreferredRidersCount(count ?? 0))
  }, [driverProfileId])

  // Subscription status — most recent active plan, if any
  useEffect(() => {
    if (!driverProfileId) return
    supabase
      .from('driver_subscriptions')
      .select('status, expiry_date, subscription_plans(name)')
      .eq('driver_id', driverProfileId)
      .eq('status', 'active')
      .order('expiry_date', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setSubscription(data ?? null))
  }, [driverProfileId])

  // Driver rating updates live as riders submit reviews (see recalculateDriverRating)
  useEffect(() => {
    if (!driverProfileId) return
    const channel = supabase
      .channel('driver-rating-' + driverProfileId)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'driver_profiles', filter: `id=eq.${driverProfileId}` }, payload => {
        if (payload.new.rating != null) setDriverRating(payload.new.rating)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [driverProfileId])

  // Go Home Mode — load any active session, and auto-expire it client-side
  // once end_time passes (no backend cron for this, same as the UPI
  // payment timeout).
  useEffect(() => {
    if (!driverProfileId) return
    fetchActiveGoHomeSession(driverProfileId).then(setGoHomeSession)
  }, [driverProfileId])

  useEffect(() => {
    if (!goHomeSession) return
    const msLeft = new Date(goHomeSession.end_time).getTime() - Date.now()
    if (msLeft <= 0) { setGoHomeSession(null); return }
    const t = setTimeout(async () => {
      await deactivateGoHome(goHomeSession.id, 'expired')
      setGoHomeSession(null)
    }, msLeft)
    return () => clearTimeout(t)
  }, [goHomeSession])

  async function handleAcceptRide() {
    if (!incomingRide || !driverProfileId) return
    const { data: existing } = await supabase
      .from('rides')
      .select('id')
      .eq('driver_id', driverProfileId)
      .in('status', ['accepted', 'active'])
      .maybeSingle()
    if (existing) {
      await supabase.from('rides').update({ status: 'expired' }).eq('id', incomingRide.id)
      setIncomingRide(null)
      return
    }
    await supabase.from('rides').update({ status: 'accepted' }).eq('id', incomingRide.id)
    setActiveRide(incomingRide)
    setIncomingRide(null)
  }

  async function handleRejectRide() {
    if (incomingRide) {
      await supabase.from('rides').update({ status: 'expired' }).eq('id', incomingRide.id)
    }
    setIncomingRide(null)
  }

  async function handleStartRide() {
    if (!activeRide) return
    const startedAt = new Date().toISOString()
    await supabase.from('rides').update({ status: 'active', started_at: startedAt }).eq('id', activeRide.id)
    setActiveRide(r => ({ ...r, status: 'active', started_at: startedAt }))
  }

  async function handleCompleteRide() {
    if (!activeRide) return
    const completedAt = new Date()
    const startedAt = activeRide.started_at ? new Date(activeRide.started_at) : completedAt
    const durationMinutes = Math.max(1, Math.round((completedAt - startedAt) / 60000))
    // No live GPS tracking yet — approximate distance from elapsed time at typical city driving speed.
    const distanceKm = Math.round((durationMinutes / 60) * 20 * 10) / 10
    await supabase.from('rides').update({
      status: 'completed',
      completed_at: completedAt.toISOString(),
      final_fare: activeRide.estimated_fare,
      duration_minutes: durationMinutes,
      distance_km: distanceKm,
    }).eq('id', activeRide.id)
    setActiveRide(null)
  }

  async function handleToggleOnline() {
    setToggling(true)
    const next = !isOnline
    if (user) {
      const { error } = await supabase.from('driver_profiles').update({ is_online: next }).eq('user_id', user.id)
      if (!error) setIsOnline(next)
    } else {
      setIsOnline(next)
    }
    setToggling(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-background)', fontFamily: 'var(--font-sans)', position: 'relative' }}>

      {/* Active ride panel */}
      {activeRide && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:100, background:'var(--color-surface)', borderTopLeftRadius:24, borderTopRightRadius:24, boxShadow:'0 -10px 40px rgba(26,43,60,0.18)', padding:'20px 20px 40px' }}>
          <div style={{ width:40, height:4, background:'var(--color-outline-variant)', borderRadius:2, margin:'0 auto 20px' }} />
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <h3 style={{ fontSize:20, fontWeight:700, color:'var(--color-on-surface)' }}>
              {activeRide.status === 'active' ? 'Ride in Progress' : 'Ride Accepted'}
            </h3>
            <span style={{ background: activeRide.status === 'active' ? 'rgba(0,109,55,0.12)' : 'rgba(245,158,11,0.12)', color: activeRide.status === 'active' ? 'var(--color-primary)' : '#B45309', fontSize:12, fontWeight:700, padding:'4px 12px', borderRadius:9999 }}>
              {activeRide.status === 'active' ? '● EN ROUTE' : '● ACCEPTED'}
            </span>
          </div>
          {/* Route */}
          <div style={{ background:'var(--color-surface-container-low)', borderRadius:14, padding:'14px 16px', marginBottom:20 }}>
            <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, paddingTop:3 }}>
                <div style={{ width:10, height:10, borderRadius:'50%', background:'var(--color-primary)' }} />
                <div style={{ width:2, height:24, background:'var(--color-outline-variant)' }} />
                <div style={{ width:10, height:10, borderRadius:2, background:'#EF4444' }} />
              </div>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:12 }}>
                <div>
                  <p style={{ fontSize:11, color:'var(--color-secondary)', fontWeight:600 }}>PICKUP</p>
                  <p style={{ fontSize:15, fontWeight:600, color:'var(--color-on-surface)' }}>{activeRide.pickup_address}</p>
                </div>
                <div>
                  <p style={{ fontSize:11, color:'var(--color-secondary)', fontWeight:600 }}>DESTINATION</p>
                  <p style={{ fontSize:15, fontWeight:600, color:'var(--color-on-surface)' }}>{activeRide.destination_address}</p>
                </div>
              </div>
              <p style={{ fontSize:22, fontWeight:700, color:'var(--color-primary)' }}>₹{activeRide.estimated_fare}</p>
            </div>
          </div>
          {/* Actions */}
          {activeRide.status !== 'active' ? (
            <button onClick={handleStartRide}
              style={{ width:'100%', height:52, background:'var(--color-primary)', color:'white', border:'none', borderRadius:12, fontSize:16, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:'0 4px 16px rgba(0,109,55,0.25)' }}>
              <span className="material-symbols-outlined">play_arrow</span>
              Start Ride
            </button>
          ) : (
            <button onClick={handleCompleteRide}
              style={{ width:'100%', height:52, background:'var(--color-on-surface)', color:'white', border:'none', borderRadius:12, fontSize:16, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              <span className="material-symbols-outlined">flag</span>
              Complete Ride
            </button>
          )}
        </div>
      )}

      {/* Incoming ride request */}
      {incomingRide && (
        <RideRequestModal
          ride={incomingRide}
          onAccept={handleAcceptRide}
          onReject={handleRejectRide}
          goHomeMatch={goHomeMatch}
        />
      )}

      {/* Go Home Mode */}
      {showGoHomeModal && (
        <GoHomeModal
          session={goHomeSession}
          driverProfileId={driverProfileId}
          onClose={() => setShowGoHomeModal(false)}
          onActivated={session => { setGoHomeSession(session); setShowGoHomeModal(false) }}
          onDeactivated={() => { setGoHomeSession(null); setShowGoHomeModal(false) }}
        />
      )}

      {/* Scrim */}
      {drawerOpen && (
        <div onClick={() => setDrawerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(11,28,48,0.4)', backdropFilter: 'blur(4px)' }} />
      )}

      {/* Side Drawer */}
      <nav style={{ position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 60, width: 300, background: 'var(--color-surface)', boxShadow: '4px 0 24px rgba(26,43,60,0.12)', borderTopRightRadius: 16, borderBottomRightRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)' }}>
        <div style={{ marginBottom: 24 }}>
          <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
            <div className="flex items-center justify-center text-white font-semibold" style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-primary)', fontSize: 20, flexShrink: 0 }}>
              {displayName[0]}
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-primary)' }}>Driver Dashboard</h3>
              <p style={{ fontSize: 14, color: 'var(--color-on-surface-variant)' }}>EV Certified • Premium Tier</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1" style={{ flex: 1 }}>
          {[{ icon: '💰', label: 'Earnings', active: true }, { icon: '📍', label: 'Go Home Mode', onClick: () => { setShowGoHomeModal(true); setDrawerOpen(false) } }, { icon: '📊', label: 'Analytics' }, { icon: '⭐', label: 'Subscription' }, { icon: '📣', label: 'Ads' }, { icon: '⚙️', label: 'Settings' }].map(({ icon, label, active, onClick }) => (
            <button key={label} onClick={onClick} className="flex items-center gap-4 text-left" style={{ padding: '10px 12px', borderRadius: 8, border: 'none', background: active ? 'var(--color-secondary-container)' : 'transparent', color: active ? 'var(--color-on-secondary-container)' : 'var(--color-on-surface-variant)', fontSize: 16, fontWeight: active ? 700 : 400, cursor: onClick ? 'pointer' : 'default' }}>
              <span style={{ fontSize: 18 }}>{icon}</span>{label}
              {label === 'Go Home Mode' && goHomeSession && (
                <span style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', display: 'inline-block' }} />
              )}
            </button>
          ))}
        </div>
        <button onClick={handleSignOut} className="flex items-center gap-3 mt-4" style={{ padding: '10px 12px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--color-error)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          ← Sign out
        </button>
      </nav>

      {/* Top App Bar */}
      <header className="sticky top-0 z-40 flex justify-between items-center w-full px-5 py-2" style={{ background: 'var(--color-surface)', boxShadow: '0 1px 0 var(--color-surface-container-low)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => setDrawerOpen(true)} style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 20 }}>☰</button>
          <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-on-surface)', letterSpacing: '-0.01em' }}>Drivo</span>
        </div>
        <div className="flex items-center gap-3">
          <button style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 20 }}>🔔</button>
          <div className="flex items-center justify-center text-white font-semibold text-sm flex-shrink-0" style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-primary)', border: '2px solid var(--color-primary-container)' }}>
            {displayName[0]}
          </div>
        </div>
      </header>

      {/* Tab Content */}
      <div style={{ paddingBottom: 80 }}>
        {activeNav === 'home'      && <HomeTab displayName={displayName} greeting={greeting} isOnline={isOnline} toggling={toggling} onToggle={handleToggleOnline} vehicle={vehicle} todayEarnings={todayEarnings} todayTripsCount={todayTripsCount} driverRating={driverRating} preferredRidersCount={preferredRidersCount} subscription={subscription} goHomeSession={goHomeSession} onOpenGoHome={() => setShowGoHomeModal(true)} />}
        {activeNav === 'discovery' && <DiscoveryTab />}
        {activeNav === 'rides'     && <RidesTab driverProfileId={driverProfileId} />}
        {activeNav === 'family'    && <FamilyTab />}
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-4 pt-2" style={{ background: 'var(--color-surface)', boxShadow: '0px -4px 20px rgba(26,43,60,0.05)', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
        {[
          { key: 'home',      label: 'Home',      icon: '🏠' },
          { key: 'discovery', label: 'Discovery', icon: '🧭' },
          { key: 'rides',     label: 'Rides',     icon: '🚗' },
          { key: 'family',    label: 'Family',    icon: '👨‍👩‍👧' },
        ].map(({ key, label, icon }) => (
          <button key={key} onClick={() => setActiveNav(key)} className="flex flex-col items-center justify-center" style={{ background: activeNav === key ? 'var(--color-primary-container)' : 'transparent', color: activeNav === key ? 'var(--color-on-primary-container)' : 'var(--color-on-secondary-container)', borderRadius: 9999, padding: activeNav === key ? '4px 16px' : '4px 8px', border: 'none', cursor: 'pointer', transition: 'all 0.2s ease', minWidth: 48 }}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', marginTop: 2 }}>{label}</span>
          </button>
        ))}
      </nav>

      <style>{`
        @keyframes carPulse {
          0%   { box-shadow: 0 0 0 0 rgba(0,109,55,0.4); }
          70%  { box-shadow: 0 0 0 15px rgba(0,109,55,0); }
          100% { box-shadow: 0 0 0 0 rgba(0,109,55,0); }
        }
        @keyframes mapPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.4); }
        }
        @keyframes livePulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
