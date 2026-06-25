import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth.jsx'

const NAV_ITEMS = [
  { key: 'earnings',    label: 'Earnings',      icon: '💰' },
  { key: 'goHome',     label: 'Go Home Mode',   icon: '📍' },
  { key: 'analytics',  label: 'Analytics',      icon: '📊' },
  { key: 'subscription', label: 'Subscription', icon: '⭐' },
  { key: 'ads',        label: 'Ads',            icon: '📣' },
  { key: 'settings',   label: 'Settings',       icon: '⚙️' },
]

const REVENUE_BARS = [
  { month: 'Jan', sub: 60, ads: 40 },
  { month: 'Feb', sub: 70, ads: 35 },
  { month: 'Mar', sub: 85, ads: 50 },
  { month: 'Apr', sub: 65, ads: 45 },
  { month: 'May', sub: 90, ads: 60 },
]

const glass = {
  background: 'rgba(255,255,255,0.8)',
  backdropFilter: 'blur(8px)',
  border: '1px solid #F1F5F9',
}

function GlassCard({ children, style = {}, hover = false }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      style={{
        ...glass,
        borderRadius: 16,
        boxShadow: hovered && hover
          ? '0px 10px 30px rgba(26,43,60,0.12)'
          : '0px 4px 20px rgba(26,43,60,0.05)',
        transition: 'box-shadow 0.2s ease, transform 0.2s ease',
        transform: hovered && hover ? 'translateY(-4px)' : 'translateY(0)',
        ...style,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </div>
  )
}

export default function AdminDashboardPage() {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const [activeNav, setActiveNav]   = useState('analytics')
  const [drivers, setDrivers]       = useState([])
  const [search, setSearch]         = useState('')
  const [actionLoading, setActionLoading] = useState(null)

  useEffect(() => { loadPendingDrivers() }, [])

  async function loadPendingDrivers() {
    const { data } = await supabase
      .from('drivers')
      .select(`id, status, license_no, created_at, vehicles ( make, model, plate_number, vehicle_type, is_ev )`)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setDrivers(data ?? [])
  }

  async function updateStatus(driverId, newStatus) {
    setActionLoading(driverId + newStatus)
    const { error } = await supabase.from('drivers').update({ status: newStatus }).eq('id', driverId)
    if (!error) setDrivers(prev => prev.filter(d => d.id !== driverId))
    setActionLoading(null)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const filtered = drivers.filter(d => {
    if (!search) return true
    const veh = Array.isArray(d.vehicles) ? d.vehicles[0] : d.vehicles
    const plate = veh?.plate_number ?? ''
    return plate.toLowerCase().includes(search.toLowerCase()) ||
           d.license_no?.toLowerCase().includes(search.toLowerCase())
  })

  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-background)', fontFamily: 'var(--font-sans)', display: 'flex' }}>

      {/* ── Sidebar ── */}
      <aside
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 60,
          width: 280,
          background: 'var(--color-surface)',
          boxShadow: '4px 0 20px rgba(26,43,60,0.06)',
          borderTopRightRadius: 16, borderBottomRightRadius: 16,
          display: 'flex', flexDirection: 'column',
          padding: 16,
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2" style={{ marginBottom: 24, padding: '8px 12px' }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '-0.01em' }}>Drivo</span>
          <span
            style={{
              fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
              background: 'var(--color-primary-container)', color: 'var(--color-on-primary-container)',
              padding: '2px 8px', borderRadius: 9999,
            }}
          >
            Admin
          </span>
        </div>

        {/* Profile card */}
        <div
          className="flex items-center gap-3"
          style={{
            marginBottom: 24, padding: 12,
            background: 'var(--color-surface-container-low)',
            borderRadius: 12,
          }}
        >
          <div
            style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'var(--color-secondary-container)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 700, color: 'var(--color-on-secondary-container)',
              flexShrink: 0,
            }}
          >
            {user?.email?.[0]?.toUpperCase() ?? 'A'}
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-on-surface)' }}>Driver Dashboard</p>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-secondary)' }}>Premium Tier • EV Certified</p>
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {NAV_ITEMS.map(({ key, label, icon }) => {
            const active = activeNav === key
            return (
              <button
                key={key}
                onClick={() => setActiveNav(key)}
                className="flex items-center gap-4 text-left"
                style={{
                  padding: '10px 12px', borderRadius: 8, border: 'none',
                  background: active ? 'var(--color-secondary-container)' : 'transparent',
                  color: active ? 'var(--color-on-secondary-container)' : 'var(--color-on-surface-variant)',
                  fontSize: 16, fontWeight: active ? 700 : 400,
                  cursor: 'pointer',
                  transform: active ? 'translateX(4px)' : 'translateX(0)',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontSize: 18 }}>{icon}</span>
                {label}
              </button>
            )
          })}
        </nav>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="flex items-center justify-center gap-2 w-full"
          style={{
            marginTop: 16, padding: '12px 16px', borderRadius: 12, border: 'none',
            background: 'var(--color-inverse-surface)', color: 'var(--color-inverse-on-surface)',
            fontSize: 14, fontWeight: 500, cursor: 'pointer',
          }}
        >
          ← Sign Out
        </button>
      </aside>

      {/* ── Main content ── */}
      <main style={{ marginLeft: 280, flex: 1, padding: 32, minHeight: '100dvh' }}>

        {/* Top bar */}
        <header className="flex justify-between items-center" style={{ marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 600, lineHeight: '40px', letterSpacing: '-0.01em', color: 'var(--color-on-surface)' }}>
              System Overview
            </h1>
            <p style={{ fontSize: 16, color: 'var(--color-secondary)' }}>Real-time performance metrics and operations.</p>
          </div>
          <div className="flex items-center gap-4">
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, background: 'var(--color-error)', borderRadius: '50%', zIndex: 1 }} />
              <button
                style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: 'var(--color-surface)', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, cursor: 'pointer',
                  boxShadow: '0 1px 4px rgba(26,43,60,0.08)',
                }}
              >
                🔔
              </button>
            </div>
            <div style={{ width: 1, height: 40, background: 'var(--color-outline-variant)' }} />
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-on-surface-variant)' }}>{today}</span>
              <span style={{ fontSize: 16 }}>📅</span>
            </div>
          </div>
        </header>

        {/* KPI Cards */}
        <section
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20, marginBottom: 32 }}
        >
          {[
            { icon: '📍', color: 'rgba(46,204,113,0.12)', label: 'Active Drivers',  value: '12,842', delta: '+12.4%', extra: null },
            { icon: '👥', color: 'rgba(209,228,251,0.5)', label: 'Active Riders',   value: '84,920', delta: '+8.2%',  extra: null },
            { icon: '⚡', color: 'var(--color-primary-container)', label: 'EV Adoption', value: '74.2%', delta: 'Goal: 80%', extra: 74 },
            { icon: '💼', color: 'var(--color-inverse-surface)', label: 'Monthly Revenue', value: '₹2.4M', delta: '+5.1%', extra: null, dark: true },
          ].map(({ icon, color, label, value, delta, extra, dark }) => (
            <GlassCard key={label} hover style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div className="flex justify-between items-start">
                <div
                  style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18,
                  }}
                >
                  {icon}
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', color: 'var(--color-primary)' }}>
                  {delta}
                </span>
              </div>
              <div style={{ marginTop: 20 }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-secondary)', marginBottom: 4 }}>{label}</p>
                <h3 style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-on-surface)', lineHeight: '40px' }}>
                  {value}
                </h3>
                {extra !== null && (
                  <div style={{ marginTop: 12, height: 8, background: 'var(--color-surface-container)', borderRadius: 9999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${extra}%`, background: 'var(--color-primary)', borderRadius: 9999 }} />
                  </div>
                )}
              </div>
            </GlassCard>
          ))}
        </section>

        {/* Revenue + Ads row */}
        <section style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 32 }}>

          {/* Revenue Growth */}
          <GlassCard style={{ padding: 24 }}>
            <div className="flex justify-between items-center" style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--color-on-surface)' }}>Revenue Growth</h2>
              <div className="flex gap-3">
                {[
                  { label: 'Subscription', color: 'var(--color-primary)' },
                  { label: 'Ads', color: 'var(--color-secondary)' },
                ].map(({ label, color }) => (
                  <span key={label} className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em' }}>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: color, display: 'inline-block' }} />
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ height: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
              {REVENUE_BARS.map(({ month, sub, ads }) => (
                <div key={month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%' }}>
                  <div style={{ flex: 1, width: '100%', display: 'flex', gap: 4, alignItems: 'flex-end' }}>
                    <div style={{ flex: 1, height: `${sub}%`, background: 'var(--color-primary)', borderRadius: '4px 4px 0 0', transition: 'height 0.6s ease' }} />
                    <div style={{ flex: 1, height: `${ads}%`, background: 'var(--color-secondary)', borderRadius: '4px 4px 0 0', opacity: 0.7, transition: 'height 0.6s ease' }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', color: 'var(--color-secondary)' }}>{month}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Manage Ads */}
          <GlassCard style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
            <div className="flex justify-between items-center" style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--color-on-surface)' }}>Manage Ads</h2>
              <button style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                View All
              </button>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { icon: '📢', name: "Summer Drive '24", sub: 'Active • 12k Clicks' },
                { icon: '⚡', name: 'EV Referral Pro',   sub: 'Scheduled • Starts June' },
              ].map(({ icon, name, sub }) => (
                <div
                  key={name}
                  className="flex items-center justify-between"
                  style={{ padding: 12, background: 'var(--color-surface-container)', borderRadius: 12 }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      style={{
                        width: 40, height: 40, background: '#fff',
                        borderRadius: 8, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 18, flexShrink: 0,
                      }}
                    >
                      {icon}
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-on-surface)' }}>{name}</p>
                      <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', color: 'var(--color-secondary)' }}>{sub}</p>
                    </div>
                  </div>
                  <button style={{ fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-secondary)' }}>⋯</button>
                </div>
              ))}
            </div>
            <button
              className="flex items-center justify-center gap-2 w-full"
              style={{
                marginTop: 20, padding: '12px 16px',
                border: '2px dashed var(--color-outline-variant)',
                borderRadius: 12, background: 'transparent',
                fontSize: 14, fontWeight: 500, color: 'var(--color-secondary)',
                cursor: 'pointer', transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--color-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; e.currentTarget.style.color = 'var(--color-secondary)' }}
            >
              + Create Campaign
            </button>
          </GlassCard>
        </section>

        {/* Driver Approval Table */}
        <GlassCard style={{ overflow: 'hidden' }}>
          {/* Table header */}
          <div
            className="flex justify-between items-center"
            style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-outline-variant)' }}
          >
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--color-on-surface)' }}>Approve Drivers</h2>
              <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', color: 'var(--color-secondary)' }}>
                {drivers.length > 0 ? `Verification pending for ${drivers.length} candidate${drivers.length !== 1 ? 's' : ''}` : 'No pending candidates'}
              </p>
            </div>
            <div className="flex gap-3">
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>🔍</span>
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    paddingLeft: 36, paddingRight: 16, height: 40,
                    background: 'var(--color-surface-container-low)',
                    border: 'none', borderRadius: 8,
                    fontSize: 14, color: 'var(--color-on-surface)',
                    outline: 'none', width: 220,
                  }}
                />
              </div>
              <button
                className="flex items-center gap-2"
                style={{
                  padding: '8px 16px', background: 'var(--color-primary)',
                  color: 'white', borderRadius: 8, border: 'none',
                  fontSize: 14, fontWeight: 500, cursor: 'pointer',
                }}
              >
                ▼ Filters
              </button>
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-container-low)' }}>
                  {['Candidate', 'Documents', 'Vehicle Type', 'Requested Date', 'Actions'].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        padding: '12px 24px',
                        fontSize: 12, fontWeight: 600, letterSpacing: '0.08em',
                        color: 'var(--color-secondary)', textTransform: 'uppercase',
                        textAlign: i === 4 ? 'right' : 'left',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--color-on-surface-variant)', fontSize: 14 }}>
                      🎉 No pending drivers to review
                    </td>
                  </tr>
                ) : (
                  filtered.map(driver => {
                    const veh = Array.isArray(driver.vehicles) ? driver.vehicles[0] : driver.vehicles
                    const reqDate = new Date(driver.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                    return (
                      <tr
                        key={driver.id}
                        style={{ borderTop: '1px solid var(--color-outline-variant)', transition: 'background 0.15s ease' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-container-low)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        {/* Candidate */}
                        <td style={{ padding: '16px 24px' }}>
                          <div className="flex items-center gap-3">
                            <div
                              style={{
                                width: 40, height: 40, borderRadius: '50%',
                                background: 'var(--color-surface-variant)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 14, fontWeight: 700, color: 'var(--color-on-surface)',
                                flexShrink: 0,
                              }}
                            >
                              {driver.id.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-on-surface)' }}>
                                Driver #{driver.id.slice(0, 8)}
                              </p>
                              <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', color: 'var(--color-secondary)' }}>
                                License: {driver.license_no}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Documents */}
                        <td style={{ padding: '16px 24px' }}>
                          <span
                            className="inline-flex items-center gap-1.5"
                            style={{
                              fontSize: 12, fontWeight: 600, letterSpacing: '0.05em',
                              color: 'var(--color-primary)',
                              background: 'rgba(46,204,113,0.1)',
                              padding: '4px 8px', borderRadius: 6,
                            }}
                          >
                            ✓ Submitted
                          </span>
                        </td>

                        {/* Vehicle */}
                        <td style={{ padding: '16px 24px' }}>
                          <div className="flex items-center gap-2">
                            <span style={{ color: 'var(--color-primary)', fontSize: 16 }}>
                              {veh?.is_ev ? '⚡' : '🚗'}
                            </span>
                            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-on-surface)' }}>
                              {veh ? `${veh.make} ${veh.model}` : '—'}
                            </span>
                          </div>
                        </td>

                        {/* Date */}
                        <td style={{ padding: '16px 24px', fontSize: 14, color: 'var(--color-secondary)' }}>
                          {reqDate}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => updateStatus(driver.id, 'suspended')}
                              disabled={!!actionLoading}
                              style={{
                                padding: '7px 16px',
                                border: '1px solid var(--color-outline)',
                                background: 'transparent',
                                color: 'var(--color-on-surface-variant)',
                                borderRadius: 8, fontSize: 14, fontWeight: 500,
                                cursor: !!actionLoading ? 'not-allowed' : 'pointer',
                                opacity: actionLoading === driver.id + 'suspended' ? 0.5 : 1,
                              }}
                            >
                              {actionLoading === driver.id + 'suspended' ? 'Rejecting…' : 'Reject'}
                            </button>
                            <button
                              onClick={() => updateStatus(driver.id, 'active')}
                              disabled={!!actionLoading}
                              style={{
                                padding: '7px 16px',
                                background: 'var(--color-primary)',
                                color: 'white',
                                border: 'none', borderRadius: 8,
                                fontSize: 14, fontWeight: 500,
                                cursor: !!actionLoading ? 'not-allowed' : 'pointer',
                                opacity: actionLoading === driver.id + 'active' ? 0.5 : 1,
                              }}
                            >
                              {actionLoading === driver.id + 'active' ? 'Approving…' : 'Approve'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </main>
    </div>
  )
}
