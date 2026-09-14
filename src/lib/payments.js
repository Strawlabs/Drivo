import { supabase } from '@/lib/supabase'
import jsPDF from 'jspdf'

/* UPI deep link — MVP payment rail. Platform never touches the money;
   it only hands off to whatever UPI app is installed and later records
   the rider's self-reported confirmation. */
export function buildUpiLink({ upiId, payeeName, amount, note }) {
  const params = new URLSearchParams({
    pa: upiId,
    pn: payeeName,
    am: Number(amount).toFixed(2),
    cu: 'INR',
    tn: note,
  })
  return `upi://pay?${params.toString()}`
}

export async function initiateUpiPayment({ rideId, riderId, driverId, amount }) {
  const { data, error } = await supabase.from('payments').insert({
    ride_id: rideId,
    rider_id: riderId,
    driver_id: driverId,
    amount,
    method: 'upi',
    status: 'pending',
  }).select().single()
  if (error) throw error
  return data
}

/*
  Confirms a rider-reported UPI reference number. Since there's no real
  payment gateway callback for MVP, this is the only fraud check available:
  if the same reference has already been used on a different payment, flag
  it for manual review instead of marking the ride paid. That check, and
  the actual status write, both happen inside confirm_upi_payment
  (schema.sql) now, not here — a plain client update had no WITH CHECK on
  its RLS policy, so a rider could set status/upi_reference/paid_at to
  anything on their own payment, bypassing this fraud check completely
  (confirmed exploitable in production before this fix). The RPC also
  only transitions a genuinely 'pending' payment, closing the same
  client-side SELECT-then-UPDATE race the subscription fix addressed.
*/
export async function confirmUpiPayment({ paymentId, upiReference }) {
  const ref = upiReference.trim()
  if (!ref) throw new Error('Enter the UPI transaction reference to confirm payment.')

  const { data, error } = await supabase.rpc('confirm_upi_payment', {
    p_payment_id: paymentId, p_upi_reference: ref,
  })
  if (error) throw error
  return data
}

export async function failUpiPayment(paymentId) {
  const { error } = await supabase.rpc('fail_upi_payment', { p_payment_id: paymentId })
  if (error) throw error
}

/*
  A flagged payment used to just vanish — nothing surfaced it to an
  admin, and nothing could ever move it out of 'flagged' even if
  someone noticed (confirm_upi_payment only transitions a genuinely
  'pending' payment). Pulls in the OTHER payment that holds the same
  upi_reference too, since that's the actual fact an admin needs to
  adjudicate which side (if either) is telling the truth.
*/
export async function fetchFlaggedPayments() {
  const { data: flagged, error } = await supabase
    .from('payments')
    .select('*, users:rider_id(name, phone), driver_profiles(users(name)), rides(pickup_address, destination_address)')
    .eq('status', 'flagged')
    .order('created_at', { ascending: false })
  if (error) throw error
  if ((flagged ?? []).length === 0) return []

  const refs = [...new Set(flagged.map(p => p.upi_reference).filter(Boolean))]
  const { data: conflicts } = await supabase
    .from('payments')
    .select('id, upi_reference, status, users:rider_id(name)')
    .in('upi_reference', refs)

  return flagged.map(p => ({
    ...p,
    conflictingPayment: (conflicts ?? []).find(c => c.upi_reference === p.upi_reference && c.id !== p.id) ?? null,
  }))
}

export async function resolveFlaggedPayment(paymentId, resolution) {
  const { data, error } = await supabase.rpc('admin_resolve_flagged_payment', {
    p_payment_id: paymentId, p_resolution: resolution,
  })
  if (error) throw error
  return data
}

export async function payCash({ rideId, riderId, driverId, amount }) {
  const { data, error } = await supabase.from('payments').insert({
    ride_id: rideId,
    rider_id: riderId,
    driver_id: driverId,
    amount,
    method: 'cash',
    status: 'completed',
    paid_at: new Date().toISOString(),
  }).select().single()
  if (error) throw error
  return data
}

export async function generateReceipt({ payment, ride, driverName }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a5' })
  const line = (y) => doc.line(40, y, 340, y)

  doc.setFontSize(18)
  doc.text('Drivo Ride Receipt', 40, 50)
  doc.setFontSize(10)
  doc.text(`Receipt generated: ${new Date().toLocaleString('en-IN')}`, 40, 70)
  line(80)

  doc.setFontSize(11)
  let y = 105
  const row = (label, value) => {
    doc.text(label, 40, y)
    doc.text(String(value), 200, y)
    y += 22
  }
  row('Ride ID', ride.id)
  row('Driver', driverName ?? '—')
  row('Pickup', ride.pickup_address ?? '—')
  row('Destination', ride.destination_address ?? '—')
  row('Distance', ride.distance_km ? `${ride.distance_km} km` : '—')
  row('Duration', ride.duration_minutes ? `${ride.duration_minutes} mins` : '—')
  row('Payment Method', payment.method.toUpperCase())
  if (payment.upi_reference) row('UPI Reference', payment.upi_reference)
  row('Paid At', payment.paid_at ? new Date(payment.paid_at).toLocaleString('en-IN') : '—')

  line(y + 5)
  doc.setFontSize(14)
  doc.text('Total Paid', 40, y + 30)
  doc.text(`Rs. ${Number(payment.amount).toFixed(2)}`, 200, y + 30)

  const blob = doc.output('blob')
  const path = `${payment.id}.pdf`

  const { error: uploadErr } = await supabase.storage
    .from('receipts')
    .upload(path, blob, { upsert: true, contentType: 'application/pdf' })
  if (uploadErr) throw uploadErr

  const { data: pub } = supabase.storage.from('receipts').getPublicUrl(path)

  const { data, error } = await supabase
    .from('receipts')
    .insert({ payment_id: payment.id, ride_id: payment.ride_id, receipt_url: pub.publicUrl })
    .select()
    .single()
  if (error) throw error
  return data
}
