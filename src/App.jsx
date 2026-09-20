import { lazy, Suspense, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/hooks/useAuth.jsx'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import LandingPage from '@/pages/LandingPage'
import OnboardingPage from '@/pages/OnboardingPage'
import SplashScreen from '@/pages/SplashScreen'

/*
  Everything past the pre-login funnel is code-split per page. The build
  used to ship one ~1.4 MB (400 KB gzipped) bundle containing the admin
  dashboard and every driver page to every rider (and vice versa) — a
  rider now only downloads rider code, a driver only driver code. The
  entry funnel above (landing/login/register/onboarding/splash) stays
  eager so first paint isn't waiting on a second round trip.
*/
const RiderHomePage = lazy(() => import('@/pages/rider/HomePage'))
const BookRidePage = lazy(() => import('@/pages/rider/BookRidePage'))
const DriverProfilePage = lazy(() => import('@/pages/rider/DriverProfilePage'))
const HelpSupportPage = lazy(() => import('@/pages/rider/HelpSupportPage'))
const ActiveRidePage = lazy(() => import('@/pages/rider/ActiveRidePage'))
const RideCompletePage = lazy(() => import('@/pages/rider/RideCompletePage'))
const ScheduledRidesPage = lazy(() => import('@/pages/rider/ScheduledRidesPage'))
const FamilyPage = lazy(() => import('@/pages/rider/FamilyPage'))
const PreferredDriversPage = lazy(() => import('@/pages/rider/PreferredDriversPage'))
const RiderSubscriptionPage = lazy(() => import('@/pages/rider/SubscriptionPage'))
const PersonalInformationPage = lazy(() => import('@/pages/rider/PersonalInformationPage'))
const MobileNumberPage = lazy(() => import('@/pages/rider/MobileNumberPage'))
const PaymentHistoryPage = lazy(() => import('@/pages/rider/PaymentHistoryPage'))
const EcoImpactPage = lazy(() => import('@/pages/rider/EcoImpactPage'))
const SafetyCenterPage = lazy(() => import('@/pages/rider/SafetyCenterPage'))
const TermsPrivacyPage = lazy(() => import('@/pages/rider/TermsPrivacyPage'))
const DriverHomePage = lazy(() => import('@/pages/driver/HomePage'))
const DriverGoHomePage = lazy(() => import('@/pages/driver/GoHomePage'))
const DriverVerificationPage = lazy(() => import('@/pages/driver/VerificationPage'))
const DriverSubscriptionPage = lazy(() => import('@/pages/driver/SubscriptionPage'))
const DriverAdsPage = lazy(() => import('@/pages/driver/AdsPage'))
const DriverSettingsPage = lazy(() => import('@/pages/driver/SettingsPage'))
const DriverAnalyticsPage = lazy(() => import('@/pages/driver/AnalyticsPage'))
const AdminDashboardPage = lazy(() => import('@/pages/admin/DashboardPage'))
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'))
const SharedTripPage = lazy(() => import('@/pages/SharedTripPage'))

/* ── Shared loading spinner ───────────────────────────────── */
function Spinner() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-[var(--color-background)]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)] animate-spin" />
        <p className="text-sm text-[var(--color-on-surface-variant)]">Loading…</p>
      </div>
    </div>
  )
}

/*
  SMART REDIRECT — lives at "/"
  Reads the user's role and sends them to the right home page.
  This means LoginPage never has to know about roles — it just
  navigates to "/" and lets this component figure out where to go.
*/
function SmartRedirect() {
  const { user, role, loading } = useAuth()

  if (loading) return <Spinner />
  if (!user) return <LandingPage />
  if (role === 'rider')  return <Navigate to="/rider/home" replace />
  if (role === 'driver') return <Navigate to="/driver/home" replace />
  if (role === 'admin')  return <Navigate to="/admin/dashboard" replace />

  // Authenticated but no profile row yet → complete registration
  return <Navigate to="/register" replace />
}

/*
  PUBLIC ROUTE — for /login and /register entry points.
  If the user is already fully logged in, bounce them to SmartRedirect.
*/
function PublicRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return <Spinner />
  if (user) return <Navigate to="/" replace />

  return children
}

/*
  UNREGISTERED ROUTE — for /register.
  Must be authenticated (have a Supabase user) but have no role yet.
  If they already have a role, SmartRedirect will send them home.
*/
function UnregisteredRoute({ children }) {
  const { user, role, loading } = useAuth()

  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (role)  return <Navigate to="/" replace />   // already registered

  return children
}

/*
  ROLE ROUTE — protects pages that require a specific role.
  · Not logged in → /login
  · Wrong role    → / (SmartRedirect sends them to their own home)
*/
function RoleRoute({ allowedRole, children }) {
  const { user, role, loading } = useAuth()

  if (loading) return <Spinner />
  if (!user)             return <Navigate to="/login" replace />
  if (role !== allowedRole) return <Navigate to="/" replace />

  return children
}

