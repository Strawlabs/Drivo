import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth.jsx'
import { fetchDriverProfile } from '@/lib/drivers'
import { savePreferredDriver, fetchSubscriptionTier, fetchPreferredStatus, ELIGIBLE_TIERS } from '@/lib/preferredDrivers'

const TIER_LABEL = { basic: null, pro: 'PRO DRIVER', elite: 'ELITE DRIVER' }

export default function DriverProfilePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { driverId } = useParams()
  const { user } = useAuth()

  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [subscriptionTier, setSubscriptionTier] = useState('none')
  const [savedStatus, setSavedStatus] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  useEffect(() => {
    fetchDriverProfile(driverId).then(setProfile).catch(() => setProfile(null)).finally(() => setLoading(false))
  }, [driverId])

  useEffect(() => {
    if (!user) return
    fetchSubscriptionTier(user.id).then(setSubscriptionTier).catch(() => {})
  }, [user])

  useEffect(() => {
    if (!user || !profile) return
    fetchPreferredStatus(user.id, profile.id).then(setSavedStatus).catch(() => {})
  }, [user, profile])

  const isEligibleForPreferredDriver = ELIGIBLE_TIERS.includes(subscriptionTier)

  async function handleSaveDriver() {
    if (!user || !profile) return
    setSaving(true)
    setSaveError(null)
    try {
      const row = await savePreferredDriver({ riderId: user.id, driverId: profile.id })
      setSavedStatus(row.status)
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleRequestRide() {
    if (!profile) return
    navigate('/rider/book-ride', {
      state: {
        driver: { id: profile.id, name: profile.name, avatar: profile.avatar, rating: profile.rating, type: profile.vehicle?.label ?? 'EV' },
        pickup: location.state?.pickup,
        destination: location.state?.destination,
      },
    })
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-background)' }}>
        <p style={{ color: 'var(--color-secondary)' }}>Loading…</p>
      </div>
    )
  }

  if (!profile) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--color-background)', gap: 12 }}>
        <p style={{ color: 'var(--color-secondary)' }}>Couldn't load this driver's profile.</p>
        <button onClick={() => navigate(-1)} style={{ color: 'var(--color-primary)', background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Go back</button>
      </div>
    )
  }

  const tierLabel = TIER_LABEL[profile.tier]

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-background)', fontFamily: 'var(--font-sans)' }}>

      {/* Hero */}
      <div style={{ position: 'relative', height: 220, background: 'linear-gradient(135deg, #0f1923 0%, #1a2b1a 50%, #0b1c30 100%)' }}>
        <button onClick={() => navigate(-1)}
          style={{ position: 'absolute', top: 16, left: 16, width: 40, height: 40, borderRadius: '50%', background: 'rgba(248,249,255,0.9)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2 }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>arrow_back</span>
        </button>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(11,28,48,0.85), rgba(11,28,48,0.1))' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 20px 18px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div className="flex items-center gap-3">
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 22, border: '3px solid rgba(255,255,255,0.8)' }}>
              {profile.avatar}
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white' }}>{profile.name}</h1>
              <div className="flex items-center gap-1.5" style={{ marginTop: 2 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#F59E0B', fontVariationSettings: "'FILL' 1" }}>star</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{profile.rating}</span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>· {profile.totalRides.toLocaleString('en-IN')} Trips</span>
              </div>
            </div>
          </div>
          {tierLabel && (
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--color-on-primary-container)', background: 'var(--color-primary-container)', padding: '4px 10px', borderRadius: 9999, whiteSpace: 'nowrap' }}>{tierLabel}</span>
          )}
        </div>
      </div>

      <main style={{ maxWidth: 480, width: '100%', margin: '0 auto', padding: '16px 20px 120px' }}>

        {/* Current Vehicle */}
        {profile.vehicle && (
          <section style={{ background: 'white', borderRadius: 16, padding: 16, boxShadow: '0 1px 6px rgba(26,43,60,0.06)', marginBottom: 14 }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>directions_car</span>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--color-secondary)', textTransform: 'uppercase' }}>Current Vehicle</p>
            </div>
            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-on-surface)' }}>{profile.vehicle.label}</p>
            <p style={{ fontSize: 13, color: 'var(--color-secondary)', marginTop: 2, letterSpacing: '0.05em' }}>{profile.vehicle.registrationNumber}</p>
          </section>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div style={{ background: 'white', borderRadius: 14, padding: '16px 8px', textAlign: 'center', boxShadow: '0 1px 6px rgba(26,43,60,0.06)' }}>
            <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-primary)' }}>{profile.kycVerified ? '✓' : '—'}</p>
            <p style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 2 }}>KYC Verified</p>
          </div>
          <div style={{ background: 'white', borderRadius: 14, padding: '16px 8px', textAlign: 'center', boxShadow: '0 1px 6px rgba(26,43,60,0.06)' }}>
            <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-primary)' }}>{profile.partnerSinceYears < 1 ? '<1y' : `${profile.partnerSinceYears}y`}</p>
            <p style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 2 }}>Exp. Partner</p>
          </div>
        </div>

        {/* Trust & Safety */}
        <section style={{ background: 'white', borderRadius: 16, padding: 16, boxShadow: '0 1px 6px rgba(26,43,60,0.06)', marginBottom: 14 }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>verified_user</span>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-on-surface)' }}>Trust &amp; Safety</h3>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined" style={{ color: profile.kycVerified ? 'var(--color-primary)' : 'var(--color-outline-variant)' }}>check_circle</span>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-on-surface)' }}>Background Checked</p>
                <p style={{ fontSize: 12, color: 'var(--color-secondary)' }}>{profile.kycVerified ? 'Verified by Drivo Safety' : 'Verification pending'}</p>
              </div>
            </div>
            {profile.vehicle && (
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined" style={{ color: profile.vehicle.isEvCertified ? 'var(--color-primary)' : 'var(--color-outline-variant)' }}>eco</span>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-on-surface)' }}>EV Certified</p>
                  <p style={{ fontSize: 12, color: 'var(--color-secondary)' }}>{profile.vehicle.isVerified ? 'Vehicle verified by Drivo' : 'Vehicle verification pending'}</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Customer Reviews */}
        <section style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: 10 }}>Customer Reviews</h3>
          {profile.reviews.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--color-secondary)' }}>No reviews yet.</p>
          ) : (
            <div className="flex flex-col">
              {profile.reviews.map((r, i) => (
                <div key={i} style={{ background: 'white', borderRadius: 14, padding: 14, boxShadow: '0 1px 6px rgba(26,43,60,0.05)', marginBottom: 8 }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--color-secondary-container)', color: 'var(--color-on-secondary-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                        {r.riderName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-on-surface)' }}>{r.riderName}</p>
                    </div>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(n => (
                        <span key={n} className="material-symbols-outlined" style={{ fontSize: 14, color: n <= r.rating ? '#F59E0B' : 'var(--color-outline-variant)', fontVariationSettings: n <= r.rating ? "'FILL' 1" : "'FILL' 0" }}>star</span>
                      ))}
                    </div>
                  </div>
                  {r.review && <p style={{ fontSize: 13, color: 'var(--color-on-surface-variant)', fontStyle: 'italic' }}>"{r.review}"</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Sticky CTA */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '14px 20px 28px', background: 'linear-gradient(to top, var(--color-surface) 75%, transparent)' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {saveError && <p style={{ fontSize: 12, color: 'var(--color-error)' }}>{saveError}</p>}
          {savedStatus ? (
            <p style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 600, textAlign: 'center' }}>
              {savedStatus === 'active' ? `${profile.name} is a preferred driver` : `Waiting for ${profile.name} to approve your request`}
            </p>
          ) : isEligibleForPreferredDriver ? (
            <button onClick={handleSaveDriver} disabled={saving}
              style={{ width: '100%', height: 44, background: 'none', border: '1px solid var(--color-outline-variant)', borderRadius: 9999, color: 'var(--color-on-surface)', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>favorite</span>
              {saving ? 'Saving…' : 'Save as Preferred'}
            </button>
          ) : (
            <button onClick={() => navigate('/rider/subscription')}
              style={{ width: '100%', height: 44, background: 'none', border: '1px dashed var(--color-outline-variant)', borderRadius: 9999, color: 'var(--color-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>favorite</span>
              Upgrade to Care/Family to save as preferred
            </button>
          )}
          <button onClick={handleRequestRide}
            style={{ width: '100%', height: 52, background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 9999, fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,109,55,0.25)' }}>
            Request Ride Now
          </button>
        </div>
      </div>
    </div>
  )
}
