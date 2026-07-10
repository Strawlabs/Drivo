import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth.jsx'

const VEHICLE_OPTIONS = [
  { id: 'luxe',  label: 'Drivo Luxe',  sub: 'EV Sedan · 4 min',  icon: 'electric_car',      fare: 284 },
  { id: 'space', label: 'Drivo Space', sub: 'EV SUV · 7 min',    icon: 'directions_car',    fare: 380 },
]

export default function BookRidePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  const driver = location.state?.driver ?? {
    name: 'Ramesh K.', rating: 4.9, avatar: 'RK', type: 'EV Sedan', eta: '3 mins',
  }
  const pickup      = location.state?.pickup      ?? 'Koramangala 5th Block'
  const destination = location.state?.destination ?? 'MG Road Metro Station'

  const [selected, setSelected]   = useState('luxe')
  const [confirming, setConfirming] = useState(false)

  const fare = VEHICLE_OPTIONS.find(v => v.id === selected).fare

  async function handleConfirm() {
    if (confirming || !user) return
    setConfirming(true)
    try {
      const { data, error } = await supabase.from('rides').insert({
        rider_id: user.id,
        driver_id: driver.id ?? null,
        vehicle_id: driver.vehicleId ?? null,
        pickup_address: pickup,
        destination_address: destination,
        estimated_fare: fare,
        status: 'requested',
      }).select().single()
      if (error) throw error
      navigate('/rider/active-ride', { state: { rideId: data.id, driver, fare, pickup, destination, rideStatus: 'requested' } })
    } catch (err) {
      alert('Could not create ride: ' + err.message)
      setConfirming(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-background)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-5 py-3"
        style={{ background: 'var(--color-surface)', boxShadow: '0 1px 0 var(--color-surface-container-low)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            style={{ width: 40, height: 40, borderRadius: '50%', background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>arrow_back</span>
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-on-surface)' }}>Book Ride</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>notifications</span>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700 }}>
            {driver.avatar?.[0] ?? 'U'}
          </div>
        </div>
      </header>

      {/* Map placeholder */}
      <div className="relative flex-1" style={{ minHeight: 220 }}>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #0f1923 0%, #1a2b1a 50%, #0b1c30 100%)' }}>
          {[20,40,60,80].map(p => <div key={`h${p}`} style={{ position:'absolute', top:`${p}%`, left:0, right:0, height:1, background:'rgba(46,204,113,0.12)' }} />)}
          {[15,30,50,65,80].map(p => <div key={`v${p}`} style={{ position:'absolute', left:`${p}%`, top:0, bottom:0, width:1, background:'rgba(46,204,113,0.12)' }} />)}
          <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%' }} viewBox="0 0 360 220" preserveAspectRatio="none">
            <path d="M60 180 Q110 100 170 120 Q220 140 280 70 L320 50" stroke="#2ecc71" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.9"/>
            <circle cx="60" cy="180" r="6" fill="#2ecc71"/>
            <circle cx="320" cy="50" r="6" fill="#4ae183"/>
            <circle cx="320" cy="50" r="12" fill="none" stroke="#4ae183" strokeWidth="1.5" opacity="0.5"/>
          </svg>
        </div>
        {/* Pickup label */}
        <div style={{ position:'absolute', top:'32%', left:'14%', background:'white', padding:'4px 10px', borderRadius:8, boxShadow:'0 2px 8px rgba(0,0,0,0.15)' }}>
          <p style={{ fontSize:11, fontWeight:600, color:'var(--color-on-surface)' }}>Pickup: {pickup.split(',')[0]}</p>
        </div>
        {/* Destination label */}
        <div style={{ position:'absolute', top:'16%', right:'12%', background:'var(--color-primary)', padding:'4px 10px', borderRadius:8, boxShadow:'0 2px 8px rgba(0,0,0,0.15)' }}>
          <p style={{ fontSize:11, fontWeight:600, color:'white' }}>{destination.split(' ').slice(0,2).join(' ')}</p>
        </div>
        {/* Gradient scrim */}
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, rgba(248,249,255,0.7) 0%, rgba(248,249,255,0) 20%, rgba(248,249,255,0) 60%, rgba(248,249,255,1) 95%)', pointerEvents:'none' }} />
      </div>

      {/* Bottom sheet */}
      <div style={{ background: 'var(--color-surface)', borderTopLeftRadius: 24, borderTopRightRadius: 24, boxShadow: '0 -10px 30px rgba(26,43,60,0.12)', padding: '12px 20px 32px', marginTop: -24, position: 'relative', zIndex: 10 }}>
        {/* Grabber */}
        <div style={{ width: 32, height: 4, background: '#E2E8F0', borderRadius: 2, margin: '0 auto 16px' }} />

        {/* Route */}
        <div className="flex items-center gap-4 mb-5">
          <div className="flex flex-col items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--color-primary)' }}>radio_button_checked</span>
            <div style={{ width: 1, height: 20, borderLeft: '2px dashed var(--color-outline-variant)' }} />
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--color-primary)' }}>location_on</span>
          </div>
          <div className="flex-1 flex flex-col gap-3">
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', color: 'var(--color-on-surface-variant)' }}>Pickup</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-on-surface)' }}>{pickup}</p>
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', color: 'var(--color-on-surface-variant)' }}>Destination</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-on-surface)' }}>{destination}</p>
            </div>
          </div>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-secondary)' }}>swap_vert</span>
          </button>
        </div>

        {/* Vehicle options */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {VEHICLE_OPTIONS.map(v => (
            <button key={v.id} onClick={() => setSelected(v.id)}
              style={{ position: 'relative', background: selected === v.id ? 'white' : 'var(--color-surface-container-low)', border: `2px solid ${selected === v.id ? 'var(--color-primary)' : 'var(--color-outline-variant)'}`, borderRadius: 12, padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', cursor: 'pointer', opacity: selected === v.id ? 1 : 0.65, transition: 'all 0.15s' }}>
              {selected === v.id && (
                <span className="material-symbols-outlined" style={{ position:'absolute', top:6, right:6, fontSize:18, color:'var(--color-primary)', fontVariationSettings:"'FILL' 1" }}>check_circle</span>
              )}
              <span className="material-symbols-outlined" style={{ fontSize: 40, color: 'var(--color-primary)', marginBottom: 6 }}>{v.icon}</span>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-on-surface)' }}>{v.label}</p>
              <p style={{ fontSize: 11, color: 'var(--color-on-surface-variant)', marginTop: 2 }}>{v.sub}</p>
            </button>
          ))}
        </div>

        {/* Driver + fare */}
        <div className="flex items-center justify-between mb-5" style={{ background: 'var(--color-surface-container-lowest)', border: '1px solid var(--color-outline-variant)', borderRadius: 12, padding: 14 }}>
          <div className="flex items-center gap-3">
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 16 }}>
              {driver.avatar}
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-on-surface)' }}>{driver.name}</p>
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#F59E0B', fontVariationSettings:"'FILL' 1" }}>star</span>
                <span style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>{driver.rating} · EV Certified</span>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-primary)', lineHeight: 1 }}>₹{fare}</p>
            <p style={{ fontSize: 11, color: 'var(--color-on-surface-variant)', marginTop: 2 }}>Est. Fare</p>
          </div>
        </div>

        {/* Payment */}
        <div className="flex items-center justify-between px-1 mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: 20 }}>payments</span>
            <span style={{ fontSize: 14, color: 'var(--color-on-surface)' }}>UPI / Cash</span>
          </div>
          <button style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>Change</button>
        </div>

        {/* CTA */}
        <button onClick={handleConfirm} disabled={confirming}
          style={{ width: '100%', height: 52, background: 'var(--color-primary-container)', color: 'var(--color-on-primary-container)', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: confirming ? 'not-allowed' : 'pointer', opacity: confirming ? 0.7 : 1, boxShadow: '0 4px 16px rgba(0,109,55,0.2)' }}>
          {confirming ? 'Confirming…' : 'Confirm Ride'}
          {!confirming && <span className="material-symbols-outlined">chevron_right</span>}
        </button>
      </div>
    </div>
  )
}
