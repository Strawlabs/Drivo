import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth.jsx'
import { fetchAvailableDrivers } from '@/lib/drivers'
import { notifyDriverProfile } from '@/lib/notifications'
import { triggerSos, createSharedTripLink } from '@/lib/safety'

export default function ActiveRidePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  const rideId      = location.state?.rideId      ?? null
  const driver      = location.state?.driver      ?? { name: 'Ramesh K.', rating: 4.9, avatar: 'RK', type: 'EV Sedan' }
  const pickup      = location.state?.pickup      ?? 'Koramangala 5th Block'
  const destination = location.state?.destination ?? 'MG Road Metro Station'
  const initialFare = location.state?.fare        ?? 284

  const [rideStatus, setRideStatus] = useState(location.state?.rideStatus ?? 'requested')
  const [fare, setFare]         = useState(initialFare)
  const [eta, setEta]           = useState(8)
  const [progress, setProgress] = useState(30)
  const [cancelling, setCancelling] = useState(false)
  const [alternates, setAlternates] = useState([])
  const [driverPhone, setDriverPhone] = useState(null)
  const [sosPanel, setSosPanel] = useState(null) // null | 'confirm' | { contacts }
  const [triggeringSos, setTriggeringSos] = useState(false)
  const [sharePanel, setSharePanel] = useState(null) // null | { url }
  const [sharing, setSharing] = useState(false)

  // The header's real rendered height varies (font metrics, safe-area
  // insets on notched devices) — a hardcoded top offset for the map, SOS
  // button, and map controls was measured wrong and left SOS clipped
  // behind the header. Measure the actual header instead of guessing.
  const headerRef = useRef(null)
  const [headerHeight, setHeaderHeight] = useState(64)
  useEffect(() => {
    if (!headerRef.current) return
    const el = headerRef.current
    const update = () => setHeaderHeight(el.getBoundingClientRect().height)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [rideStatus])
  const fareRef = useRef(fare)
  fareRef.current = fare

  // Re-sync local state when navigated to a different ride (e.g. requesting
  // an alternate driver reuses this same route, so mount-only useState
  // wouldn't otherwise reset stale status/fare from the previous ride).
  useEffect(() => {
    setRideStatus(location.state?.rideStatus ?? 'requested')
    setFare(location.state?.fare ?? 284)
    setEta(8)
    setProgress(30)
    setAlternates([])
  }, [rideId])

  // Tick ETA/progress only — the fare is fixed at booking and must never
  // change mid-ride (it previously ticked up ₹0.50 every 8s, which read as
  // a live meter but had no basis: the DB's estimated_fare never moved and
  // final_fare is set from it on completion, so the rider was just seeing
  // a fake number climb).
  useEffect(() => {
    const interval = setInterval(() => {
      setEta(e => Math.max(0, e - 1))
      setProgress(p => Math.min(100, p + 5))
    }, 8000)
    return () => clearInterval(interval)
  }, [])

  // Supabase realtime — listen for ride status changes
  useEffect(() => {
    if (!rideId) return
    const channel = supabase
      .channel(`ride-${rideId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${rideId}` }, payload => {
        const s = payload.new.status
        if (s === 'accepted') setRideStatus('accepted')
        if (s === 'active')   setRideStatus('active')
        if (s === 'expired') {
          setRideStatus('expired')
          fetchAvailableDrivers({ excludeDriverId: driver.id }).then(setAlternates).catch(() => setAlternates([]))
        }
        if (s === 'completed') {
          navigate('/rider/ride-complete', { state: { rideId, driver, fare: fareRef.current, pickup, destination }, replace: true })
        }
        if (s === 'cancelled') {
          navigate('/rider/home', { replace: true })
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [rideId])

  useEffect(() => {
    if (!driver.id) return
    supabase.from('driver_profiles').select('users(phone)').eq('id', driver.id).maybeSingle()
      .then(({ data }) => setDriverPhone(data?.users?.phone ?? null))
  }, [driver.id])

  async function handleTriggerSos() {
    if (triggeringSos || !rideId || !user) return
    setTriggeringSos(true)
    try {
      let coords = { latitude: null, longitude: null }
      if (navigator.geolocation) {
        coords = await new Promise(resolve => {
          navigator.geolocation.getCurrentPosition(
            pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
            () => resolve({ latitude: null, longitude: null }),
            { timeout: 3000 }
          )
        })
      }
      const { contacts } = await triggerSos({ rideId, userId: user.id, ...coords })
      setSosPanel({ contacts })
    } catch (err) {
      alert('Could not trigger SOS: ' + err.message)
    } finally {
      setTriggeringSos(false)
    }
  }

  async function handleShareTrip() {
    if (sharing || !rideId || !user) return
    setSharing(true)
    try {
      const { url } = await createSharedTripLink({ rideId, userId: user.id })
      if (navigator.share) {
        await navigator.share({ title: 'Track my Drivo ride', url }).catch(() => {})
      }
      setSharePanel({ url })
    } catch (err) {
      alert('Could not create share link: ' + err.message)
    } finally {
      setSharing(false)
    }
  }

  async function handleCancel() {
    if (cancelling) return
    setCancelling(true)
    if (rideId) {
      await supabase.from('rides').update({
        status: 'cancelled',
        cancellation_reason: 'Cancelled by rider',
        cancelled_by: user?.id ?? null,
      }).eq('id', rideId)
    }
    navigate('/rider/home', { replace: true })
  }

  async function handleRequestAlternate(altDriver) {
    if (!user) return
    try {
      const { data, error } = await supabase.from('rides').insert({
        rider_id: user.id,
        driver_id: altDriver.id ?? null,
        vehicle_id: altDriver.vehicleId ?? null,
        pickup_address: pickup,
        destination_address: destination,
        estimated_fare: initialFare,
        status: 'requested',
      }).select().single()
      if (error) throw error

      if (altDriver.id) {
        notifyDriverProfile(altDriver.id, {
          category: 'driver_request',
          title: 'New ride request',
          body: `A rider wants a ride from ${pickup} to ${destination}.`,
          data: { rideId: data.id },
        }).catch(() => {})
      }

      navigate('/rider/active-ride', {
        state: { rideId: data.id, driver: altDriver, fare: initialFare, pickup, destination, rideStatus: 'requested' },
        replace: true,
      })
    } catch (err) {
      alert('Could not request driver: ' + err.message)
    }
  }

  const startTime = new Date(Date.now() - 4 * 60000)
  const fmt = d => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  if (rideStatus === 'expired') {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--color-background)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', padding: '0 24px 40px' }}>
        <header style={{ paddingTop: 56, marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-error-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--color-error)' }}>person_off</span>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: 6 }}>Driver unavailable</h2>
          <p style={{ fontSize: 15, color: 'var(--color-secondary)' }}>
            {driver.name} couldn't take your ride. Pick another driver below.
          </p>
        </header>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {alternates.length === 0 && (
            <p style={{ fontSize: 14, color: 'var(--color-secondary)' }}>No other EV drivers online right now — check back soon.</p>
          )}
          {alternates.map(alt => (
            <div key={alt.id} style={{ background: 'var(--color-surface)', borderRadius: 16, padding: 16, boxShadow: '0 1px 6px rgba(26,43,60,0.07)', border: '1px solid rgba(187,203,187,0.3)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                {alt.avatar}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: 2 }}>{alt.name}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: '#F59E0B' }}>★</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-on-surface)' }}>{alt.rating}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-secondary)' }}>· {alt.type}</span>
                </div>
              </div>
              <button onClick={() => handleRequestAlternate(alt)}
                style={{ height: 40, padding: '0 16px', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                Request
              </button>
            </div>
          ))}
        </div>

        <button onClick={() => navigate('/rider/home', { replace: true })}
          style={{ width: '100%', height: 50, marginTop: 24, background: 'none', border: '1px solid var(--color-outline-variant)', borderRadius: 12, fontSize: 14, fontWeight: 600, color: 'var(--color-secondary)', cursor: 'pointer' }}>
          Back to Home
        </button>
      </div>
    )
  }

  if (rideStatus === 'requested') {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--color-background)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
        {/* Pulsing ring */}
        <div style={{ position: 'relative', width: 120, height: 120, marginBottom: 32 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,109,55,0.1)', animation: 'ripple 2s infinite ease-in-out' }} />
          <div style={{ position: 'absolute', inset: 16, borderRadius: '50%', background: 'rgba(0,109,55,0.18)', animation: 'ripple 2s infinite ease-in-out 0.4s' }} />
          <div style={{ position: 'absolute', inset: 32, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'white' }}>electric_car</span>
          </div>
        </div>

        <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: 8, textAlign: 'center' }}>Waiting for driver…</h2>
        <p style={{ fontSize: 15, color: 'var(--color-secondary)', textAlign: 'center', marginBottom: 8 }}>
          {driver.name} is reviewing your request
        </p>
        <p style={{ fontSize: 13, color: 'var(--color-on-surface-variant)', textAlign: 'center', marginBottom: 40 }}>
          This usually takes under 30 seconds
        </p>

        {/* Route summary */}
        <div style={{ width: '100%', maxWidth: 360, background: 'var(--color-surface)', borderRadius: 16, padding: '16px 20px', boxShadow: '0 2px 12px rgba(26,43,60,0.08)', marginBottom: 24 }}>
          <div className="flex items-center gap-3 mb-3">
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--color-primary)' }}>radio_button_checked</span>
            <p style={{ fontSize: 14, color: 'var(--color-on-surface)', fontWeight: 500 }}>{pickup}</p>
          </div>
          <div style={{ marginLeft: 9, width: 2, height: 16, background: 'var(--color-outline-variant)', marginBottom: 8 }} />
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--color-primary)' }}>location_on</span>
            <p style={{ fontSize: 14, color: 'var(--color-on-surface)', fontWeight: 500 }}>{destination}</p>
          </div>
        </div>

        <button onClick={handleCancel} disabled={cancelling}
          style={{ width: '100%', maxWidth: 360, height: 52, background: 'var(--color-error-container)', color: 'var(--color-error)', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: cancelling ? 'not-allowed' : 'pointer', opacity: cancelling ? 0.7 : 1 }}>
          {cancelling ? 'Cancelling…' : 'Cancel Request'}
        </button>

        <style>{`
          @keyframes ripple {
            0%,100% { transform:scale(1); opacity:0.8; }
            50% { transform:scale(1.15); opacity:0.3; }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-background)', fontFamily: 'var(--font-sans)', position: 'relative', overflow: 'hidden' }}>

      {/* Header */}
      <header ref={headerRef} className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-5 py-3"
        style={{ background: 'var(--color-surface)', boxShadow: '0 1px 4px rgba(26,43,60,0.08)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/rider/home')}
            style={{ width: 44, height: 44, borderRadius: '50%', background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>arrow_back</span>
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-on-surface)' }}>Active Ride</h1>
        </div>
        <div style={{ background: 'var(--color-primary-container)', color: 'var(--color-on-primary-container)', padding: '4px 12px', borderRadius: 9999, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>verified</span>
          EV Eco
        </div>
      </header>

      {/* Map */}
      <div style={{ position: 'fixed', inset: 0, top: headerHeight, background: 'linear-gradient(135deg, #0f1923 0%, #1a2b1a 50%, #0b1c30 100%)' }}>
        {[20,40,60,80].map(p => <div key={`h${p}`} style={{ position:'absolute', top:`${p}%`, left:0, right:0, height:1, background:'rgba(46,204,113,0.1)' }} />)}
        {[15,30,50,65,80].map(p => <div key={`v${p}`} style={{ position:'absolute', left:`${p}%`, top:0, bottom:0, width:1, background:'rgba(46,204,113,0.1)' }} />)}
        <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%' }} viewBox="0 0 360 600" preserveAspectRatio="none">
          <path d="M80 500 Q130 380 190 350 Q240 320 290 200 L320 120" stroke="#2ecc71" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.9"/>
        </svg>
        {/* Car marker */}
        <div style={{ position:'absolute', top:'55%', left:'42%' }}>
          <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ position:'absolute', width:48, height:48, borderRadius:'50%', background:'rgba(0,109,55,0.2)', animation:'ripple 2s infinite ease-in-out' }} />
            <div style={{ width:24, height:24, borderRadius:'50%', background:'var(--color-primary)', border:'2px solid white', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', zIndex:1 }}>
              <span className="material-symbols-outlined" style={{ fontSize:14, color:'white' }}>navigation</span>
            </div>
          </div>
        </div>
        {/* Destination label */}
        <div style={{ position:'absolute', top:'22%', left:'60%' }}>
          <div style={{ background:'var(--color-on-surface)', color:'white', padding:'4px 10px', borderRadius:8, fontSize:11, fontWeight:600, marginBottom:6, boxShadow:'0 2px 8px rgba(0,0,0,0.3)' }}>
            {destination.split(' ').slice(0,2).join(' ')}
          </div>
          <div style={{ width:32, height:32, background:'var(--color-on-surface)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(0,0,0,0.3)' }}>
            <span className="material-symbols-outlined" style={{ fontSize:18, color:'white', fontVariationSettings:"'FILL' 1" }}>location_on</span>
          </div>
        </div>
        {/* Gradient scrim bottom */}
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, rgba(248,249,255,0.7) 0%, rgba(248,249,255,0) 20%, rgba(248,249,255,0) 65%, rgba(248,249,255,0.9) 100%)', pointerEvents:'none' }} />
      </div>

      {/* Floating SOS — anchored to the header's measured height (see
          headerHeight above) instead of a hardcoded guess, which measured
          the header wrong and left this clipped behind it. */}
      <div style={{ position:'fixed', top: headerHeight + 16, left:20, zIndex:40 }}>
        <button onClick={() => setSosPanel('confirm')}
          style={{ display:'flex', alignItems:'center', gap:6, background:'var(--color-error)', color:'white', padding:'8px 16px', borderRadius:9999, border:'none', fontSize:13, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 16px rgba(186,26,26,0.35)' }}>
          <span className="material-symbols-outlined" style={{ fontSize:18, fontVariationSettings:"'FILL' 1" }}>emergency_home</span>
          SOS
        </button>
      </div>

      {/* SOS confirm / result panel */}
      {sosPanel && (
        <div style={{ position:'fixed', inset:0, zIndex:100, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'flex-end' }}>
          <div style={{ width:'100%', background:'var(--color-surface)', borderTopLeftRadius:24, borderTopRightRadius:24, padding:'24px 20px 32px' }}>
            {sosPanel === 'confirm' ? (
              <>
                <h3 style={{ fontSize:18, fontWeight:700, color:'var(--color-error)', marginBottom:8 }}>Trigger SOS?</h3>
                <p style={{ fontSize:14, color:'var(--color-secondary)', marginBottom:20 }}>This logs an emergency event on your ride and gives you one-tap links to alert your emergency contacts.</p>
                <div className="flex gap-3">
                  <button onClick={() => setSosPanel(null)} style={{ flex:1, height:48, background:'none', border:'1px solid var(--color-outline-variant)', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer' }}>Cancel</button>
                  <button onClick={handleTriggerSos} disabled={triggeringSos} style={{ flex:1, height:48, background:'var(--color-error)', color:'white', border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer' }}>
                    {triggeringSos ? 'Sending…' : 'Confirm SOS'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ fontSize:18, fontWeight:700, color:'var(--color-error)', marginBottom:4 }}>🚨 SOS logged</h3>
                <p style={{ fontSize:14, color:'var(--color-secondary)', marginBottom:16 }}>Alert your emergency contacts now:</p>
                {sosPanel.contacts.length === 0 ? (
                  <p style={{ fontSize:13, color:'var(--color-secondary)', marginBottom:16 }}>No emergency contacts configured — add some from your Family Dashboard.</p>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                    {sosPanel.contacts.map(c => (
                      <div key={c.phone} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--color-surface-container-low)', borderRadius:12, padding:'10px 14px' }}>
                        <div>
                          <p style={{ fontSize:14, fontWeight:600, color:'var(--color-on-surface)' }}>{c.name}</p>
                          <p style={{ fontSize:12, color:'var(--color-secondary)' }}>{c.phone}</p>
                        </div>
                        <div className="flex gap-2">
                          <a href={`tel:${c.phone}`} style={{ width:36, height:36, borderRadius:'50%', background:'var(--color-primary)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', textDecoration:'none' }}>📞</a>
                          <a href={`sms:${c.phone}?body=${encodeURIComponent('I need help — I triggered SOS on my Drivo ride. Please check on me.')}`} style={{ width:36, height:36, borderRadius:'50%', background:'var(--color-surface-container-high)', display:'flex', alignItems:'center', justifyContent:'center', textDecoration:'none' }}>💬</a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => setSosPanel(null)} style={{ width:'100%', height:48, background:'var(--color-on-surface)', color:'white', border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer' }}>Done</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Share trip panel */}
      {sharePanel && (
        <div style={{ position:'fixed', inset:0, zIndex:100, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'flex-end' }} onClick={() => setSharePanel(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width:'100%', background:'var(--color-surface)', borderTopLeftRadius:24, borderTopRightRadius:24, padding:'24px 20px 32px' }}>
            <h3 style={{ fontSize:18, fontWeight:700, color:'var(--color-on-surface)', marginBottom:8 }}>Share this trip</h3>
            <p style={{ fontSize:14, color:'var(--color-secondary)', marginBottom:16 }}>Anyone with this link can see live trip status — no login needed. It expires in 24 hours.</p>
            <div style={{ display:'flex', gap:8, marginBottom:16 }}>
              <input readOnly value={sharePanel.url} style={{ flex:1, height:44, padding:'0 12px', background:'var(--color-surface-container-low)', border:'none', borderRadius:10, fontSize:12, color:'var(--color-on-surface)' }} />
              <button onClick={() => navigator.clipboard?.writeText(sharePanel.url)} style={{ height:44, padding:'0 16px', background:'var(--color-primary)', color:'white', border:'none', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer' }}>Copy</button>
            </div>
            <button onClick={() => setSharePanel(null)} style={{ width:'100%', height:48, background:'none', border:'1px solid var(--color-outline-variant)', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer' }}>Close</button>
          </div>
        </div>
      )}

      {/* Map controls */}
      <div style={{ position:'fixed', top: headerHeight + 16, right:20, zIndex:40, display:'flex', flexDirection:'column', gap:8 }}>
        {['my_location','layers'].map(icon => (
          <button key={icon} style={{ width:48, height:48, background:'var(--color-surface)', borderRadius:12, border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', boxShadow:'0 2px 8px rgba(26,43,60,0.12)' }}>
            <span className="material-symbols-outlined" style={{ color:'var(--color-secondary)' }}>{icon}</span>
          </button>
        ))}
      </div>

      {/* Bottom sheet */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:60, background:'var(--color-surface)', borderTopLeftRadius:24, borderTopRightRadius:24, boxShadow:'0 -10px 30px rgba(26,43,60,0.12)', maxHeight:'60vh', overflowY:'auto' }}>
        {/* Grabber */}
        <div style={{ display:'flex', justifyContent:'center', padding:'10px 0 4px' }}>
          <div style={{ width:48, height:6, background:'var(--color-surface-container-highest)', borderRadius:3 }} />
        </div>

        {/* ETA + Fare */}
        <div className="px-5 pb-4" style={{ borderBottom:'1px solid rgba(187,203,187,0.2)' }}>
          <div className="flex justify-between items-end">
            <div>
              <p style={{ fontSize:12, color:'var(--color-secondary)', marginBottom:2 }}>Arriving in</p>
              <h2 style={{ fontSize:36, fontWeight:700, color:'var(--color-on-surface)', lineHeight:1 }}>
                {eta} <span style={{ fontSize:16, fontWeight:400, color:'var(--color-on-surface-variant)' }}>mins</span>
              </h2>
            </div>
            <div style={{ textAlign:'right' }}>
              <p style={{ fontSize:12, color:'var(--color-secondary)', marginBottom:2 }}>Est. Fare</p>
              <p style={{ fontSize:22, fontWeight:700, color:'var(--color-primary)' }}>₹{fare.toFixed(2)}</p>
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ marginTop:12, height:8, background:'var(--color-surface-container)', borderRadius:9999, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${progress}%`, background:'var(--color-primary)', borderRadius:9999, transition:'width 1s ease-in-out' }} />
          </div>
          <div className="flex justify-between mt-1" style={{ fontSize:11, color:'var(--color-on-surface-variant)' }}>
            <span>Start: {fmt(startTime)}</span>
            <span>ETA: {fmt(new Date(Date.now() + eta * 60000))}</span>
          </div>
        </div>

        {/* Driver + Vehicle */}
        <div className="px-5 py-4 flex gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div style={{ position:'relative' }}>
              <div style={{ width:64, height:64, borderRadius:'50%', background:'var(--color-primary)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:700, fontSize:22, border:'2px solid var(--color-primary-container)' }}>
                {driver.avatar}
              </div>
              <div style={{ position:'absolute', bottom:-2, right:-2, width:22, height:22, background:'var(--color-primary)', borderRadius:'50%', border:'2px solid var(--color-surface)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span className="material-symbols-outlined" style={{ fontSize:12, color:'white', fontVariationSettings:"'FILL' 1" }}>star</span>
              </div>
            </div>
            <div>
              <p style={{ fontSize:18, fontWeight:700, color:'var(--color-on-surface)' }}>{driver.name}</p>
              <p style={{ fontSize:13, color:'var(--color-on-surface-variant)' }}>{driver.rating} Rating · EV Certified</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-1" style={{ background:'var(--color-surface-container-low)', borderRadius:16, padding:'10px 12px' }}>
            <span className="material-symbols-outlined" style={{ fontSize:36, color:'var(--color-primary)' }}>directions_car</span>
            <div>
              <div className="flex items-center gap-2">
                <p style={{ fontSize:13, fontWeight:600, color:'var(--color-on-surface)' }}>{driver.type ?? 'EV Sedan'}</p>
                <span style={{ background:'var(--color-on-surface)', color:'white', fontSize:10, fontWeight:700, padding:'1px 5px', borderRadius:3 }}>EV</span>
              </div>
              <p style={{ fontSize:11, color:'var(--color-on-surface-variant)', letterSpacing:'0.1em', marginTop:2 }}>KA · 05 EV 7890</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-8 flex gap-3">
          <button onClick={() => driverPhone && (window.location.href = `tel:${driverPhone}`)} disabled={!driverPhone}
            style={{ flex:1, height:48, background:'var(--color-on-surface)', color:'white', border:'none', borderRadius:12, fontSize:13, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:6, cursor:driverPhone ? 'pointer' : 'default', opacity:driverPhone ? 1 : 0.6 }}>
            <span className="material-symbols-outlined" style={{ fontSize:18 }}>chat_bubble</span>
            Contact
          </button>
          <button onClick={handleShareTrip} disabled={sharing}
            style={{ flex:1, height:48, background:'var(--color-surface-container-high)', color:'var(--color-on-surface)', border:'none', borderRadius:12, fontSize:13, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:6, cursor:'pointer' }}>
            <span className="material-symbols-outlined" style={{ fontSize:18 }}>share</span>
            Share Ride
          </button>
          <button onClick={handleCancel} disabled={cancelling}
            style={{ width:48, height:48, background:'var(--color-error-container)', color:'var(--color-error)', border:'none', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <span className="material-symbols-outlined" style={{ fontSize:20 }}>cancel</span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes ripple {
          0%,100% { transform:scale(1); opacity:0.8; }
          50% { transform:scale(1.8); opacity:0.2; }
        }
      `}</style>
    </div>
  )
}
