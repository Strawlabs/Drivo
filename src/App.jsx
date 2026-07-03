import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/hooks/useAuth.jsx'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import RiderHomePage from '@/pages/rider/HomePage'
import BookRidePage from '@/pages/rider/BookRidePage'
import ActiveRidePage from '@/pages/rider/ActiveRidePage'
import RideCompletePage from '@/pages/rider/RideCompletePage'
import ScheduledRidesPage from '@/pages/rider/ScheduledRidesPage'
import DriverHomePage from '@/pages/driver/HomePage'
import DriverVerificationPage from '@/pages/driver/VerificationPage'
import AdminDashboardPage from '@/pages/admin/DashboardPage'

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
  if (!user) return <Navigate to="/login" replace />
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
    <Routes>
      {/* Smart home — role-aware redirect */}
      <Route path="/" element={<SmartRedirect />} />

      {/* Public auth pages */}
      <Route path="/login"    element={<PublicRoute><LoginPage /></PublicRoute>} />

      {/* Registration — authenticated but no role yet */}
      <Route path="/register" element={<UnregisteredRoute><RegisterPage /></UnregisteredRoute>} />

      {/* Rider pages */}
      <Route path="/rider/home"          element={<RoleRoute allowedRole="rider"><RiderHomePage /></RoleRoute>} />
      <Route path="/rider/book-ride"     element={<RoleRoute allowedRole="rider"><BookRidePage /></RoleRoute>} />
      <Route path="/rider/active-ride"   element={<RoleRoute allowedRole="rider"><ActiveRidePage /></RoleRoute>} />
      <Route path="/rider/ride-complete" element={<RoleRoute allowedRole="rider"><RideCompletePage /></RoleRoute>} />
      <Route path="/rider/schedule"      element={<RoleRoute allowedRole="rider"><ScheduledRidesPage /></RoleRoute>} />

      {/* Driver pages */}
      <Route path="/driver/home"         element={<RoleRoute allowedRole="driver"><DriverHomePage /></RoleRoute>} />
      <Route path="/driver/verification" element={<RoleRoute allowedRole="driver"><DriverVerificationPage /></RoleRoute>} />

      {/* Admin pages */}
      <Route path="/admin/dashboard" element={<RoleRoute allowedRole="admin"><AdminDashboardPage /></RoleRoute>} />

      {/* Catch-all → SmartRedirect handles it */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
