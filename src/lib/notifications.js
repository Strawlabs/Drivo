import { supabase } from '@/lib/supabase'

export const NOTIFICATION_CATEGORIES = [
  'ride_alert', 'payment', 'subscription', 'driver_request',
  'family', 'safety', 'advertising', 'system',
]

/*
  filter: 'unread' | 'read' | 'archived' | 'all'
  category: one of NOTIFICATION_CATEGORIES, or null/undefined for all
*/
export async function fetchNotifications(userId, { filter = 'all', category = null } = {}) {
  let query = supabase.from('notifications').select('*').eq('user_id', userId)

  if (filter === 'unread') query = query.eq('is_read', false).eq('is_archived', false)
  else if (filter === 'read') query = query.eq('is_read', true).eq('is_archived', false)
  else if (filter === 'archived') query = query.eq('is_archived', true)

  if (category) query = query.eq('category', category)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function fetchUnreadCount(userId) {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)
    .eq('is_archived', false)
  if (error) throw error
  return count ?? 0
}

export async function markRead(id) {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  if (error) throw error
}

export async function markUnread(id) {
  const { error } = await supabase.from('notifications').update({ is_read: false }).eq('id', id)
  if (error) throw error
}

export async function markArchived(id) {
  const { error } = await supabase.from('notifications').update({ is_archived: true }).eq('id', id)
  if (error) throw error
}

export async function markAllRead(userId) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)
  if (error) throw error
}

/*
  Live in-app delivery while the app is open — the closest this
  project gets to "push" without a Firebase project + server trigger.
  Returns an unsubscribe function.
*/
export function subscribeToNotifications(userId, onInsert) {
  const channel = supabase
    .channel(`notifications-${userId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, payload => {
      onInsert(payload.new)
    })
    .subscribe()
  return () => supabase.removeChannel(channel)
}

/*
  Generic insert used by every feature that raises a notification
  (rides, payments, subscriptions, safety, family). Errors are
  intentionally swallowed by callers that treat this as best-effort —
  but always check `error` here so a bad insert is never silently lost
  the way the subscription notifications were before this was added.
*/
export async function notify({ userId, category, title, body, data = null }) {
  const { error } = await supabase.from('notifications').insert({ user_id: userId, category, title, body, data })
  if (error) throw error
}

/*
  notifications.user_id references public.users(id), but a lot of
  driver-facing code only has driver_profiles.id on hand — resolve
  the real owning user first (the same FK mismatch silently broke
  every subscription notification before it was caught in
  src/lib/subscriptions.js).
*/
export async function notifyDriverProfile(driverProfileId, { category, title, body, data = null }) {
  const { data: profile } = await supabase.from('driver_profiles').select('user_id').eq('id', driverProfileId).maybeSingle()
  if (!profile) return
  await notify({ userId: profile.user_id, category, title, body, data })
}
