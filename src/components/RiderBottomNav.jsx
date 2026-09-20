import { useNavigate } from 'react-router-dom'

/*
  Shared rider bottom nav for the pushed sub-pages (Preferred Drivers,
  Scheduled Rides, Family) so they stop being dead-end back-button pages.
  Tapping a tab returns to /rider/home with that tab active (RiderHomePage
  reads location.state.tab). The rider Home screen keeps its own in-page
  version — this component is only for the sub-pages.

  `active` optionally highlights the closest tab for context; pass nothing
  to show all tabs unselected.
*/
const TABS = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'trips', label: 'Trips', icon: 'receipt_long' },
  { key: 'drivers', label: 'Drivers', icon: 'local_taxi' },
  { key: 'profile', label: 'Profile', icon: 'person' },
]

export default function RiderBottomNav({ active }) {
  const navigate = useNavigate()
  return (
    <nav
      className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-4 pt-2"
      style={{ background: 'var(--color-surface)', boxShadow: '0px -4px 20px rgba(26,43,60,0.05)', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}
    >
      {TABS.map(({ key, label, icon }) => {
        const on = active === key
        return (
          <button
            key={key}
            onClick={() => navigate('/rider/home', { state: { tab: key } })}
            className="flex flex-col items-center justify-center"
            style={{
              background: on ? 'var(--color-primary-container)' : 'transparent',
              color: on ? 'var(--color-on-primary-container)' : 'var(--color-on-secondary-container)',
              borderRadius: 9999,
              padding: on ? '4px 16px' : '4px 8px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              minWidth: 48,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 24, fontVariationSettings: on ? "'FILL' 1" : "'FILL' 0" }}>{icon}</span>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', marginTop: 2 }}>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
