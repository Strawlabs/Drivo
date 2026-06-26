import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const NEARBY_DRIVERS = [
  { id: 1, name: 'Ramesh K.', rating: 4.9, avatar: 'RK' },
  { id: 2, name: 'Priya S.',  rating: 4.8, avatar: 'PS' },
  { id: 3, name: 'Anita M.', rating: 5.0, avatar: 'AM' },
]

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_NAMES = ['Mo','Tu','We','Th','Fr','Sa','Su']

function MiniCalendar({ selectedDate, onSelect }) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate() }
  function firstDayOfMonth(y, m) {
    const d = new Date(y, m, 1).getDay()
    return d === 0 ? 6 : d - 1 // Mon=0
  }

  const totalDays = daysInMonth(viewYear, viewMonth)
  const startOffset = firstDayOfMonth(viewYear, viewMonth)
  const cells = Array.from({ length: startOffset + totalDays }, (_, i) =>
    i < startOffset ? null : i - startOffset + 1
  )

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  function isSel(d) {
    return selectedDate && selectedDate.getDate() === d && selectedDate.getMonth() === viewMonth && selectedDate.getFullYear() === viewYear
  }
  function isToday(d) {
    return d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear()
  }
  function isPast(d) {
    const date = new Date(viewYear, viewMonth, d)
    return date < new Date(today.getFullYear(), today.getMonth(), today.getDate())
  }

  return (
    <div style={{ background: 'white', border: '1px solid rgba(241,245,249,1)', borderRadius: 14, padding: 16, boxShadow: '0 4px 20px rgba(26,43,60,0.05)' }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </p>
        <div className="flex gap-2">
          <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-secondary)', display: 'flex' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-secondary)', display: 'flex' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
      </div>
      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: 6 }}>
        {DAY_NAMES.map(d => (
          <div key={d} style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-secondary)', padding: '4px 0' }}>{d}</div>
        ))}
      </div>
      {/* Cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px 0' }}>
        {cells.map((day, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {day === null ? null : (
              <button onClick={() => !isPast(day) && onSelect(new Date(viewYear, viewMonth, day))}
                style={{
                  width: 34, height: 34, borderRadius: 8, border: 'none', cursor: isPast(day) ? 'default' : 'pointer', fontSize: 13, fontWeight: isSel(day) || isToday(day) ? 700 : 500,
                  background: isSel(day) ? 'var(--color-primary-container)' : 'transparent',
                  color: isSel(day) ? 'var(--color-on-primary-container)' : isPast(day) ? 'var(--color-outline-variant)' : isToday(day) ? 'var(--color-primary)' : 'var(--color-on-surface)',
                  outline: isToday(day) && !isSel(day) ? '2px solid var(--color-primary)' : 'none',
                  outlineOffset: -2,
                  transition: 'background 0.15s',
                }}>
                {day}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const UPCOMING = [
  { id: 1, from: 'Koramangala', to: 'Indiranagar 100 Ft Rd', date: 'Tomorrow', time: '08:30 AM', driver: 'Ramesh K.', fare: '₹210', status: 'confirmed' },
  { id: 2, from: 'HSR Layout',  to: 'MG Road Metro',         date: 'Thu, 26 Jun', time: '09:00 AM', driver: 'Any Driver',  fare: '₹185', status: 'pending' },
]

export default function ScheduledRidesPage() {
  const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState(null)
  const [pickup, setPickup] = useState('')
  const [destination, setDestination] = useState('')
  const [time, setTime] = useState('')
  const [selectedDriver, setSelectedDriver] = useState(null)
  const [scheduled, setScheduled] = useState(false)
  const [scheduling, setScheduling] = useState(false)

  const formattedDate = selectedDate
    ? selectedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''

  async function handleSchedule() {
    if (scheduling) return
    setScheduling(true)
    await new Promise(r => setTimeout(r, 1200))
    setScheduling(false)
    setScheduled(true)
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-background)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center gap-3 px-5 py-3"
        style={{ background: 'var(--color-surface)', boxShadow: '0 1px 0 var(--color-surface-container-low)' }}>
        <button onClick={() => navigate(-1)}
          style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-surface-container-low)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-on-surface)' }}>Schedule a Ride</h1>
          <p style={{ fontSize: 12, color: 'var(--color-secondary)' }}>Plan your sustainable journey ahead</p>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: 480, width: '100%', margin: '0 auto', padding: '20px 20px 120px', overflowY: 'auto' }}>

        {/* Success Banner */}
        {scheduled && (
          <div style={{ background: 'rgba(46,204,113,0.12)', border: '1px solid var(--color-primary-container)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round"/></svg>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-on-primary-container)' }}>Ride scheduled! You'll get a reminder 30 minutes before.</p>
          </div>
        )}

        {/* Upcoming Rides */}
        {UPCOMING.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: 12 }}>Upcoming</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {UPCOMING.map(ride => (
                <div key={ride.id} style={{ background: 'white', border: '1px solid rgba(241,245,249,1)', borderRadius: 14, padding: 14, boxShadow: '0 2px 8px rgba(26,43,60,0.04)' }}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--color-primary)"><circle cx="12" cy="12" r="6"/></svg>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-on-surface)' }}>{ride.from}</p>
                      </div>
                      <div style={{ width: 1, height: 10, background: 'var(--color-outline-variant)', marginLeft: 5, margin: '2px 0 2px 5px' }} />
                      <div className="flex items-center gap-1.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-on-surface)' }}>{ride.to}</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 700, background: ride.status === 'confirmed' ? 'rgba(46,204,113,0.12)' : 'var(--color-surface-container)', color: ride.status === 'confirmed' ? 'var(--color-primary)' : 'var(--color-secondary)' }}>
                        {ride.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                      </span>
                      <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary)', marginTop: 4 }}>{ride.fare}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between" style={{ borderTop: '1px solid var(--color-surface-container-low)', paddingTop: 10 }}>
                    <div className="flex items-center gap-1.5">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-secondary)" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                      <span style={{ fontSize: 12, color: 'var(--color-secondary)' }}>{ride.date} · {ride.time}</span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--color-secondary)' }}>{ride.driver}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Book New Section */}
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: 16 }}>Book New</h3>

        {/* Calendar */}
        <div style={{ marginBottom: 16 }}>
          <MiniCalendar selectedDate={selectedDate} onSelect={setSelectedDate} />
        </div>

        {/* Pickup Input */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--color-primary)" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="12" cy="12" r="5"/></svg>
          <input type="text" placeholder="Pickup location" value={pickup} onChange={e => setPickup(e.target.value)}
            style={{ width: '100%', height: 52, paddingLeft: 44, paddingRight: 16, background: '#F8F9FA', border: 'none', borderRadius: 12, fontSize: 15, color: 'var(--color-on-surface)', outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box', transition: 'box-shadow 0.2s' }}
            onFocus={e => e.target.style.boxShadow = '0 0 0 2px rgba(0,109,55,0.2)'}
            onBlur={e => e.target.style.boxShadow = 'none'}
          />
        </div>

        {/* Destination Input */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ba1a1a" strokeWidth="2" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5" fill="#ba1a1a" stroke="none"/></svg>
          <input type="text" placeholder="Where to?" value={destination} onChange={e => setDestination(e.target.value)}
            style={{ width: '100%', height: 52, paddingLeft: 44, paddingRight: 16, background: '#F8F9FA', border: 'none', borderRadius: 12, fontSize: 15, color: 'var(--color-on-surface)', outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box', transition: 'box-shadow 0.2s' }}
            onFocus={e => e.target.style.boxShadow = '0 0 0 2px rgba(0,109,55,0.2)'}
            onBlur={e => e.target.style.boxShadow = 'none'}
          />
        </div>

        {/* Date + Time row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div style={{ position: 'relative' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-secondary)" strokeWidth="1.5" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            <input type="text" readOnly value={formattedDate} placeholder="Select date"
              style={{ width: '100%', height: 52, paddingLeft: 38, paddingRight: 12, background: '#F8F9FA', border: 'none', borderRadius: 12, fontSize: 14, color: formattedDate ? 'var(--color-on-surface)' : 'var(--color-secondary)', outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box', cursor: 'default' }}
            />
          </div>
          <div style={{ position: 'relative' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-secondary)" strokeWidth="1.5" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              style={{ width: '100%', height: 52, paddingLeft: 38, paddingRight: 12, background: '#F8F9FA', border: 'none', borderRadius: 12, fontSize: 14, color: 'var(--color-on-surface)', outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.boxShadow = '0 0 0 2px rgba(0,109,55,0.2)'}
              onBlur={e => e.target.style.boxShadow = 'none'}
            />
          </div>
        </div>

        {/* Preferred Driver */}
        <div style={{ background: 'white', border: '1px solid rgba(241,245,249,1)', borderRadius: 14, padding: 16, marginBottom: 4, boxShadow: '0 4px 20px rgba(26,43,60,0.05)' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: 12 }}>Preferred Driver (Optional)</p>
          <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {NEARBY_DRIVERS.map(d => {
              const isSelected = selectedDriver === d.id
              return (
                <button key={d.id} onClick={() => setSelectedDriver(isSelected ? null : d.id)}
                  style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: '2px solid', borderColor: isSelected ? 'var(--color-primary-container)' : 'transparent', background: isSelected ? 'var(--color-surface-container-low)' : '#F8F9FA', cursor: 'pointer', transition: 'all 0.15s' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                    {d.avatar}
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-on-surface)' }}>{d.name}</p>
                    <div className="flex items-center gap-0.5">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--color-primary)"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                      <span style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 600 }}>{d.rating}</span>
                    </div>
                  </div>
                </button>
              )
            })}
            <button onClick={() => setSelectedDriver('any')}
              style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: '2px solid', borderColor: selectedDriver === 'any' ? 'var(--color-primary-container)' : 'transparent', background: selectedDriver === 'any' ? 'var(--color-surface-container-low)' : '#F8F9FA', cursor: 'pointer', transition: 'all 0.15s' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-secondary-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-secondary-container)" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
              </div>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-on-surface)' }}>Any Driver</p>
                <p style={{ fontSize: 11, color: 'var(--color-secondary)' }}>Best ETA</p>
              </div>
            </button>
          </div>
        </div>
      </main>

      {/* Sticky CTA */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16px 20px 32px', background: 'linear-gradient(to top, var(--color-surface) 70%, transparent)', zIndex: 30 }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <button onClick={handleSchedule} disabled={scheduling}
            style={{ width: '100%', height: 56, background: scheduled ? 'var(--color-primary-container)' : 'var(--color-primary)', color: scheduled ? 'var(--color-on-primary-container)' : 'white', borderRadius: 14, border: 'none', fontSize: 16, fontWeight: 700, cursor: scheduling ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 4px 16px rgba(0,109,55,0.25)', transition: 'all 0.2s', opacity: scheduling ? 0.8 : 1 }}>
            {scheduling ? (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.3"/><path d="M21 12a9 9 0 00-9-9" strokeLinecap="round"/></svg>
                Scheduling...
              </>
            ) : scheduled ? (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="var(--color-on-primary-container)" strokeWidth="2.5" strokeLinecap="round"/></svg>
                Ride Scheduled!
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/></svg>
                Schedule Ride
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  )
}
