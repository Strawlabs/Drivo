import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth.jsx'

/*
  Two real, previously-missing self-service flows:
  - Personal info, through update_my_profile (schema.sql) — same RPC the
    rider-side Personal Information page uses; it's role-agnostic, just
    "the calling user's own row," so it works unchanged here.
  - Payout UPI ID, through the new update_driver_payout_info. Found
    while building this page that upi_id (what buildUpiLink in
    src/lib/payments.js reads to build the rider's payment link) had no
    self-service path anywhere — every test driver's value came from
    seed data only.
  driver_profiles/users' own UPDATE policies are admin-only, so both
  have to go through these RPCs, never a raw table write.
*/
export default function DriverSettingsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [driverProfileId, setDriverProfileId] = useState(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [upiId, setUpiId] = useState('')

  const [savingProfile, setSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSaved, setProfileSaved] = useState(false)

  const [savingPayout, setSavingPayout] = useState(false)
  const [payoutError, setPayoutError] = useState('')
  const [payoutSaved, setPayoutSaved] = useState(false)

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('users').select('name, email, phone').eq('id', user.id).single(),
      supabase.from('driver_profiles').select('id, upi_id').eq('user_id', user.id).maybeSingle(),
    ]).then(([{ data: u }, { data: dp }]) => {
      if (u) { setName(u.name ?? ''); setEmail(u.email ?? ''); setPhone(u.phone ?? '') }
      if (dp) { setDriverProfileId(dp.id); setUpiId(dp.upi_id ?? '') }
      setLoading(false)
    })
  }, [user])

  async function handleSaveProfile(e) {
    e.preventDefault()
    if (savingProfile || !name.trim()) return
    setSavingProfile(true)
    setProfileError('')
    setProfileSaved(false)
    try {
      const { error } = await supabase.rpc('update_my_profile', {
        p_name: name.trim(), p_email: email.trim() || null, p_phone: phone.trim(),
      })
      if (error) throw error
      setProfileSaved(true)
    } catch (err) {
      setProfileError(err.message)
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleSavePayout(e) {
    e.preventDefault()
    if (savingPayout || !driverProfileId) return
    setSavingPayout(true)
    setPayoutError('')
    setPayoutSaved(false)
    try {
      const { error } = await supabase.rpc('update_driver_payout_info', {
        p_driver_id: driverProfileId, p_upi_id: upiId.trim() || null,
      })
      if (error) throw error
      setPayoutSaved(true)
    } catch (err) {
      setPayoutError(err.message)
    } finally {
      setSavingPayout(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-background)', fontFamily: 'var(--font-sans)' }}>
      <header className="sticky top-0 z-40 flex items-center gap-3 px-5 py-3"
        style={{ background: 'var(--color-surface)', boxShadow: '0 1px 0 var(--color-surface-container-low)' }}>
        <button onClick={() => navigate(-1)}
          style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-surface-container-low)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-on-surface)' }}>⚙️ Settings</h1>
      </header>

      <main style={{ maxWidth: 480, width: '100%', margin: '0 auto', padding: '20px 20px 60px' }}>
        {loading ? (
          <p style={{ fontSize: 14, color: 'var(--color-secondary)' }}>Loading…</p>
        ) : (
          <>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-secondary)', marginBottom: 12 }}>Personal Information</p>
            <form onSubmit={handleSaveProfile} className="flex flex-col gap-3" style={{ background: 'white', borderRadius: 14, padding: 16, marginBottom: 24, border: '1px solid rgba(241,245,249,1)' }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-secondary)', display: 'block', marginBottom: 4 }}>Full Name</label>
                <input value={name} onChange={e => setName(e.target.value)} required
                  style={{ width: '100%', height: 44, padding: '0 12px', border: '1px solid var(--color-outline-variant)', borderRadius: 8, fontSize: 14, color: 'var(--color-on-surface)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-secondary)', display: 'block', marginBottom: 4 }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  style={{ width: '100%', height: 44, padding: '0 12px', border: '1px solid var(--color-outline-variant)', borderRadius: 8, fontSize: 14, color: 'var(--color-on-surface)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-secondary)', display: 'block', marginBottom: 4 }}>Mobile Number</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} required
                  style={{ width: '100%', height: 44, padding: '0 12px', border: '1px solid var(--color-outline-variant)', borderRadius: 8, fontSize: 14, color: 'var(--color-on-surface)', boxSizing: 'border-box' }} />
              </div>
              {profileError && <p style={{ fontSize: 12, color: 'var(--color-error)' }}>{profileError}</p>}
              {profileSaved && <p style={{ fontSize: 12, color: 'var(--color-primary)' }}>Saved.</p>}
              <button type="submit" disabled={savingProfile || !name.trim()}
                style={{ height: 44, background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: savingProfile ? 'not-allowed' : 'pointer', opacity: savingProfile ? 0.7 : 1 }}>
                {savingProfile ? 'Saving…' : 'Save'}
              </button>
            </form>

            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-secondary)', marginBottom: 12 }}>Payout UPI ID</p>
            <form onSubmit={handleSavePayout} className="flex flex-col gap-3" style={{ background: 'white', borderRadius: 14, padding: 16, border: '1px solid rgba(241,245,249,1)' }}>
              <p style={{ fontSize: 12, color: 'var(--color-secondary)' }}>
                This is what riders pay into via the UPI link at the end of a ride — keep it current so payments actually reach you.
              </p>
              <input value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="yourname@bank"
                style={{ width: '100%', height: 44, padding: '0 12px', border: '1px solid var(--color-outline-variant)', borderRadius: 8, fontSize: 14, color: 'var(--color-on-surface)', boxSizing: 'border-box' }} />
              {payoutError && <p style={{ fontSize: 12, color: 'var(--color-error)' }}>{payoutError}</p>}
              {payoutSaved && <p style={{ fontSize: 12, color: 'var(--color-primary)' }}>Saved.</p>}
              <button type="submit" disabled={savingPayout}
                style={{ height: 44, background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: savingPayout ? 'not-allowed' : 'pointer', opacity: savingPayout ? 0.7 : 1 }}>
                {savingPayout ? 'Saving…' : 'Save'}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  )
}
