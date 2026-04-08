import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import { ThemeProvider } from './theme/ThemeContext'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { DataProvider } from './data/DataContext'
import { SubscriptionProvider } from './subscription/SubscriptionContext'
import AppShell from './components/layout/AppShell'
import Login from './pages/Login'
import Landing from './pages/Landing'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'
import ResetPassword from './pages/ResetPassword'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import QuickQuote from './pages/QuickQuote'
import Jobs from './pages/Jobs'
import CalendarPage from './pages/CalendarPage'
import Customers from './pages/Customers'

import Insights from './pages/Insights'
import PricingRules from './pages/PricingRules'
import SettingsPage from './pages/SettingsPage'
import Expenses from './pages/Expenses'
import PricingPage from './pages/Pricing'
import QuoteView from './pages/QuoteView'
import InvoiceView from './pages/InvoiceView'
import BookingPage from './pages/BookingPage'
import CertificateForm from './pages/CertificateForm'
import Integrations from './pages/Integrations'
import { UndoProvider } from './hooks/useUndo'
import { useTheme } from './theme/ThemeContext'
import type { ReactNode, CSSProperties } from 'react'

function LoadingScreen() {
  const { C } = useTheme()
  const s: Record<string, CSSProperties> = {
    page: {
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: C.black, flexDirection: 'column', gap: 16,
    },
    brand: {
      fontFamily: "'Cinzel', serif", fontSize: 28, fontWeight: 700, color: C.gold,
    },
    spinner: {
      width: 32, height: 32, border: `3px solid ${C.steel}33`,
      borderTopColor: C.gold, borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    },
  }

  return (
    <div style={s.page}>
      <div style={s.brand}>Varda</div>
      <div style={s.spinner} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, needsOnboarding } = useAuth()
  if (isLoading) return <LoadingScreen />
  if (needsOnboarding) return <Navigate to="/" replace />
  if (isAuthenticated) return <Navigate to="/" replace />
  return <>{children}</>
}

const ROLE_LEVEL: Record<string, number> = { member: 0, admin: 1, owner: 2 }

/** Guards a route so only users with the minimum role can access it */
function RoleGuard({ minRole, children }: { minRole: 'admin' | 'owner'; children: ReactNode }) {
  const { user } = useAuth()
  const userLevel = ROLE_LEVEL[user?.role ?? 'member'] ?? 0
  const requiredLevel = ROLE_LEVEL[minRole] ?? 0
  if (userLevel < requiredLevel) return <Navigate to="/" replace />
  return <>{children}</>
}

/** Wraps all authenticated routes — provides DataProvider with orgId from auth */
function AuthenticatedApp() {
  const { user, isLoading, isAuthenticated, needsOnboarding } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (!isAuthenticated && !needsOnboarding) return <Navigate to="/landing" replace />
  if (needsOnboarding) return <Onboarding />
  if (!user) return <LoadingScreen />

  return (
    <DataProvider orgId={user.orgId}>
      <SubscriptionProvider orgId={user.orgId}>
        <UndoProvider>
          <AppShell />
        </UndoProvider>
      </SubscriptionProvider>
    </DataProvider>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/landing" element={<PublicRoute><Landing /></PublicRoute>} />
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/q/:quoteId" element={<QuoteView />} />
              <Route path="/inv/:invoiceId" element={<InvoiceView />} />
              <Route path="/book/:orgId" element={<BookingPage />} />
              <Route path="/*" element={<AuthenticatedApp />}>
                <Route index element={<Dashboard />} />
                <Route path="quote" element={<QuickQuote />} />
                <Route path="jobs" element={<Jobs />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="customers" element={<Customers />} />

                <Route path="insights" element={<RoleGuard minRole="admin"><Insights /></RoleGuard>} />
                <Route path="pricing" element={<RoleGuard minRole="admin"><PricingRules /></RoleGuard>} />
                <Route path="settings" element={<RoleGuard minRole="admin"><SettingsPage /></RoleGuard>} />
                <Route path="expenses" element={<RoleGuard minRole="admin"><Expenses /></RoleGuard>} />
                <Route path="integrations" element={<RoleGuard minRole="admin"><Integrations /></RoleGuard>} />
                <Route path="certificates/:jobId" element={<CertificateForm />} />
                <Route path="plans" element={<RoleGuard minRole="owner"><PricingPage /></RoleGuard>} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
