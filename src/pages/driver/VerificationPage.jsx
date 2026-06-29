import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth.jsx'

const DOCS = [
  {
    id: 'license',
    label: "Driver's License",
    hint: 'Front and back of your DL',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5">
        <rect x="2" y="5" width="20" height="14" rx="2"/>
        <circle cx="8" cy="12" r="2"/>
        <path d="M13 10h4M13 14h3"/>
      </svg>
    ),
  },
  {
    id: 'insurance',
    label: 'Vehicle Insurance',
    hint: 'Valid insurance certificate',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5">
        <path d="M12 2l7 4v5c0 5-4 9-7 10C9 20 5 16 5 11V6l7-4z"/>
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'ev_cert',
    label: 'EV Certification',
    hint: 'Electric vehicle training certificate',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
]

function UploadSheet({ doc, onClose, onSave }) {
  const [fileName, setFileName] = useState(null)
  const [file, setFile] = useState(null)

  function handleFileChange(e) {
    const f = e.target.files?.[0]
    if (f) { setFileName(f.name); setFile(f) }
  }

  return (
    <>
      {/* Scrim */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(11,28,48,0.45)', backdropFilter: 'blur(4px)', zIndex: 100 }} />
      {/* Sheet */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--color-surface)', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: '16px 20px 40px', zIndex: 101, boxShadow: '0 -10px 40px rgba(26,43,60,0.15)' }}>
        <div style={{ width: 40, height: 4, background: 'var(--color-outline-variant)', borderRadius: 2, margin: '0 auto 20px' }} />
        <h4 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: 6 }}>Upload {doc.label}</h4>
        <p style={{ fontSize: 14, color: 'var(--color-secondary)', marginBottom: 24 }}>{doc.hint}</p>

        <label htmlFor="file-upload" style={{ cursor: 'pointer' }}>
          <div style={{ border: '2px dashed var(--color-outline-variant)', borderRadius: 16, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, transition: 'border-color 0.2s', background: fileName ? 'rgba(46,204,113,0.05)' : 'transparent' }}>
            {fileName ? (
              <>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(46,204,113,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-on-surface)' }}>{fileName}</p>
                <p style={{ fontSize: 12, color: 'var(--color-secondary)' }}>Tap to change file</p>
              </>
            ) : (
              <>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-surface-container)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-on-surface)' }}>Take Photo or Upload</p>
                <p style={{ fontSize: 12, color: 'var(--color-secondary)' }}>PDF, JPG, or PNG · Max 5 MB</p>
              </>
            )}
          </div>
          <input id="file-upload" type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFileChange} />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 20 }}>
          <button onClick={onClose} style={{ height: 52, borderRadius: 12, border: '1px solid var(--color-outline)', background: 'none', fontSize: 15, fontWeight: 600, color: 'var(--color-on-surface)', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={() => { if (file) onSave(doc.id, file); onClose() }} disabled={!file} style={{ height: 52, borderRadius: 12, border: 'none', background: file ? 'var(--color-primary)' : 'var(--color-outline-variant)', color: 'white', fontSize: 15, fontWeight: 600, cursor: file ? 'pointer' : 'not-allowed' }}>
            Save
          </button>
        </div>
      </div>
    </>
  )
}

