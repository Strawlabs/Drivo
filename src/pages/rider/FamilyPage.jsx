import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth.jsx'
import {
  fetchFamilyMembers, fetchPendingInvitesSent, fetchPendingInvitesReceived,
  addFamilyMember, approveFamilyInvite, declineFamilyInvite, removeFamilyMember,
  fetchEmergencyContacts, addEmergencyContact, deleteEmergencyContact,
  fetchActiveFamilyRide, fetchUpcomingScheduledRides, cancelScheduledRide,
} from '@/lib/family'

function Card({ children, style }) {
  return (
    <div style={{ background: 'white', border: '1px solid rgba(241,245,249,1)', borderRadius: 14, padding: 16, boxShadow: '0 2px 8px rgba(26,43,60,0.05)', ...style }}>
      {children}
    </div>
  )
}

function SectionTitle({ children, action }) {
  return (
    <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-on-surface)' }}>{children}</h3>
      {action}
    </div>
  )
}

const SCHEDULED_STATUS_LABEL = {
  scheduled: { text: 'Confirmed', color: 'var(--color-primary)', bg: 'rgba(46,204,113,0.12)' },
  dispatched: { text: 'In progress', color: 'var(--color-primary)', bg: 'rgba(46,204,113,0.12)' },
  driver_cancelled: { text: 'Driver cancelled', color: 'var(--color-error)', bg: 'rgba(186,26,26,0.1)' },
}

