import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import { ThemeProvider } from './theme/ThemeContext'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { DataProvider } from './data/DataContext'
import { SubscriptionProvider } from './subscription/SubscriptionContext'
import AppShell from './components/layout/AppShell'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import QuickQuote from './pages/QuickQuote'
import Jobs from './pages/Jobs'
import CalendarPage from './pages/CalendarPage'
import Customers from './pages/Customers'
import Comms from './pages/Comms'
import Insights from './pages/Insights'
import PricingRules from './pages/PricingRules'
import SettingsPage from './pages/SettingsPage'
import Expenses from './pages/Expenses'
import PricingPage from './pages/Pricing'
import QuoteView from './pages/QuoteView'
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

/** Wraps all authenticated routes — provides DataProvider with orgId from auth */
function AuthenticatedApp() {
  const { user, isLoading, isAuthenticated, needsOnboarding } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (!isAuthenticated && !needsOnboarding) return <Navigate to="/login" replace />
  if (needsOnboarding) return <Onboarding />
  if (!user) return <LoadingScreen />

  return (
    <DataProvider orgId={user.orgId}>
      <SubscriptionProvider orgId={user.orgId}>
        <AppShell />
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
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/q/:quoteId" element={<QuoteView />} />
              <Route path="/*" element={<AuthenticatedApp />}>
                <Route index element={<Dashboard />} />
                <Route path="quote" element={<QuickQuote />} />
                <Route path="jobs" element={<Jobs />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="customers" element={<Customers />} />
                <Route path="comms" element={<Comms />} />
                <Route path="insights" element={<Insights />} />
                <Route path="pricing" element={<PricingRules />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="expenses" element={<Expenses />} />
                <Route path="plans" element={<PricingPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
