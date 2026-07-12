import { supabase } from '@/lib/supabase'
import { notifyDriverProfile } from '@/lib/notifications'

export const ELIGIBLE_AD_TIER = 'elite'

// ── Admin: campaign CRUD ─────────────────────────────────────────

export async function fetchCampaigns() {
  const { data, error } = await supabase
    .from('ad_campaigns')
    .select('*, driver_campaign_assignments(id, status, earnings_credited)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(c => {
    const assignments = c.driver_campaign_assignments ?? []
    return {
      ...c,
      assignedCount: assignments.length,
      acceptedCount: assignments.filter(a => a.status === 'accepted' || a.status === 'completed').length,
      totalCredited: assignments.reduce((sum, a) => sum + Number(a.earnings_credited ?? 0), 0),
    }
  })
}

export async function createCampaign({ title, description, revenueSharePercent, startDate, endDate }) {
  const { data, error } = await supabase
    .from('ad_campaigns')
    .insert({
      title,
      description: description || null,
      revenue_share_percent: revenueSharePercent,
      start_date: startDate || null,
      end_date: endDate || null,
      status: 'draft',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCampaignStatus(id, status) {
  const { error } = await supabase.from('ad_campaigns').update({ status }).eq('id', id)
  if (error) throw error
}

// ── Admin: assigning drivers ─────────────────────────────────────

/*
  Scope decision (asked user): only drivers with an active/grace_period
  Elite subscription are eligible for ad campaigns — keeps the
  Basic/Pro/Elite ladder meaningful rather than treating ads as
  unrelated to the subscription tiers.
*/
export async function fetchEligibleDriversForCampaign(campaignId) {
  const { data: eliteSubs, error } = await supabase
    .from('driver_subscriptions')
    .select('driver_id, subscription_plans(name)')
    .in('status', ['active', 'grace_period'])
  if (error) throw error

  const eliteDriverIds = (eliteSubs ?? [])
    .filter(s => s.subscription_plans?.name === ELIGIBLE_AD_TIER)
    .map(s => s.driver_id)
  if (eliteDriverIds.length === 0) return []

  const { data: existing } = await supabase
    .from('driver_campaign_assignments')
    .select('driver_id')
    .eq('campaign_id', campaignId)
  const alreadyAssigned = new Set((existing ?? []).map(a => a.driver_id))

  const { data: profiles, error: profErr } = await supabase
    .from('driver_profiles')
    .select('id, rating, users(name)')
    .in('id', eliteDriverIds)
  if (profErr) throw profErr

  return (profiles ?? [])
    .filter(p => !alreadyAssigned.has(p.id))
    .map(p => ({ id: p.id, name: p.users?.name ?? 'Driver', rating: p.rating ?? 5.0 }))
}

export async function assignCampaignToDriver({ campaignId, driverId }) {
  const { data, error } = await supabase
    .from('driver_campaign_assignments')
    .insert({ campaign_id: campaignId, driver_id: driverId, status: 'pending' })
    .select()
    .single()
  if (error) throw error

  await notifyDriverProfile(driverId, {
    category: 'advertising',
    title: 'New ad campaign offer',
    body: 'You\'ve been offered a new ad campaign — check the Ads tab to accept or decline.',
  }).catch(() => {})

  return data
}

export async function fetchCampaignAssignments(campaignId) {
  const { data, error } = await supabase
    .from('driver_campaign_assignments')
    .select('id, status, earnings_credited, assigned_at, driver_profiles(users(name))')
    .eq('campaign_id', campaignId)
    .order('assigned_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(a => ({
    id: a.id,
    status: a.status,
    earningsCredited: a.earnings_credited,
    assignedAt: a.assigned_at,
    driverName: a.driver_profiles?.users?.name ?? 'Driver',
  }))
}

/*
  No real ad-serving/click-tracking exists in this MVP, so the
  credited amount is entered by an admin when a campaign assignment
  is marked complete — the same honest self-reported pattern already
  used for UPI payments and driver subscriptions, rather than
  fabricating a fake automatic calculation.
*/
export async function completeAssignment(id, earningsCredited) {
  const { error } = await supabase
    .from('driver_campaign_assignments')
    .update({ status: 'completed', earnings_credited: earningsCredited })
    .eq('id', id)
  if (error) throw error
}

// ── Driver: viewing and responding to offers ─────────────────────

export async function fetchMyCampaignAssignments(driverProfileId) {
  const { data, error } = await supabase
    .from('driver_campaign_assignments')
    .select('id, status, earnings_credited, assigned_at, ad_campaigns(title, description, revenue_share_percent, start_date, end_date, status)')
    .eq('driver_id', driverProfileId)
    .order('assigned_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(a => ({
    id: a.id,
    status: a.status,
    earningsCredited: a.earnings_credited,
    assignedAt: a.assigned_at,
    title: a.ad_campaigns?.title ?? 'Campaign',
    description: a.ad_campaigns?.description ?? '',
    revenueSharePercent: a.ad_campaigns?.revenue_share_percent,
    campaignStatus: a.ad_campaigns?.status,
  }))
}

export async function respondToAssignment(id, status) {
  if (!['accepted', 'rejected'].includes(status)) throw new Error('Invalid response.')
  const { error } = await supabase.from('driver_campaign_assignments').update({ status }).eq('id', id)
  if (error) throw error
}
