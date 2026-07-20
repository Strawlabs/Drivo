import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

const CATEGORIES = [
  { id: 'safety',   label: 'Safety',      icon: 'shield',           color: '#B91C1C', bg: 'rgba(185,28,28,0.1)' },
  { id: 'payments', label: 'Payments',    icon: 'payments',         color: 'var(--color-primary)', bg: 'var(--color-surface-container-low)' },
  { id: 'ev',       label: 'EV Charging', icon: 'ev_station',       color: 'white',    bg: 'var(--color-primary)' },
  { id: 'account',  label: 'Account',     icon: 'person',           color: 'var(--color-on-surface)', bg: 'var(--color-surface-container-low)' },
]

const FAQS = [
  { id: 1, category: 'safety',   q: 'How do I trigger SOS during a ride?', a: 'On the Active Ride screen, tap the red SOS button. This logs an emergency event on your ride and gives you one-tap call/text links to your saved emergency contacts.' },
  { id: 2, category: 'safety',   q: 'How do I share my trip with someone?', a: 'On the Active Ride screen, tap "Share Ride" to generate a link. Anyone with the link can see your live trip status for 24 hours — no login required.' },
  { id: 3, category: 'safety',   q: 'What happens if I report an issue after a ride?', a: 'Your report goes straight to our Trust & Safety team for review from the ride-completion screen or your trip history. You can track its status from there.' },
  { id: 4, category: 'payments', q: 'How do I pay for my ride?', a: 'You can pay via UPI or cash at the end of your ride. For UPI, we open your UPI app with the amount pre-filled — just confirm the payment and enter the reference number to complete it.' },
  { id: 5, category: 'payments', q: 'My UPI payment failed or timed out — what now?', a: "If a payment isn't confirmed within 2 minutes, it's automatically marked as failed and you'll see a Retry option on the ride-completion screen." },
  { id: 6, category: 'payments', q: 'Where can I find my receipt?', a: 'Once a payment is completed, a "Download Receipt" link appears on the ride-completion screen.' },
  { id: 7, category: 'ev',       q: 'Are all Drivo vehicles electric?', a: "Yes — every vehicle on Drivo is a certified EV (auto or car). Charging is handled by our driver-partners between rides, so there's nothing for you to manage as a rider." },
  { id: 8, category: 'ev',       q: 'What does the "EV Certified" badge on a driver profile mean?', a: "It means Drivo has verified that driver's vehicle registration and EV credentials." },
  { id: 9, category: 'account',  q: 'How do I add a family member?', a: 'Go to Profile → Family, then tap "Add Family Member" and enter their registered phone number. They\'ll get an invite to approve from their own account.' },
  { id: 10, category: 'account', q: 'How do I save a preferred driver?', a: 'After a completed ride, tap "Save as Preferred Driver" on the rating screen — or from a driver\'s profile page. This is a Care Plan / Family Plan benefit.' },
  { id: 11, category: 'account', q: 'How do I schedule a ride in advance?', a: 'From Home, tap "Schedule a Ride" (or Profile → Rides) to pick a date, time, pickup and destination up to a few weeks ahead.' },
]

function ChevronIcon({ open }) {
  return (
    <span className="material-symbols-outlined" style={{ transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }}>expand_more</span>
  )
}

export default function HelpSupportPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState(null)
  const [openFaqId, setOpenFaqId] = useState(null)

  const filteredFaqs = useMemo(() => {
    const term = search.trim().toLowerCase()
    return FAQS.filter(f => {
      const matchesCategory = !activeCategory || f.category === activeCategory
      const matchesSearch = !term || f.q.toLowerCase().includes(term) || f.a.toLowerCase().includes(term)
      return matchesCategory && matchesSearch
    })
  }, [search, activeCategory])

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-background)', fontFamily: 'var(--font-sans)' }}>

      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center gap-3 px-5 py-3"
        style={{ background: 'var(--color-surface)', boxShadow: '0 1px 0 var(--color-surface-container-low)' }}>
        <button onClick={() => navigate(-1)}
          style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-surface-container-low)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>arrow_back</span>
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-on-surface)' }}>Drivo Support</h1>
      </header>

      <main style={{ maxWidth: 480, width: '100%', margin: '0 auto', padding: '20px 20px 60px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-on-surface)', textAlign: 'center', marginBottom: 16 }}>How can we help?</h2>

        {/* Search */}
        <div className="relative flex items-center" style={{ marginBottom: 20 }}>
          <span className="material-symbols-outlined absolute" style={{ left: 16, color: 'var(--color-secondary)', pointerEvents: 'none' }}>search</span>
          <input
            type="text"
            placeholder="Search for help topics…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', height: 52, paddingLeft: 48, paddingRight: 16, background: 'white', border: 'none', borderRadius: 14, fontSize: 15, color: 'var(--color-on-surface)', outline: 'none', boxShadow: '0 1px 4px rgba(26,43,60,0.06)', boxSizing: 'border-box' }}
          />
        </div>

        {/* Categories */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          {CATEGORIES.map(c => {
            const active = activeCategory === c.id
            return (
              <button key={c.id} onClick={() => setActiveCategory(active ? null : c.id)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10, padding: 16, borderRadius: 14, border: active ? '2px solid var(--color-primary)' : '2px solid transparent', background: active ? 'rgba(0,109,55,0.06)' : 'var(--color-surface-container-low)', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="material-symbols-outlined" style={{ color: c.color, fontSize: 22 }}>{c.icon}</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-on-surface)' }}>{c.label}</span>
              </button>
            )
          })}
        </div>

        {/* Safety Hotline */}
        <a href="tel:112" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'var(--color-on-surface)', borderRadius: 16, padding: 20, marginBottom: 24, textDecoration: 'none' }}>
          <div>
            <p style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 4 }}>Safety Hotline</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>National Emergency Helpline (112) — for immediate assistance during a ride.</p>
          </div>
          <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-error)', color: 'white', padding: '10px 16px', borderRadius: 9999, fontSize: 13, fontWeight: 700 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>call</span>
            Call Now
          </span>
        </a>

        {/* FAQs */}
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: 12 }}>Frequently Asked Questions</h3>
        <div className="flex flex-col" style={{ marginBottom: 24 }}>
          {filteredFaqs.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--color-secondary)' }}>No help topics match your search.</p>
          )}
          {filteredFaqs.map(f => {
            const open = openFaqId === f.id
            return (
              <div key={f.id} style={{ background: 'white', borderRadius: 14, boxShadow: '0 1px 6px rgba(26,43,60,0.06)', marginBottom: 8, overflow: 'hidden' }}>
                <button onClick={() => setOpenFaqId(open ? null : f.id)}
                  className="w-full flex items-center justify-between"
                  style={{ padding: '14px 16px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--color-on-surface)' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, paddingRight: 12 }}>{f.q}</span>
                  <ChevronIcon open={open} />
                </button>
                {open && (
                  <p style={{ fontSize: 13, color: 'var(--color-secondary)', padding: '0 16px 16px', lineHeight: 1.5 }}>{f.a}</p>
                )}
              </div>
            )
          })}
        </div>

        {/* Contact options */}
        <div className="flex gap-3">
          <a href="mailto:support@drivo.app" style={{ flex: 1, height: 48, background: 'var(--color-primary)', color: 'white', borderRadius: 12, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>mail</span>
            Email Support
          </a>
          <a href="tel:112" style={{ flex: 1, height: 48, background: 'var(--color-surface-container-low)', color: 'var(--color-on-surface)', borderRadius: 12, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>call</span>
            Emergency Line
          </a>
        </div>
      </main>
    </div>
  )
}
