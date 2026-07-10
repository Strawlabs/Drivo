import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth.jsx'
import { fetchNotifications, markRead, markArchived, markAllRead, subscribeToNotifications, NOTIFICATION_CATEGORIES } from '@/lib/notifications'

const CATEGORY_ICON = {
  ride_alert: '🚗', payment: '💳', subscription: '🎖️', driver_request: '📥',
  family: '👨‍👩‍👧', safety: '🛡️', advertising: '📣', system: '⚙️',
}

const CATEGORY_LABEL = {
  ride_alert: 'Ride', payment: 'Payment', subscription: 'Subscription', driver_request: 'Driver Request',
  family: 'Family', safety: 'Safety', advertising: 'Advertising', system: 'System',
}

const FILTERS = ['unread', 'read', 'archived']

export default function NotificationsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [filter, setFilter] = useState('unread')
  const [category, setCategory] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    const data = await fetchNotifications(user.id, { filter, category })
    setItems(data)
    setLoading(false)
  }, [user, filter, category])

  useEffect(() => { setLoading(true); load() }, [load])

  // Live in-app delivery — prepend new notifications while this page is open.
  useEffect(() => {
    if (!user) return
    const unsubscribe = subscribeToNotifications(user.id, row => {
      if (filter === 'unread' && (!category || row.category === category)) {
        setItems(prev => [row, ...prev])
      }
    })
    return unsubscribe
  }, [user, filter, category])

  async function handleMarkRead(id) {
    await markRead(id)
    if (filter === 'unread') setItems(prev => prev.filter(n => n.id !== id))
    else load()
  }

  async function handleArchive(id) {
    await markArchived(id)
    setItems(prev => prev.filter(n => n.id !== id))
  }

  async function handleMarkAllRead() {
    if (!user) return
    await markAllRead(user.id)
    if (filter === 'unread') setItems([])
    else load()
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-background)', fontFamily: 'var(--font-sans)' }}>

      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 px-5 py-3"
        style={{ background: 'var(--color-surface)', boxShadow: '0 1px 0 var(--color-surface-container-low)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-surface-container-low)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-on-surface)' }}>🔔 Notifications</h1>
        </div>
        {filter === 'unread' && items.length > 0 && (
          <button onClick={handleMarkAllRead} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Mark all read
          </button>
        )}
      </header>

      <main style={{ maxWidth: 480, width: '100%', margin: '0 auto', padding: '16px 20px 60px' }}>

        {/* Status filter tabs */}
        <div className="flex gap-2 mb-3" style={{ background: 'var(--color-surface-container)', borderRadius: 9999, padding: 3 }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ flex: 1, padding: '8px 0', borderRadius: 9999, border: 'none', fontSize: 13, fontWeight: 700, textTransform: 'capitalize', cursor: 'pointer', background: filter === f ? 'var(--color-primary)' : 'transparent', color: filter === f ? 'white' : 'var(--color-secondary)', transition: 'all 0.15s' }}>
              {f}
            </button>
          ))}
        </div>

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto mb-4" style={{ scrollbarWidth: 'none' }}>
          <button onClick={() => setCategory(null)}
            style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 9999, border: `1px solid ${!category ? 'var(--color-primary)' : 'var(--color-outline-variant)'}`, background: !category ? 'rgba(0,109,55,0.08)' : 'white', color: !category ? 'var(--color-primary)' : 'var(--color-on-surface)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            All
          </button>
          {NOTIFICATION_CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c === category ? null : c)}
              style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 9999, border: `1px solid ${category === c ? 'var(--color-primary)' : 'var(--color-outline-variant)'}`, background: category === c ? 'rgba(0,109,55,0.08)' : 'white', color: category === c ? 'var(--color-primary)' : 'var(--color-on-surface)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {CATEGORY_ICON[c]} {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--color-secondary)', textAlign: 'center', marginTop: 40 }}>Loading…</p>
        ) : items.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--color-secondary)', textAlign: 'center', marginTop: 40 }}>
            No {filter} notifications{category ? ` in ${CATEGORY_LABEL[category]}` : ''}.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map(n => (
              <div key={n.id} style={{ background: 'white', border: '1px solid rgba(241,245,249,1)', borderRadius: 14, padding: 14, boxShadow: '0 2px 8px rgba(26,43,60,0.05)', display: 'flex', gap: 12 }}>
                <div style={{ fontSize: 22, flexShrink: 0 }}>{CATEGORY_ICON[n.category] ?? '🔔'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-start justify-between gap-2">
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-on-surface)' }}>{n.title}</p>
                    {!n.is_read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, marginTop: 5 }} />}
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--color-secondary)', marginTop: 2 }}>{n.body}</p>
                  <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>
                      {new Date(n.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div className="flex gap-3">
                      {!n.is_read && (
                        <button onClick={() => handleMarkRead(n.id)} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>Mark read</button>
                      )}
                      {filter !== 'archived' && (
                        <button onClick={() => handleArchive(n.id)} style={{ background: 'none', border: 'none', color: 'var(--color-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>Archive</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