function AppRoutes() {
  return (
    <Suspense fallback={<Spinner />}>
    <Routes>
      {/* Smart home — role-aware redirect */}
      <Route path="/" element={<SmartRedirect />} />

      {/* Public auth pages */}
      <Route path="/login"    element={<PublicRoute><LoginPage /></PublicRoute>} />

      {/* First-run intro carousel — public, part of the pre-login funnel */}
      <Route path="/welcome" element={<OnboardingPage />} />

      {/* Registration — authenticated but no role yet */}
      <Route path="/register" element={<UnregisteredRoute><RegisterPage /></UnregisteredRoute>} />

      {/* Shared trip link — deliberately public, no auth. Token is the access control. */}
      <Route path="/trip/:token" element={<SharedTripPage />} />

      {/* Rider pages */}
      <Route path="/rider/home"          element={<RoleRoute allowedRole="rider"><RiderHomePage /></RoleRoute>} />
      <Route path="/rider/book-ride"     element={<RoleRoute allowedRole="rider"><BookRidePage /></RoleRoute>} />
      <Route path="/rider/driver/:driverId" element={<RoleRoute allowedRole="rider"><DriverProfilePage /></RoleRoute>} />
      <Route path="/rider/help"          element={<RoleRoute allowedRole="rider"><HelpSupportPage /></RoleRoute>} />
      <Route path="/rider/active-ride"   element={<RoleRoute allowedRole="rider"><ActiveRidePage /></RoleRoute>} />
      <Route path="/rider/ride-complete" element={<RoleRoute allowedRole="rider"><RideCompletePage /></RoleRoute>} />
      <Route path="/rider/schedule"      element={<RoleRoute allowedRole="rider"><ScheduledRidesPage /></RoleRoute>} />
      <Route path="/rider/family"        element={<RoleRoute allowedRole="rider"><FamilyPage /></RoleRoute>} />
      <Route path="/rider/preferred-drivers" element={<RoleRoute allowedRole="rider"><PreferredDriversPage /></RoleRoute>} />
      <Route path="/rider/subscription"  element={<RoleRoute allowedRole="rider"><RiderSubscriptionPage /></RoleRoute>} />
      <Route path="/rider/notifications" element={<RoleRoute allowedRole="rider"><NotificationsPage /></RoleRoute>} />
      <Route path="/rider/personal-information" element={<RoleRoute allowedRole="rider"><PersonalInformationPage /></RoleRoute>} />
      <Route path="/rider/mobile-number" element={<RoleRoute allowedRole="rider"><MobileNumberPage /></RoleRoute>} />
      <Route path="/rider/payment-history" element={<RoleRoute allowedRole="rider"><PaymentHistoryPage /></RoleRoute>} />
      <Route path="/rider/eco-impact" element={<RoleRoute allowedRole="rider"><EcoImpactPage /></RoleRoute>} />
      <Route path="/rider/safety-center" element={<RoleRoute allowedRole="rider"><SafetyCenterPage /></RoleRoute>} />
      <Route path="/rider/terms" element={<RoleRoute allowedRole="rider"><TermsPrivacyPage /></RoleRoute>} />

      {/* Driver pages */}
      <Route path="/driver/home"         element={<RoleRoute allowedRole="driver"><DriverHomePage /></RoleRoute>} />
      <Route path="/driver/go-home"      element={<RoleRoute allowedRole="driver"><DriverGoHomePage /></RoleRoute>} />
      <Route path="/driver/verification" element={<RoleRoute allowedRole="driver"><DriverVerificationPage /></RoleRoute>} />
      <Route path="/driver/subscription" element={<RoleRoute allowedRole="driver"><DriverSubscriptionPage /></RoleRoute>} />
      <Route path="/driver/ads"          element={<RoleRoute allowedRole="driver"><DriverAdsPage /></RoleRoute>} />
      <Route path="/driver/notifications" element={<RoleRoute allowedRole="driver"><NotificationsPage /></RoleRoute>} />
      <Route path="/driver/settings"     element={<RoleRoute allowedRole="driver"><DriverSettingsPage /></RoleRoute>} />
      <Route path="/driver/analytics"    element={<RoleRoute allowedRole="driver"><DriverAnalyticsPage /></RoleRoute>} />

      {/* Admin pages */}
      <Route path="/admin/dashboard" element={<RoleRoute allowedRole="admin"><AdminDashboardPage /></RoleRoute>} />

      {/* Catch-all → SmartRedirect handles it */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  )
}

/*
  Cold-start splash — shows the branded SplashScreen once per browser
  session (sessionStorage flag), then reveals the app. Route-level auth
  spinners still handle in-app transitions.
*/
function BootSplash({ children }) {
  const [booting, setBooting] = useState(() => {
    try { return !sessionStorage.getItem('drivo_booted') } catch { return false }
  })
  useEffect(() => {
    if (!booting) return
    const t = setTimeout(() => {
      try { sessionStorage.setItem('drivo_booted', '1') } catch { /* private mode */ }
      setBooting(false)
    }, 1800)
    return () => clearTimeout(t)
  }, [booting])
  return booting ? <SplashScreen /> : children
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <BootSplash>
          <AppRoutes />
        </BootSplash>
      </AuthProvider>
    </BrowserRouter>
  )
}
