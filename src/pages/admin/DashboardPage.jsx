import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth.jsx'

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
  if (status === 'submitted') return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:12, fontWeight:600, color:'#006d37', background:'rgba(46,204,113,0.12)', padding:'3px 10px', borderRadius:6 }}>
      <span className="material-symbols-outlined" style={{ fontSize:15 }}>check_circle</span> Verified
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

const NAV = [
  { icon: 'payments',   label: 'Earnings' },
  { icon: 'home_pin',   label: 'Go Home Mode' },
  { icon: 'analytics',  label: 'Analytics', active: true },
  { icon: 'loyalty',    label: 'Subscription' },
  { icon: 'ads_click',  label: 'Ads' },
  { icon: 'settings',   label: 'Settings' },
]

export default function AdminDashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
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

  const pendingDrivers = drivers.filter(d => d.kyc_status === 'submitted' || d.kyc_status === 'pending')
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

        {/* KPI Cards */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 28 }}>
          {[
            { icon: 'person_pin_circle', label: 'Active Drivers',  value: drivers.length,   badge: '+12.4%', iconBg: 'rgba(46,204,113,0.15)', iconColor: '#006d37' },
            { icon: 'groups',           label: 'Active Riders',    value: '—',              badge: '+8.2%',  iconBg: '#d2e4fb',               iconColor: '#4f6073' },
            { icon: 'electric_car',     label: 'EV Adoption',      value: '74.2%',          badge: 'Goal: 80%', iconBg: '#2ecc71',            iconColor: 'white',  progress: 74 },
            { icon: 'account_balance_wallet', label: 'Monthly Revenue', value: '₹2.4M',     badge: '+5.1%',  iconBg: '#213145',               iconColor: '#eaf1ff' },
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
              {[
                { month: 'Jan', sub: 60, ads: 40 },
                { month: 'Feb', sub: 70, ads: 35 },
                { month: 'Mar', sub: 85, ads: 50 },
                { month: 'Apr', sub: 65, ads: 45 },
                { month: 'May', sub: 90, ads: 60 },
              ].map(bar => (
                <div key={bar.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%' }}>
                  <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', gap: 3 }}>
                    <div style={{ flex: 1, height: `${bar.sub}%`, background: '#006d37', borderRadius: '4px 4px 0 0', transition: 'height 0.3s' }} />
                    <div style={{ flex: 1, height: `${bar.ads}%`, background: '#4f6073', borderRadius: '4px 4px 0 0', transition: 'height 0.3s' }} />
                  </div>
                  <span style={{ fontSize: 12, color: '#4f6073', fontWeight: 500 }}>{bar.month}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Manage Ads */}
          <div style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid #f1f5f9', borderRadius: 18, padding: 24, boxShadow: '0 2px 8px rgba(26,43,60,0.05)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0b1c30', margin: 0 }}>Manage Ads</h2>
              <button style={{ fontSize: 13, fontWeight: 600, color: '#006d37', background: 'none', border: 'none', cursor: 'pointer' }}>View All</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
              {[
                { icon: 'brand_awareness', name: "Summer Drive '24", sub: 'Active • 12k Clicks' },
                { icon: 'electric_bolt',   name: 'EV Referral Pro',    sub: 'Scheduled • Starts June' },
              ].map(ad => (
                <div key={ad.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#e5eeff', borderRadius: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, background: 'white', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#4f6073' }}>{ad.icon}</span>
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#0b1c30', margin: 0 }}>{ad.name}</p>
                      <p style={{ fontSize: 11, color: '#4f6073', margin: 0 }}>{ad.sub}</p>
                    </div>
                  </div>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#4f6073' }}>more_vert</span>
                  </button>
                </div>
              ))}
            </div>
            <button style={{
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
                        <DocsBadge status={driver.kyc_status} />
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
      </main>
    </div>
  )
}