export default function FamilyPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState([])
  const [invitesSent, setInvitesSent] = useState([])
  const [invitesReceived, setInvitesReceived] = useState([])
  const [activeRide, setActiveRide] = useState(null)
  const [contacts, setContacts] = useState([])
  const [scheduledRides, setScheduledRides] = useState([])

  const [showAddMember, setShowAddMember] = useState(false)
  const [memberPhone, setMemberPhone] = useState('')
  const [addMemberError, setAddMemberError] = useState('')
  const [addingMember, setAddingMember] = useState(false)

  const [showEditContacts, setShowEditContacts] = useState(false)
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [addContactError, setAddContactError] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    const [m, sent, received, ride, ec, sr] = await Promise.all([
      fetchFamilyMembers(user.id),
      fetchPendingInvitesSent(user.id),
      fetchPendingInvitesReceived(user.id),
      fetchActiveFamilyRide(user.id),
      fetchEmergencyContacts(user.id),
      fetchUpcomingScheduledRides(user.id),
    ])
    setMembers(m)
    setInvitesSent(sent)
    setInvitesReceived(received)
    setActiveRide(ride)
    setContacts(ec)
    setScheduledRides(sr)
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  async function handleAddMember() {
    if (addingMember || !memberPhone.trim()) return
    setAddingMember(true)
    setAddMemberError('')
    try {
      await addFamilyMember({ primaryUserId: user.id, phone: memberPhone.trim() })
      setMemberPhone('')
      setShowAddMember(false)
      await load()
    } catch (err) {
      setAddMemberError(err.message)
    } finally {
      setAddingMember(false)
    }
  }

  async function handleApprove(id) { await approveFamilyInvite(id); await load() }
  async function handleDecline(id) { await declineFamilyInvite(id); await load() }
  async function handleRemoveMember(id) { await removeFamilyMember(id); await load() }

  async function handleAddContact() {
    if (!contactName.trim() || !contactPhone.trim()) return
    setAddContactError('')
    try {
      await addEmergencyContact({ userId: user.id, name: contactName.trim(), phone: contactPhone.trim() })
      setContactName('')
      setContactPhone('')
      await load()
    } catch (err) {
      setAddContactError(err.message)
    }
  }

  async function handleDeleteContact(id) { await deleteEmergencyContact(id); await load() }
  async function handleCancelScheduled(id) { await cancelScheduledRide(id); await load() }

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-background)' }}>
        <p style={{ color: 'var(--color-secondary)' }}>Loading…</p>
      </div>
    )
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
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-on-surface)' }}>👨‍👩‍👧 Family Dashboard</h1>
          <p style={{ fontSize: 12, color: 'var(--color-secondary)' }}>Keep your loved ones safe and coordinated</p>
        </div>
      </header>

      <main style={{ maxWidth: 480, width: '100%', margin: '0 auto', padding: '20px 20px 60px' }}>

        {/* Add Family Member */}
        <button onClick={() => { setShowAddMember(s => !s); setAddMemberError('') }}
          style={{ width: '100%', height: 52, background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: showAddMember ? 12 : 24 }}>
          👥 Add Family Member
        </button>

        {showAddMember && (
          <Card style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 13, color: 'var(--color-secondary)', marginBottom: 8 }}>Enter the phone number of an existing Drivo rider account.</p>
            <input type="tel" placeholder="Phone number" value={memberPhone} onChange={e => setMemberPhone(e.target.value)}
              style={{ width: '100%', height: 44, padding: '0 12px', background: '#F8F9FA', border: 'none', borderRadius: 10, fontSize: 14, marginBottom: 8, boxSizing: 'border-box' }} />
            {addMemberError && <p style={{ fontSize: 12, color: 'var(--color-error)', marginBottom: 8 }}>{addMemberError}</p>}
            <button onClick={handleAddMember} disabled={addingMember}
              style={{ width: '100%', height: 40, background: 'var(--color-primary-container)', color: 'var(--color-on-primary-container)', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: addingMember ? 'not-allowed' : 'pointer' }}>
              {addingMember ? 'Sending invite…' : 'Send Invite'}
            </button>
          </Card>
        )}

        {/* Pending invitations received (for me to approve) */}
        {invitesReceived.length > 0 && (
          <section style={{ marginBottom: 24 }}>
            <SectionTitle>Family Invitations</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {invitesReceived.map(inv => (
                <Card key={inv.id}>
                  <p style={{ fontSize: 14, color: 'var(--color-on-surface)', marginBottom: 10 }}><strong>{inv.ownerName}</strong> wants to add you as a family member.</p>
                  <div className="flex gap-8">
                    <button onClick={() => handleDecline(inv.id)} style={{ flex: 1, height: 36, background: 'none', border: '1px solid var(--color-outline-variant)', borderRadius: 9999, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Decline</button>
                    <button onClick={() => handleApprove(inv.id)} style={{ flex: 1, height: 36, background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 9999, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Approve</button>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Live Now */}
        {activeRide && (
          <Card style={{ background: 'linear-gradient(135deg, #0f1923 0%, #1a2b1a 100%)', color: 'white', marginBottom: 24, border: 'none' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#4ae183', marginBottom: 10 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ae183', display: 'inline-block' }} />
              LIVE NOW: {activeRide.riderName}'S RIDE
            </span>
            <div className="flex items-end justify-between">
              <div>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Destination</p>
                <p style={{ fontSize: 16, fontWeight: 700 }}>{activeRide.destination_address ?? 'En route'}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Members */}
        <section style={{ marginBottom: 24 }}>
          <SectionTitle>Members</SectionTitle>
          {members.length === 0 && invitesSent.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--color-secondary)' }}>No family members yet — add one above.</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {members.map(m => (
              <Card key={m.id}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>{m.avatar}</div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-on-surface)' }}>{m.name}</p>
                      <p style={{ fontSize: 12, color: 'var(--color-secondary)' }}>
                        {m.lastRideAt ? `Last ride: ${new Date(m.lastRideAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'No rides yet'}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => handleRemoveMember(m.id)}
                    style={{ padding: '6px 12px', background: 'none', border: '1px solid var(--color-outline-variant)', borderRadius: 9999, fontSize: 12, fontWeight: 600, color: 'var(--color-error)', cursor: 'pointer' }}>
                    Remove
                  </button>
                </div>
              </Card>
            ))}
            {invitesSent.map(inv => (
              <Card key={inv.id} style={{ opacity: 0.7 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-on-surface)' }}>{inv.name}</p>
                <p style={{ fontSize: 12, color: 'var(--color-secondary)', fontStyle: 'italic' }}>Waiting for approval…</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Safety Net */}
        <section style={{ marginBottom: 24 }}>
          <SectionTitle action={
            <button onClick={() => setShowEditContacts(s => !s)} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {showEditContacts ? 'Done' : 'Edit'}
            </button>
          }>Safety Net</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {contacts.length === 0 && <p style={{ fontSize: 13, color: 'var(--color-secondary)' }}>No emergency contacts added yet.</p>}
            {contacts.map(c => (
              <Card key={c.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-on-surface)' }}>{c.name}</p>
                    <p style={{ fontSize: 12, color: 'var(--color-secondary)' }}>{c.phone}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <a href={`tel:${c.phone}`} style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-primary-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>📞</a>
                    {showEditContacts && (
                      <button onClick={() => handleDeleteContact(c.id)} style={{ background: 'none', border: 'none', color: 'var(--color-error)', cursor: 'pointer', fontSize: 13 }}>✕</button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
            {showEditContacts && (
              <Card>
                <input type="text" placeholder="Name" value={contactName} onChange={e => setContactName(e.target.value)}
                  style={{ width: '100%', height: 40, padding: '0 12px', background: '#F8F9FA', border: 'none', borderRadius: 10, fontSize: 14, marginBottom: 8, boxSizing: 'border-box' }} />
                <input type="tel" placeholder="Phone" value={contactPhone} onChange={e => setContactPhone(e.target.value)}
                  style={{ width: '100%', height: 40, padding: '0 12px', background: '#F8F9FA', border: 'none', borderRadius: 10, fontSize: 14, marginBottom: 8, boxSizing: 'border-box' }} />
                {addContactError && <p style={{ fontSize: 12, color: 'var(--color-error)', marginBottom: 8 }}>{addContactError}</p>}
                <button onClick={handleAddContact} style={{ width: '100%', height: 36, background: 'var(--color-primary-container)', color: 'var(--color-on-primary-container)', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Add Contact</button>
              </Card>
            )}
          </div>
        </section>

        {/* Scheduled */}
        <section>
          <SectionTitle action={
            <button onClick={() => navigate('/rider/schedule')} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Schedule New</button>
          }>Scheduled Rides</SectionTitle>
          {scheduledRides.length === 0 && <p style={{ fontSize: 13, color: 'var(--color-secondary)' }}>No upcoming scheduled rides.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {scheduledRides.map(sr => {
              const label = SCHEDULED_STATUS_LABEL[sr.status] ?? { text: sr.status, color: 'var(--color-secondary)', bg: 'var(--color-surface-container-low)' }
              return (
                <Card key={sr.id}>
                  <div className="flex items-start justify-between" style={{ marginBottom: 6 }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-on-surface)' }}>{sr.pickup} → {sr.destination}</p>
                      <p style={{ fontSize: 12, color: 'var(--color-secondary)' }}>{new Date(sr.scheduledAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {sr.riderName} · {sr.driverName}</p>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 9999, background: label.bg, color: label.color, whiteSpace: 'nowrap' }}>{label.text}</span>
                  </div>
                  {sr.status === 'driver_cancelled' && (
                    <p style={{ fontSize: 12, color: 'var(--color-error)', marginBottom: 8 }}>{sr.cancellationReason ?? 'The driver cancelled this ride.'} Please reschedule.</p>
                  )}
                  {sr.status === 'scheduled' && (
                    <button onClick={() => handleCancelScheduled(sr.id)} style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Cancel</button>
                  )}
                </Card>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}
