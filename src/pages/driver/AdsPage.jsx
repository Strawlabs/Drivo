import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth.jsx'
import { fetchMyCampaignAssignments, respondToAssignment } from '@/lib/ads'

const STATUS_LABEL = {
  pending: { text: 'Awaiting your response', color: '#b45309', bg: 'rgba(245,158,11,0.14)' },
  accepted: { text: 'Accepted', color: 'var(--color-primary)', bg: 'rgba(46,204,113,0.12)' },
  rejected: { text: 'Declined', color: 'var(--color-secondary)', bg: 'var(--color-surface-container-low)' },
  completed: { text: 'Completed', color: 'var(--color-primary)', bg: 'rgba(46,204,113,0.12)' },
}

export default function DriverAdsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [driverProfileId, setDriverProfileId] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [respondingId, setRespondingId] = useState(null)

  const load = useCallback(async (id) => {
    const data = await fetchMyCampaignAssignments(id)
    setAssignments(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!user) return
    supabase.from('driver_profiles').select('id').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data?.id) { setDriverProfileId(data.id); load(data.id) }
      })
  }, [user, load])

  async function handleRespond(id, status) {
    setRespondingId(id)
    await respondToAssignment(id, status)
    await load(driverProfileId)
    setRespondingId(null)
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-background)', fontFamily: 'var(--font-sans)' }}>
      <header className="sticky top-0 z-40 flex items-center gap-3 px-5 py-3"
        style={{ background: 'var(--color-surface)', boxShadow: '0 1px 0 var(--color-surface-container-low)' }}>
        <button onClick={() => navigate(-1)}
          style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-surface-container-low)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-on-surface)' }}>📣 Ads</h1>
          <p style={{ fontSize: 12, color: 'var(--color-secondary)' }}>Ad campaign offers, Elite plan benefit</p>
        </div>
      </header>

      <main style={{ maxWidth: 480, width: '100%', margin: '0 auto', padding: '16px 20px 60px' }}>
        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--color-secondary)', textAlign: 'center', marginTop: 40 }}>Loading…</p>
        ) : assignments.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--color-secondary)', textAlign: 'center', marginTop: 40 }}>
            No ad campaign offers yet — this is an Elite-plan benefit, offered by Drivo when a campaign is available in your area.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {assignments.map(a => {
              const label = STATUS_LABEL[a.status] ?? { text: a.status, color: 'var(--color-secondary)', bg: 'var(--color-surface-container-low)' }
              return (
                <div key={a.id} style={{ background: 'white', border: '1px solid rgba(241,245,249,1)', borderRadius: 14, padding: 16, boxShadow: '0 2px 8px rgba(26,43,60,0.05)' }}>
                  <div className="flex items-start justify-between" style={{ marginBottom: 6 }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-on-surface)' }}>{a.title}</p>
                      {a.description && <p style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 2 }}>{a.description}</p>}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 9999, background: label.bg, color: label.color, whiteSpace: 'nowrap' }}>{label.text}</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--color-secondary)', marginBottom: 10 }}>{a.revenueSharePercent}% revenue share{a.earningsCredited ? ` · ₹${a.earningsCredited} credited` : ''}</p>
                  {a.status === 'pending' && (
                    <div className="flex gap-3">
                      <button onClick={() => handleRespond(a.id, 'rejected')} disabled={respondingId === a.id}
                        style={{ flex: 1, height: 40, background: 'none', border: '1px solid var(--color-outline-variant)', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                        Decline
                      </button>
                      <button onClick={() => handleRespond(a.id, 'accepted')} disabled={respondingId === a.id}
                        style={{ flex: 1, height: 40, background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                        Accept
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
