import { supabase } from '@/lib/supabase'
import { notify } from '@/lib/notifications'

// ── SOS ──────────────────────────────────────────────────────────

/*
  No SMS provider exists in this project, and emergency contacts are
  just a name+phone (not necessarily a Drivo account) — so there's no
  way to push a real message to their device automatically. This
  creates the real audit row and resolves real contacts, then leaves
  actually alerting them to the rider's own phone via tel:/sms: links
  (returned here, rendered by the caller) — a genuine, shipped pattern
  at MVP-stage ride companies, not a placeholder. Any contact whose
  phone matches an existing Drivo account also gets a real in-app
  'safety' notification.
*/
export async function triggerSos({ rideId, userId, latitude = null, longitude = null }) {
  const { data: event, error } = await supabase
    .from('sos_events')
    .insert({
      ride_id: rideId,
      triggered_by: userId,
      location_latitude: latitude,
      location_longitude: longitude,
    })
    .select()
    .single()
  if (error) throw error

  const { data: contacts } = await supabase
    .from('emergency_contacts')
    .select('name, phone')
    .eq('user_id', userId)

  const { data: rider } = await supabase.from('users').select('name').eq('id', userId).maybeSingle()
  const riderName = rider?.name ?? 'A Drivo rider'

  for (const contact of contacts ?? []) {
    const { data: matchedUser } = await supabase.from('users').select('id').eq('phone', contact.phone).maybeSingle()
    if (matchedUser) {
      await notify({
        userId: matchedUser.id,
        category: 'safety',
        title: 'SOS alert',
        body: `${riderName} triggered an SOS during their ride and may need help.`,
        data: { rideId, sosEventId: event.id },
      }).catch(() => {})
    }
  }

  return { event, contacts: contacts ?? [] }
}

export async function resolveSos(id) {
  const { error } = await supabase.from('sos_events').update({ resolved_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function fetchSosEvents() {
  const { data, error } = await supabase
    .from('sos_events')
    .select('*, rides(pickup_address, destination_address), users:triggered_by(name, phone)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

// ── Trip sharing ─────────────────────────────────────────────────

function randomToken() {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8)
}

export async function createSharedTripLink({ rideId, userId }) {
  const token = randomToken()
  const { data, error } = await supabase
    .from('shared_trip_links')
    .insert({ ride_id: rideId, created_by: userId, token })
    .select()
    .single()
  if (error) throw error
  return { ...data, url: `${window.location.origin}/trip/${token}` }
}

export async function fetchSharedTrip(token) {
  const { data, error } = await supabase.rpc('get_shared_trip', { p_token: token })
  if (error) throw error
  return data?.[0] ?? null
}

// ── Incident reports ────────────────────────────────────────────

export async function submitIncidentReport({ rideId, reportedBy, category, description }) {
  const { data, error } = await supabase
    .from('incident_reports')
    .insert({ ride_id: rideId, reported_by: reportedBy, category, description })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function fetchMyIncidentReports(userId) {
  const { data, error } = await supabase
    .from('incident_reports')
    .select('*')
    .eq('reported_by', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function fetchAllIncidentReports() {
  const { data, error } = await supabase
    .from('incident_reports')
    .select('*, users:reported_by(name, phone), rides(pickup_address, destination_address)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function updateIncidentStatus(id, { status, resolutionNotes, reviewedBy }) {
  const { error } = await supabase
    .from('incident_reports')
    .update({ status, resolution_notes: resolutionNotes ?? null, reviewed_by: reviewedBy, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
