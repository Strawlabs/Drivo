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
  it for manual review instead of marking the ride paid.
*/
export async function confirmUpiPayment({ paymentId, upiReference }) {
  const ref = upiReference.trim()
  if (!ref) throw new Error('Enter the UPI transaction reference to confirm payment.')

  const { data: existing } = await supabase
    .from('payments')
    .select('id')
    .eq('upi_reference', ref)
    .neq('id', paymentId)
    .maybeSingle()

  const flagged = Boolean(existing)
  const { data, error } = await supabase
    .from('payments')
    .update({
      status: flagged ? 'flagged' : 'completed',
      upi_reference: ref,
      paid_at: flagged ? null : new Date().toISOString(),
    })
    .eq('id', paymentId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function failUpiPayment(paymentId) {
  const { error } = await supabase.from('payments').update({ status: 'failed' }).eq('id', paymentId)
  if (error) throw error
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
