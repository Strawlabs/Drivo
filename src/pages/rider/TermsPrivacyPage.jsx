import { useNavigate } from 'react-router-dom'
import RiderBottomNav from '@/components/RiderBottomNav'

const SECTIONS = [
  {
    title: 'Using Drivo',
    body: 'Drivo connects riders with independent EV driver-partners. Drivo is not the driver and does not own the vehicles used to fulfil rides — it provides the platform that matches, prices, and tracks a ride.',
  },
  {
    title: 'Payments',
    body: 'Fares are estimated up front and paid directly to the driver via UPI or cash after the ride. Drivo does not hold, process, or store your payment details at any point.',
  },
  {
    title: 'Location Data',
    body: 'While you have an active ride, your pickup/destination and the assigned driver’s live location are shared between rider and driver so the trip can be tracked. Location is not collected outside of an active ride.',
  },
  {
    title: 'Account Data',
    body: 'Your name, phone number, and email are used to identify you on the platform and to let drivers and support contact you about a ride. You can review and update this from Profile → Personal Information.',
  },
  {
    title: 'Safety Features',
    body: 'SOS and trip-sharing are provided as a convenience and are not a substitute for contacting local emergency services directly when you’re in danger.',
  },
]

export default function TermsPrivacyPage() {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-background)', fontFamily: 'var(--font-sans)' }}>
      <header className="sticky top-0 z-40 flex items-center gap-3 px-5 py-3"
        style={{ background: 'var(--color-surface)', boxShadow: '0 1px 0 var(--color-surface-container-low)' }}>
        <button onClick={() => navigate(-1)}
          style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-surface-container-low)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-on-surface)' }}>Terms & Privacy</h1>
      </header>

      <main style={{ maxWidth: 480, width: '100%', margin: '0 auto', padding: '20px 20px 110px' }}>
        <p style={{ fontSize: 12, color: 'var(--color-secondary)', marginBottom: 20 }}>
          A plain-language summary of how Drivo works and what happens to your data — not a substitute for formal legal terms.
        </p>
        <div className="flex flex-col gap-4">
          {SECTIONS.map(s => (
            <div key={s.title} style={{ background: 'white', borderRadius: 14, padding: 16, boxShadow: '0 1px 6px rgba(26,43,60,0.06)' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: 6 }}>{s.title}</p>
              <p style={{ fontSize: 13, color: 'var(--color-secondary)', lineHeight: 1.6 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </main>

      <RiderBottomNav active="profile" />
    </div>
  )
}