function SubmittedState({ onGoHome }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', textAlign: 'center' }}>
      {/* Animated ring */}
      <div style={{ position: 'relative', width: 100, height: 100, marginBottom: 28 }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(46,204,113,0.15)', animation: 'verifyPulse 2.5s ease-in-out infinite' }} />
        <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'var(--color-primary-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="var(--color-on-primary-container)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      </div>
      <h2 style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: 10 }}>Application Sent!</h2>
      <p style={{ fontSize: 15, color: 'var(--color-secondary)', lineHeight: 1.6, marginBottom: 36, maxWidth: 300 }}>
        Your documents are under review. We'll notify you within <strong>24–48 hours</strong> once your profile is activated.
      </p>

      {/* Status Timeline */}
      <div style={{ width: '100%', maxWidth: 320, textAlign: 'left', marginBottom: 36 }}>
        {[
          { label: 'Documents submitted', done: true },
          { label: 'Identity verification', done: false, active: true },
          { label: 'Vehicle inspection', done: false },
          { label: 'Profile activated', done: false },
        ].map((step, i) => (
          <div key={i} className="flex items-start gap-3" style={{ marginBottom: i < 3 ? 16 : 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: step.done ? 'var(--color-primary)' : step.active ? 'var(--color-primary-container)' : 'var(--color-surface-container)', border: step.active ? '2px solid var(--color-primary)' : 'none', flexShrink: 0 }}>
                {step.done ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
                ) : step.active ? (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)' }} />
                ) : null}
              </div>
              {i < 3 && <div style={{ width: 2, height: 16, background: step.done ? 'var(--color-primary)' : 'var(--color-surface-container-high)', marginTop: 2 }} />}
            </div>
            <p style={{ fontSize: 14, fontWeight: step.active ? 600 : 400, color: step.done || step.active ? 'var(--color-on-surface)' : 'var(--color-secondary)', paddingTop: 2 }}>{step.label}</p>
          </div>
        ))}
      </div>

      <div style={{ width: '100%', maxWidth: 320, background: 'rgba(212,228,251,0.4)', border: '1px solid var(--color-secondary-container)', borderRadius: 12, padding: 16, marginBottom: 28 }}>
        <p style={{ fontSize: 13, color: 'var(--color-on-secondary-container)', lineHeight: 1.5 }}>
          You'll receive a push notification and email at the address linked to your account.
        </p>
      </div>

      <button onClick={onGoHome} style={{ width: '100%', maxWidth: 320, height: 52, background: 'var(--color-primary)', color: 'white', borderRadius: 12, border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
        Done
      </button>
    </div>
  )
}

