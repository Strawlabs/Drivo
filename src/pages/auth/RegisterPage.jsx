import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth.jsx'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function RegisterPage() {
  const { user, refreshRole } = useAuth()
  const navigate = useNavigate()

  // Onboarding wizard steps: 'role_selection' | 'profile_info' | 'driver_license' | 'vehicle_info'
  const [step, setStep] = useState('role_selection')
  const [role, setRole] = useState(null) // 'rider' | 'driver'

  // Form Fields
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  
  // Driver specific fields
  const [licenseNo, setLicenseNo] = useState('')
  
  // Vehicle specific fields
  const [vehicleType, setVehicleType] = useState('four_wheeler') // 'two_wheeler' | 'three_wheeler' | 'four_wheeler'
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [color, setColor] = useState('')
  const [plateNumber, setPlateNumber] = useState('')
  const [isEv, setIsEv] = useState(true)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Rider submission logic
  async function handleRegisterRider() {
    if (!user) return
    setLoading(true)
    setError(null)

    const { error: userErr } = await supabase.from('users').insert({
      id: user.id,
      phone: phone.trim() || user.email,
      name: fullName.trim(),
      email: user.email,
      role: 'rider',
    })

    if (userErr) {
      setError(userErr.message)
      setLoading(false)
    } else {
      await refreshRole()
      setLoading(false)
      navigate('/')
    }
  }

  // Driver submission logic
  async function handleRegisterDriver() {
    if (!user) return
    setLoading(true)
    setError(null)

    // 1. Insert user row
    const { error: userErr } = await supabase.from('users').insert({
      id: user.id,
      phone: phone.trim(),
      name: fullName.trim(),
      email: user.email,
      role: 'driver',
    })

    if (userErr) {
      setError(userErr.message)
      setLoading(false)
      return
    }

    // 2. Insert driver profile
    const { data: driverProfile, error: driverErr } = await supabase
      .from('driver_profiles')
      .insert({ user_id: user.id, driving_license: licenseNo.trim() })
      .select('id')
      .single()

    if (driverErr) {
      setError(driverErr.message)
      await supabase.from('users').delete().eq('id', user.id)
      setLoading(false)
      return
    }

    // 3. Insert vehicle
    const { error: vehicleErr } = await supabase.from('vehicles').insert({
      driver_id: driverProfile.id,
      vehicle_type: vehicleType === 'three_wheeler' ? 'ev_auto' : 'ev_car',
      make: make.trim(),
      model: model.trim(),
      year: year ? parseInt(year, 10) : null,
      registration_number: plateNumber.trim().toUpperCase(),
      is_ev: isEv,
    })

    if (vehicleErr) {
      setError(vehicleErr.message)
      await supabase.from('driver_profiles').delete().eq('id', driverProfile.id)
      await supabase.from('users').delete().eq('id', user.id)
      setLoading(false)
      return
    }

    await refreshRole()
    setLoading(false)
    navigate('/')
  }

  // Navigation handlers for the wizard
  function handleNextStep(e) {
    e.preventDefault()
    if (step === 'profile_info') {
      if (role === 'rider') {
        handleRegisterRider()
      } else {
        setStep('driver_license')
      }
    } else if (step === 'driver_license') {
      setStep('vehicle_info')
    } else if (step === 'vehicle_info') {
      handleRegisterDriver()
    }
  }

  function handleBackStep() {
    setError(null)
    if (step === 'profile_info') {
      setStep('role_selection')
    } else if (step === 'driver_license') {
      setStep('profile_info')
    } else if (step === 'vehicle_info') {
      setStep('driver_license')
    }
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--color-surface-container-lowest)]">
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-12">
        
        {/* ── Wizard Header ── */}
        <div className="mb-8 text-center max-w-sm">
          <div
            className="mx-auto mb-4 w-14 h-14 rounded-[var(--radius-xl)] flex items-center justify-center text-2xl"
            style={{ background: 'var(--color-surface-container)' }}
          >
            {step === 'role_selection' && '👋'}
            {step === 'profile_info' && '👤'}
            {step === 'driver_license' && '🪪'}
            {step === 'vehicle_info' && '⚡'}
          </div>
          <h1
            className="text-headline-md font-semibold"
            style={{ color: 'var(--color-deep-blue)', letterSpacing: '-0.01em' }}
          >
            {step === 'role_selection' && 'Join Drivo Mobility'}
            {step === 'profile_info' && 'Complete your profile'}
            {step === 'driver_license' && 'Driver credentials'}
            {step === 'vehicle_info' && 'Register your EV'}
          </h1>
          <p
            className="mt-1 text-label-md"
            style={{ color: 'var(--color-on-surface-variant)' }}
          >
            {step === 'role_selection' && 'Select how you want to use the Drivo network.'}
            {step === 'profile_info' && 'Provide your basic details to set up your account.'}
            {step === 'driver_license' && 'We require a valid driving license to activate drivers.'}
            {step === 'vehicle_info' && 'Add the electric vehicle you will use on trips.'}
          </p>
        </div>

        {/* ── Main Container Card ── */}
        <div
          className="w-full max-w-md rounded-[var(--radius-xl)] p-6 transition-all"
          style={{
            background: 'var(--color-surface-container-lowest)',
            boxShadow: 'var(--shadow-card)',
            border: '1px solid var(--color-border)',
          }}
        >
          {/* Verified User Info (Static header) */}
          {user && step === 'role_selection' && (
            <div
              className="mb-6 flex items-center gap-2 rounded-[var(--radius-full)] px-4 py-2.5 text-label-md"
              style={{ background: 'var(--color-surface-container-low)' }}
            >
              <span style={{ color: 'var(--color-primary)' }}>✓</span>
              <span style={{ color: 'var(--color-on-surface-variant)' }}>Verified as</span>
              <span className="font-semibold truncate" style={{ color: 'var(--color-deep-blue)' }}>
                {user.email}
              </span>
            </div>
          )}

          {/* Progress Indicator for Multi-step */}
          {step !== 'role_selection' && (
            <div className="mb-6 flex items-center justify-between text-label-sm border-b pb-4">
              <button
                type="button"
                onClick={handleBackStep}
                className="text-label-md transition-colors hover:underline flex items-center gap-1"
                style={{ color: 'var(--color-on-surface-variant)' }}
              >
                ← Back
              </button>
              <span style={{ color: 'var(--color-muted-foreground)' }}>
                {role === 'rider' ? 'Step 2 of 2' : 
                 step === 'profile_info' ? 'Step 2 of 4' : 
                 step === 'driver_license' ? 'Step 3 of 4' : 'Step 4 of 4'}
              </span>
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-[var(--radius-md)] bg-[var(--color-error-container)] p-3 text-label-md text-[var(--color-on-error-container)]">
              {error}
            </div>
          )}

          {/* STEP 1: ROLE SELECTION */}
          {step === 'role_selection' && (
            <div className="flex flex-col gap-4">
              <button
                type="button"
                onClick={() => { setRole('rider'); setStep('profile_info') }}
                className="flex items-center gap-4 text-left p-4 rounded-[var(--radius-lg)] border-2 transition-all hover:bg-[var(--color-surface-container-low)]"
                style={{
                  borderColor: role === 'rider' ? 'var(--color-primary)' : 'var(--color-border)',
                }}
              >
                <div className="w-12 h-12 rounded-[var(--radius-md)] bg-[var(--color-primary-container)] flex items-center justify-center text-2xl shrink-0">
                  🚗
                </div>
                <div>
                  <h3 className="font-semibold text-label-md text-[var(--color-deep-blue)]">Book EV Rides</h3>
                  <p className="text-label-sm text-[var(--color-on-surface-variant)] mt-0.5">
                    I want to ride green, track carbon savings, and get sustainable travel.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => { setRole('driver'); setStep('profile_info') }}
                className="flex items-center gap-4 text-left p-4 rounded-[var(--radius-lg)] border-2 transition-all hover:bg-[var(--color-surface-container-low)]"
                style={{
                  borderColor: role === 'driver' ? 'var(--color-primary)' : 'var(--color-border)',
                }}
              >
                <div className="w-12 h-12 rounded-[var(--radius-md)] bg-[var(--color-secondary-container)] flex items-center justify-center text-2xl shrink-0">
                  🔌
                </div>
                <div>
                  <h3 className="font-semibold text-label-md text-[var(--color-deep-blue)]">Drive &amp; Earn</h3>
                  <p className="text-label-sm text-[var(--color-on-surface-variant)] mt-0.5">
                    I own or lease an EV and want to accept bookings on the Drivo network.
                  </p>
                </div>
              </button>
            </div>
          )}

          {/* STEP 2: PROFILE INFO */}
          {step === 'profile_info' && (
            <form onSubmit={handleNextStep} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="full-name">Full name</Label>
                <Input
                  id="full-name"
                  type="text"
                  placeholder="Arjun Sharma"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                  minLength={2}
                  autoComplete="name"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="phone">
                  Phone number {role === 'rider' && <span className="font-normal text-[var(--color-muted-foreground)]">(optional)</span>}
                </Label>
                <div className="flex gap-2">
                  <div
                    className="flex h-12 items-center rounded-[var(--radius-lg)] border px-3 text-label-md select-none shrink-0"
                    style={{
                      borderColor: 'var(--color-outline-variant)',
                      background: 'var(--color-surface-container)',
                      color: 'var(--color-on-surface-variant)',
                    }}
                  >
                    +91
                  </div>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    placeholder="98765 43210"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    required={role === 'driver'}
                    pattern="[0-9]{10}"
                    title="Enter a 10-digit Indian mobile number"
                    autoComplete="tel"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full mt-2" disabled={loading || fullName.trim().length < 2}>
                {loading ? 'Processing…' : role === 'rider' ? 'Start riding →' : 'Continue'}
              </Button>
            </form>
          )}

          {/* STEP 3: DRIVER LICENSE */}
          {step === 'driver_license' && (
            <form onSubmit={handleNextStep} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="license-no">Driver's License Number</Label>
                <Input
                  id="license-no"
                  type="text"
                  placeholder="DL-1420110012345"
                  value={licenseNo}
                  onChange={e => setLicenseNo(e.target.value.toUpperCase())}
                  required
                  minLength={5}
                  autoFocus
                />
              </div>

              <Button type="submit" className="w-full mt-2" disabled={licenseNo.trim().length < 5}>
                Continue
              </Button>
            </form>
          )}

          {/* STEP 4: VEHICLE INFO */}
          {step === 'vehicle_info' && (
            <form onSubmit={handleNextStep} className="flex flex-col gap-4">
              
              <div className="flex flex-col gap-1.5">
                <Label>Vehicle Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'two_wheeler', label: '2-Wheeler', icon: '🛵' },
                    { id: 'three_wheeler', label: '3-Wheeler', icon: '🛺' },
                    { id: 'four_wheeler', label: '4-Wheeler', icon: '🚗' }
                  ].map(type => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setVehicleType(type.id)}
                      className="p-3 rounded-[var(--radius-lg)] border-2 transition-all text-center flex flex-col items-center gap-1"
                      style={{
                        borderColor: vehicleType === type.id ? 'var(--color-primary)' : 'var(--color-border)',
                        background: vehicleType === type.id ? 'var(--color-surface-container-low)' : 'transparent',
                      }}
                    >
                      <span className="text-xl">{type.icon}</span>
                      <span className="text-label-sm font-semibold">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="vehicle-make">Make / Brand</Label>
                  <Input
                    id="vehicle-make"
                    type="text"
                    placeholder="e.g. Tata, Ather"
                    value={make}
                    onChange={e => setMake(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="vehicle-model">Model</Label>
                  <Input
                    id="vehicle-model"
                    type="text"
                    placeholder="e.g. Nexon EV, 450X"
                    value={model}
                    onChange={e => setModel(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="vehicle-year">Year (optional)</Label>
                  <Input
                    id="vehicle-year"
                    type="number"
                    placeholder="e.g. 2024"
                    value={year}
                    onChange={e => setYear(e.target.value)}
                    min={2000}
                    max={new Date().getFullYear() + 1}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="vehicle-color">Color (optional)</Label>
                  <Input
                    id="vehicle-color"
                    type="text"
                    placeholder="e.g. Green, White"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="plate-no">License Plate Number</Label>
                <Input
                  id="plate-no"
                  type="text"
                  placeholder="e.g. MH12AB1234"
                  value={plateNumber}
                  onChange={e => setPlateNumber(e.target.value)}
                  required
                />
              </div>

              {/* EV Checkbox */}
              <label className="flex items-center gap-2.5 py-1 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={isEv}
                  onChange={e => setIsEv(e.target.checked)}
                  className="w-5.5 h-5.5 accent-[var(--color-primary)] rounded-[var(--radius-sm)]"
                />
                <span className="text-label-md font-medium text-[var(--color-deep-blue)]">
                  This is an Electric Vehicle (EV) ⚡
                </span>
              </label>

              <Button type="submit" className="w-full mt-2" disabled={loading || !make.trim() || !model.trim() || !plateNumber.trim()}>
                {loading ? 'Creating driver profile…' : 'Complete Registration →'}
              </Button>
            </form>
          )}
        </div>

        <p
          className="mt-6 text-label-sm text-center max-w-xs"
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          By continuing, you agree to Drivo's Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  )
}
