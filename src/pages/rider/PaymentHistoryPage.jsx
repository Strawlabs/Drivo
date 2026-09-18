import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth.jsx'
import RiderBottomNav from '@/components/RiderBottomNav'

const STATUS_COLOR = {
  completed: { bg: 'rgba(46,204,113,0.12)', color: 'var(--color-primary)' },
  pending:   { bg: 'rgba(245,158,11,0.12)', color: '#B45309' },
  flagged:   { bg: 'rgba(186,26,26,0.1)', color: 'var(--color-error)' },
  failed:    { bg: 'rgba(186,26,26,0.1)', color: 'var(--color-error)' },
}

/*
  "Payment Methods" never had anything real to manage — there's no
  saved-card/saved-UPI concept anywhere in this app's data model, only
  a self-reported UPI reference or cash confirmed per ride (see
  src/lib/payments.js). Rather than build a fake "add a card" flow with
  nothing behind it, this shows the real thing a rider actually has:
  their payment history, with receipts where one exists.
*/
export default function PaymentHistoryPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [payments, setPayments] = useState([])

  useEffect(() => {
    if (!user) return
    supabase
      .from('payments')
      .select('id, amount, method, status, upi_reference, paid_at, created_at, rides(pickup_address, destination_address), receipts(receipt_url)')
      .eq('rider_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setPayments(data ?? []); setLoading(false) })
  }, [user])

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-background)', fontFamily: 'var(--font-sans)' }}>
      <header className="sticky top-0 z-40 flex items-center gap-3 px-5 py-3"
        style={{ background: 'var(--color-surface)', boxShadow: '0 1px 0 var(--color-surface-container-low)' }}>
        <button onClick={() => navigate(-1)}
          style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-surface-container-low)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-on-surface)' }}>Payment History</h1>
      </header>

      <main style={{ maxWidth: 480, width: '100%', margin: '0 auto', padding: '20px 20px 110px' }}>
        <p style={{ fontSize: 13, color: 'var(--color-secondary)', marginBottom: 16 }}>
          Drivo never stores a card or UPI ID for you — every ride is paid via UPI or cash and confirmed individually. This is your record of those payments.
        </p>

        {loading && <p style={{ fontSize: 14, color: 'var(--color-secondary)' }}>Loading…</p>}
        {!loading && payments.length === 0 && (
          <p style={{ fontSize: 14, color: 'var(--color-secondary)' }}>No payments yet.</p>
        )}

        <div className="flex flex-col gap-3">
          {payments.map(p => {
            const colors = STATUS_COLOR[p.status] ?? STATUS_COLOR.pending
            return (
              <div key={p.id} style={{ background: 'white', borderRadius: 14, padding: 16, boxShadow: '0 1px 6px rgba(26,43,60,0.06)' }}>
                <div className="flex justify-between items-start" style={{ marginBottom: 6 }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-on-surface)' }}>₹{Number(p.amount).toFixed(2)}</p>
                    <p style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 2 }}>
                      {p.rides?.pickup_address ?? '—'} → {p.rides?.destination_address ?? '—'}
                    </p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: colors.color, background: colors.bg, padding: '3px 10px', borderRadius: 6 }}>{p.status}</span>
                </div>
                <div className="flex justify-between items-center" style={{ marginTop: 10 }}>
                  <p style={{ fontSize: 12, color: 'var(--color-secondary)' }}>
                    {p.method === 'upi' ? `UPI · ${p.upi_reference ?? '—'}` : 'Cash'} · {new Date(p.paid_at ?? p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  {p.receipts?.[0]?.receipt_url && (
                    <button onClick={() => window.open(p.receipts[0].receipt_url, '_blank')}
                      style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                      Receipt
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </main>

      <RiderBottomNav active="profile" />
    </div>
  )
}
