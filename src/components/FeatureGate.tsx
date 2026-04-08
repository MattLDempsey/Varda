import type { ReactNode, CSSProperties } from 'react'
import { Lock } from 'lucide-react'
import { useTheme } from '../theme/ThemeContext'
import { useSubscription, type Plan } from '../subscription/SubscriptionContext'

/**
 * Map of feature keys to the minimum plan required and a short description.
 */
const FEATURE_META: Record<string, { requiredPlan: Plan; description: string }> = {
  multiLineQuotes: { requiredPlan: 'pro', description: 'Create multi-line quotes with multiple job types in a single quote.' },
  invoicing: { requiredPlan: 'pro', description: 'Generate and send professional invoices to your customers.' },
  expenses: { requiredPlan: 'pro', description: 'Track business expenses, VAT, and link costs to jobs.' },
  insightsBasic: { requiredPlan: 'pro', description: 'View revenue, win rate, and job performance metrics.' },
  insightsAdvanced: { requiredPlan: 'business', description: 'Access forecasts, margin analysis, and tax summaries.' },
  communications: { requiredPlan: 'pro', description: 'Send templated emails and WhatsApp messages to customers.' },
  teamManagement: { requiredPlan: 'business', description: 'Manage team members, roles, and permissions.' },
  csvExport: { requiredPlan: 'pro', description: 'Export your data to CSV for accounting and reporting.' },
  pdfInvoices: { requiredPlan: 'pro', description: 'Generate professional PDF invoices and quotes.' },
  customerQuotePage: { requiredPlan: 'pro', description: 'Share a branded quote page with your customers.' },
  pricingRules: { requiredPlan: 'pro', description: 'Customise labour rates, margins, and job type defaults.' },
  calendarFull: { requiredPlan: 'pro', description: 'Full calendar with scheduling, drag-and-drop, and reminders.' },
}

interface FeatureGateProps {
  feature: string
  children: ReactNode
  fallback?: ReactNode
}

export default function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const { canUse, isLoading } = useSubscription()
  const { C } = useTheme()

  // While loading, show children to avoid flash
  if (isLoading) return <>{children}</>

  const hasAccess = canUse(feature as any)
  if (hasAccess) return <>{children}</>

  const meta = FEATURE_META[feature]
  const requiredPlan = meta?.requiredPlan ?? 'pro'
  const description = meta?.description ?? 'This feature requires a higher plan.'

  if (fallback) return <>{fallback}</>

  const planLabel = requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)

  const s: Record<string, CSSProperties> = {
    wrapper: {
      position: 'relative',
      minHeight: 200,
    },
    content: {
      filter: 'blur(3px)',
      opacity: 0.4,
      pointerEvents: 'none',
      userSelect: 'none',
    },
    overlay: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
      background: 'rgba(0,0,0,0.15)',
      borderRadius: 12,
    },
    card: {
      background: C.charcoalLight,
      border: `1px solid ${C.steel}44`,
      borderRadius: 14,
      padding: '32px 36px',
      textAlign: 'center',
      maxWidth: 380,
      boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
    },
    lockIcon: {
      width: 48,
      height: 48,
      borderRadius: '50%',
      background: `${C.gold}1A`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto 16px',
    },
    heading: {
      fontSize: 18,
      fontWeight: 700,
      color: C.white,
      marginBottom: 8,
    },
    desc: {
      fontSize: 13,
      color: C.silver,
      lineHeight: 1.6,
      marginBottom: 20,
    },
    btn: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '10px 24px',
      borderRadius: 10,
      border: 'none',
      cursor: 'pointer',
      fontSize: 14,
      fontWeight: 600,
      background: C.gold,
      color: C.black,
      minHeight: 44,
      transition: 'opacity .15s',
    },
  }

  return (
    <div style={s.wrapper}>
      <div style={s.content}>
        {children}
      </div>
      <div style={s.overlay}>
        <div style={s.card}>
          <div style={s.lockIcon}>
            <Lock size={22} color={C.gold} />
          </div>
          <div style={s.heading}>Upgrade to {planLabel}</div>
          <div style={s.desc}>{description}</div>
          <a href="/plans" style={{ textDecoration: 'none' }}>
            <button style={s.btn}>View Plans</button>
          </a>
        </div>
      </div>
    </div>
  )
}

/**
 * Inline limit warning banner for maxActiveJobs / maxCustomers.
 */
export function LimitWarning({ current, max, label, plan }: {
  current: number
  max: number | null
  label: string
  plan: string
}) {
  const { C } = useTheme()

  if (max === null || current < max) return null

  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1)

  const s: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 16px',
    borderRadius: 10,
    background: `${C.gold}15`,
    border: `1px solid ${C.gold}33`,
    fontSize: 13,
    color: C.gold,
    marginBottom: 16,
    lineHeight: 1.5,
  }

  return (
    <div style={s}>
      <Lock size={14} style={{ flexShrink: 0 }} />
      <span>
        You've used <strong>{current}</strong> of <strong>{max}</strong> {label} on the {planLabel} plan.{' '}
        <a href="/plans" style={{ color: C.gold, fontWeight: 600 }}>Upgrade for unlimited.</a>
      </span>
    </div>
  )
}