export default function DriverVerificationPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [openDoc, setOpenDoc] = useState(null)
  const [uploaded, setUploaded] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('driver_profiles').select('kyc_status').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data?.kyc_status === 'approved') navigate('/driver/home', { replace: true })
      })
  }, [user])

  const allUploaded = DOCS.every(d => uploaded[d.id])

  function handleSaveDoc(id, file) {
    setUploaded(prev => ({ ...prev, [id]: file }))
  }

  async function handleSubmit() {
    if (submitting || !user) return
    setSubmitting(true)

    try {
      // 1. Upload each file to Supabase Storage
      for (const doc of DOCS) {
        const file = uploaded[doc.id]
        if (!file) continue
        const ext = file.name.split('.').pop()
        const path = `${user.id}/${doc.id}.${ext}`
        const { error } = await supabase.storage.from('kyc-documents').upload(path, file, { upsert: true })
        if (error) throw error
      }

      // 2. Get driver profile id
      const { data: profile } = await supabase
        .from('driver_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single()

      // 3. Update KYC status to submitted
      if (profile) {
        await supabase
          .from('driver_profiles')
          .update({ kyc_status: 'submitted' })
          .eq('id', profile.id)
      }

      setSubmitted(true)
    } catch (err) {
      alert('Upload failed: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--color-background)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' }}>
        <style>{`@keyframes verifyPulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.15);opacity:0.6} }`}</style>
        <header style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--color-surface)', boxShadow: '0 1px 0 var(--color-surface-container-low)' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: 'white', fontSize: 18 }}>D</span>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-on-surface)' }}>Drivo</h1>
        </header>
        <SubmittedState onGoHome={() => navigate('/driver/home')} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-background)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' }}>
      <style>{`@keyframes verifyPulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.15);opacity:0.6} }`}</style>

      {/* Upload Sheet */}
      {openDoc && (
        <UploadSheet
          doc={DOCS.find(d => d.id === openDoc)}
          onClose={() => setOpenDoc(null)}
          onSave={handleSaveDoc}
        />
      )}

      {/* Header */}
      <header style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-surface)', boxShadow: '0 1px 0 var(--color-surface-container-low)', position: 'sticky', top: 0, zIndex: 40 }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: '50%', background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-on-surface)' }}>Drivo</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={async () => { await supabase.auth.signOut(); navigate('/login') }}
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-error)', background: 'none', border: '1px solid var(--color-error)', borderRadius: 9999, padding: '5px 14px', cursor: 'pointer' }}>
            Sign Out
          </button>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14, border: '2px solid var(--color-primary-container)' }}>
            {user?.email?.[0]?.toUpperCase() ?? 'D'}
          </div>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: 480, width: '100%', margin: '0 auto', padding: '28px 20px 120px' }}>

        {/* Progress Stepper */}
        <section style={{ marginBottom: 32, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 20, left: 20, right: 20, height: 2, background: 'var(--color-surface-container-high)', zIndex: 0 }}>
            <div style={{ height: '100%', width: '75%', background: 'var(--color-primary-container)', transition: 'width 0.6s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
            {[
              { label: 'Personal', done: true },
              { label: 'Vehicle', done: true },
              { label: 'Documents', done: false, active: true },
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, background: step.done ? 'var(--color-primary)' : 'var(--color-primary-container)', color: step.done ? 'white' : 'var(--color-on-primary-container)', boxShadow: step.active ? '0 0 0 4px rgba(46,204,113,0.2)' : 'none' }}>
                  {step.done ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg> : '3'}
                </div>
                <span style={{ fontSize: 11, fontWeight: step.active ? 700 : 500, color: step.active ? 'var(--color-primary)' : 'var(--color-on-surface)', letterSpacing: '0.04em' }}>{step.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Page Header */}
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: 6 }}>Verification</h2>
          <p style={{ fontSize: 15, color: 'var(--color-secondary)' }}>Upload your credentials to start driving with Drivo's premium EV fleet.</p>
        </div>

        {/* Document Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {DOCS.map(doc => {
            const isUploaded = uploaded[doc.id]
            return (
              <button key={doc.id} onClick={() => setOpenDoc(doc.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, borderRadius: 14, border: `1px solid ${isUploaded ? 'var(--color-primary)' : 'var(--color-outline-variant)'}`, background: isUploaded ? 'rgba(46,204,113,0.05)' : 'rgba(255,255,255,0.8)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', backdropFilter: 'blur(8px)' }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--color-surface-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {doc.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-on-surface)', marginBottom: 4 }}>{doc.label}</p>
                  <div className="flex items-center gap-1.5">
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: isUploaded ? 'var(--color-primary)' : 'var(--color-primary)', flexShrink: 0, animation: isUploaded ? 'none' : 'verifyPulse 2.5s infinite' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: isUploaded ? 'var(--color-primary)' : 'var(--color-primary)' }}>
                      {isUploaded ? 'Ready to submit' : 'Upload Required'}
                    </span>
                  </div>
                </div>
                {isUploaded ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-secondary)" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                )}
              </button>
            )
          })}
        </div>

        {/* Info Box */}
        <div style={{ display: 'flex', gap: 12, padding: 16, background: 'rgba(210,228,251,0.35)', border: '1px solid var(--color-secondary-container)', borderRadius: 12, marginBottom: 16 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-secondary-container)" strokeWidth="1.5" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01" strokeLinecap="round"/></svg>
          <p style={{ fontSize: 13, color: 'var(--color-on-secondary-container)', lineHeight: 1.5 }}>
            Verification usually takes 24–48 hours. We'll notify you via push notification once your profile is active.
          </p>
        </div>
      </main>

      {/* Sticky Submit Button */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16px 20px 32px', background: 'linear-gradient(to top, var(--color-surface) 70%, transparent)', zIndex: 30 }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <button onClick={handleSubmit} disabled={submitting}
            style={{ width: '100%', height: 56, borderRadius: 14, border: 'none', fontSize: 16, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, transition: 'all 0.2s', background: allUploaded ? 'var(--color-primary)' : 'var(--color-on-surface)', color: 'white', opacity: submitting ? 0.8 : 1, boxShadow: '0 4px 16px rgba(11,28,48,0.2)' }}>
            {submitting ? (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.3"/><path d="M21 12a9 9 0 00-9-9" strokeLinecap="round"/></svg>
                Processing...
              </>
            ) : (
              <>
                Submit for Verification
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/></svg>
              </>
            )}
          </button>
          {!allUploaded && (
            <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-secondary)', marginTop: 8 }}>
              Upload all {DOCS.length} documents to submit
            </p>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  )
}
