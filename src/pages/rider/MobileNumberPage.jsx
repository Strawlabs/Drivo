import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth.jsx'
import RiderBottomNav from '@/components/RiderBottomNav'

/*
  Same update_my_profile RPC as PersonalInformationPage, just scoped to
  the one field this screen is for. No SMS/OTP re-verification exists
  anywhere in this app for a phone number — the number is self-reported
  at signup the same way (see RegisterPage) — so this isn't lowering any
  bar that existed before, just giving self-service access to the same
  trust level.
*/
export default function MobileNumberPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('users').select('name, email, phone').eq('id', user.id).single()
      .then(({ data }) => {
        if (data) { setName(data.name ?? ''); setEmail(data.email ?? ''); setPhone(data.phone ?? '') }
        setLoading(false)
      })
  }, [user])

  async function handleSave(e) {
    e.preventDefault()
    if (saving || !phone.trim()) return
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const { error: rpcErr } = await supabase.rpc('update_my_profile', {
        p_name: name, p_email: email || null, p_phone: phone.trim(),
      })
      if (rpcErr) throw rpcErr
      setSaved(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
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
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-on-surface)' }}>Mobile Number</h1>
      </header>

      <main style={{ maxWidth: 480, width: '100%', margin: '0 auto', padding: '20px 20px 110px' }}>
        {loading ? (
          <p style={{ fontSize: 14, color: 'var(--color-secondary)' }}>Loading…</p>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <p style={{ fontSize: 13, color: 'var(--color-secondary)' }}>
              This is the number drivers and support use to reach you. Changing it doesn't require re-verification.
            </p>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-secondary)', display: 'block', marginBottom: 6 }}>Mobile Number</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} required
                style={{ width: '100%', height: 48, padding: '0 14px', border: '1px solid var(--color-outline-variant)', borderRadius: 10, fontSize: 15, color: 'var(--color-on-surface)', boxSizing: 'border-box' }} />
            </div>

            {error && <p style={{ fontSize: 13, color: 'var(--color-error)' }}>{error}</p>}
            {saved && <p style={{ fontSize: 13, color: 'var(--color-primary)' }}>Saved.</p>}

            <button type="submit" disabled={saving || !phone.trim()}
              style={{ height: 48, background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, marginTop: 8 }}>
              {saving ? 'Saving…' : 'Save Number'}
            </button>
          </form>
        )}
      </main>

      <RiderBottomNav active="profile" />
    </div>
  )
}
