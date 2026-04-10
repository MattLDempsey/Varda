import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

export type Plan = 'trial' | 'starter' | 'pro' | 'business'
export type SubStatus = 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired'

export interface Subscription {
  plan: Plan
  status: SubStatus
  trialEndsAt: string | null
  currentPeriodEnd: string | null
}

export interface PlanFeatures {
  maxUsers: number
  maxActiveJobs: number | null
  maxCustomers: number | null
  multiLineQuotes: boolean
  invoicing: boolean
  multiInvoice: boolean        // deposit, progress, final (Pro+)
  expenses: boolean
  insightsBasic: boolean
  insightsAdvanced: boolean
  smartAlerts: boolean          // pricing intelligence alerts (Pro+)
  communications: boolean
  teamManagement: boolean
  jobAssignment: boolean        // assign jobs to team members (Business)
  activityLog: boolean          // audit trail (Business)
  customJobTypes: boolean       // add custom job types (Business)
  csvExport: boolean
  pdfInvoices: boolean
  customerQuotePage: boolean
  pricingRules: boolean
  calendarFull: boolean
  calendarDrag: boolean         // drag/resize on calendar (Pro+)
}

export interface SubscriptionContextValue {
  subscription: Subscription | null
  features: PlanFeatures | null
  isActive: boolean // trial or active subscription
  daysLeft: number | null // trial days remaining
  plan: Plan
  canUse: (feature: keyof PlanFeatures) => boolean
  isLoading: boolean
}

const _DEFAULT_FEATURES: PlanFeatures = {
  maxUsers: 1, maxActiveJobs: null, maxCustomers: null,
  multiLineQuotes: false, invoicing: true, multiInvoice: false,
  expenses: false, insightsBasic: false, insightsAdvanced: false,
  smartAlerts: false, communications: false,
  teamManagement: false, jobAssignment: false, activityLog: false,
  customJobTypes: false, csvExport: false, pdfInvoices: true,
  customerQuotePage: true, pricingRules: false,
  calendarFull: false, calendarDrag: false,
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  subscription: null, features: null, isActive: false, daysLeft: null,
  plan: 'starter', canUse: () => false, isLoading: true,
})

export function SubscriptionProvider({ orgId, children }: { orgId: string; children: ReactNode }) {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [features, setFeatures] = useState<PlanFeatures | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!orgId) return

    async function load() {
      try {
        // Fetch subscription
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('plan, status, trial_ends_at, current_period_end')
          .eq('org_id', orgId)
          .maybeSingle()

        if (sub) {
          setSubscription({
            plan: sub.plan,
            status: sub.status,
            trialEndsAt: sub.trial_ends_at,
            currentPeriodEnd: sub.current_period_end,
          })

          // Fetch features for this plan
          const { data: feat } = await supabase
            .from('plan_features')
            .select('*')
            .eq('plan', sub.plan)
            .maybeSingle()

          if (feat) {
            setFeatures({
              maxUsers: feat.max_users ?? 1,
              maxActiveJobs: feat.max_active_jobs ?? null,
              maxCustomers: feat.max_customers ?? null,
              multiLineQuotes: feat.multi_line_quotes ?? false,
              invoicing: feat.invoicing ?? true,
              multiInvoice: feat.multi_invoice ?? false,
              expenses: feat.expenses ?? false,
              insightsBasic: feat.insights_basic ?? false,
              insightsAdvanced: feat.insights_advanced ?? false,
              smartAlerts: feat.smart_alerts ?? false,
              communications: feat.communications ?? false,
              teamManagement: feat.team_management ?? false,
              jobAssignment: feat.job_assignment ?? false,
              activityLog: feat.activity_log ?? false,
              customJobTypes: feat.custom_job_types ?? false,
              csvExport: feat.csv_export ?? false,
              pdfInvoices: feat.pdf_invoices ?? true,
              customerQuotePage: feat.customer_quote_page ?? true,
              pricingRules: feat.pricing_rules ?? false,
              calendarFull: feat.calendar_full ?? false,
              calendarDrag: feat.calendar_drag ?? false,
            })
          }
        }
      } catch (err) {
        console.error('[Subscription] Failed to load:', err)
      }
      setIsLoading(false)
    }

    load()
  }, [orgId])

  const plan = subscription?.plan ?? 'starter'
  const isActive = subscription?.status === 'trialing' || subscription?.status === 'active'

  const daysLeft = (() => {
    if (subscription?.status !== 'trialing' || !subscription.trialEndsAt) return null
    const diff = new Date(subscription.trialEndsAt).getTime() - Date.now()
    return Math.max(0, Math.ceil(diff / 86400000))
  })()

  const canUse = (feature: keyof PlanFeatures): boolean => {
    if (!isActive) return false
    if (!features) return false
    const val = features[feature]
    return typeof val === 'boolean' ? val : true
  }

  return (
    <SubscriptionContext.Provider value={{
      subscription, features, isActive, daysLeft, plan, canUse, isLoading,
    }}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  return useContext(SubscriptionContext)
}
