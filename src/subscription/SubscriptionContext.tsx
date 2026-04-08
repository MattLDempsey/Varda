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
  expenses: boolean
  insightsBasic: boolean
  insightsAdvanced: boolean
  communications: boolean
  teamManagement: boolean
  csvExport: boolean
  pdfInvoices: boolean
  customerQuotePage: boolean
  pricingRules: boolean
  calendarFull: boolean
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
  maxUsers: 1, maxActiveJobs: 20, maxCustomers: 50,
  multiLineQuotes: false, invoicing: false, expenses: false,
  insightsBasic: false, insightsAdvanced: false, communications: false,
  teamManagement: false, csvExport: false, pdfInvoices: false,
  customerQuotePage: false, pricingRules: false, calendarFull: false,
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
              maxUsers: feat.max_users,
              maxActiveJobs: feat.max_active_jobs,
              maxCustomers: feat.max_customers,
              multiLineQuotes: feat.multi_line_quotes,
              invoicing: feat.invoicing,
              expenses: feat.expenses,
              insightsBasic: feat.insights_basic,
              insightsAdvanced: feat.insights_advanced,
              communications: feat.communications,
              teamManagement: feat.team_management,
              csvExport: feat.csv_export,
              pdfInvoices: feat.pdf_invoices,
              customerQuotePage: feat.customer_quote_page,
              pricingRules: feat.pricing_rules,
              calendarFull: feat.calendar_full,
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
