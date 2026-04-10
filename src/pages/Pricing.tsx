import { useState } from 'react'
import { Check, Crown } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useTheme } from '../theme/ThemeContext'
import { useSubscription, type Plan } from '../subscription/SubscriptionContext'

/* ── plan data ── */

interface PlanTier {
  id: Plan
  name: string
  monthlyPrice: number
  annualPrice: number
  users: string
  features: string[]
  popular?: boolean
}

const plans: PlanTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 19,
    annualPrice: 15,
    users: '1 user',
    features: [
      '20 active jobs, 50 customers',
      'Quick Quote (single line)',
      'Jobs kanban & table',
      'Basic calendar (week view)',
      'PDF quotes',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 49,
    annualPrice: 39,
    users: '3 users',
    popular: true,
    features: [
      'Unlimited jobs & customers',
      'Multi-line quotes',
      'Full calendar',
      'Invoicing & expenses',
      'Communications',
      'Basic insights',
      'Customer quote page',
      'Pricing rules',
      'PDF invoices',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    monthlyPrice: 99,
    annualPrice: 79,
    users: 'Unlimited users',
    features: [
      'Everything in Pro',
      'Advanced insights (forecast, margins, tax)',
      'Team management',
      'CSV export',
      'Priority support',
    ],
  },
]

export default function PricingPage() {
  const { C } = useTheme()
  const { plan: currentPlan } = useSubscription()
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual')

  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState('')

  async function handleChoose(planId: Plan) {
    if (planId === currentPlan) return
    setCheckoutLoading(planId)
    try {
      const { supabase } = await import('../lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ plan: planId, billing }),
        }
      )
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setCheckoutError(data.error || 'Failed to create checkout session. Please try again.')
      }
    } catch {
      setCheckoutError('Failed to connect to payment system. Please try again.')
    }
    setCheckoutLoading(null)
  }

  const s: Record<string, CSSProperties> = {
    page: {
      padding: '32px',
      maxWidth: 1100,
      margin: '0 auto',
    },
    heading: {
      fontSize: 28,
      fontWeight: 600,
      color: C.white,
      textAlign: 'center',
      marginBottom: 4,
    },
    subheading: {
      fontSize: 14,
      color: C.silver,
      textAlign: 'center',
      marginBottom: 28,
    },
    toggleWrap: {
      display: 'flex',
      justifyContent: 'center',
      marginBottom: 36,
    },
    toggleContainer: {
      display: 'flex',
      background: C.black,
      borderRadius: 10,
      padding: 4,
      gap: 4,
    },
    toggleBtn: {
      padding: '10px 24px',
      border: 'none',
      borderRadius: 8,
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 600,
      transition: 'all .15s',
      minHeight: 40,
    },
    saveBadge: {
      fontSize: 11,
      fontWeight: 700,
      color: C.green,
      marginLeft: 6,
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
      gap: 20,
      alignItems: 'start',
    },
    card: {
      background: C.charcoalLight,
      borderRadius: 16,
      padding: '28px 24px',
      border: `1px solid ${C.steel}44`,
      position: 'relative',
      transition: 'transform .2s, box-shadow .2s',
    },
    cardPopular: {
      background: C.charcoalLight,
      borderRadius: 16,
      padding: '28px 24px',
      border: `2px solid ${C.gold}`,
      position: 'relative',
      transform: 'scale(1.03)',
      boxShadow: `0 8px 32px ${C.gold}22`,
    },
    popularBadge: {
      position: 'absolute',
      top: -12,
      left: '50%',
      transform: 'translateX(-50%)',
      background: C.gold,
      color: C.black,
      fontSize: 11,
      fontWeight: 700,
      padding: '4px 16px',
      borderRadius: 20,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      whiteSpace: 'nowrap',
    },
    planName: {
      fontSize: 20,
      fontWeight: 700,
      color: C.white,
      marginBottom: 4,
    },
    users: {
      fontSize: 13,
      color: C.silver,
      marginBottom: 16,
    },
    priceRow: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 4,
      marginBottom: 4,
    },
    price: {
      fontSize: 40,
      fontWeight: 800,
      color: C.white,
      lineHeight: 1,
    },
    priceUnit: {
      fontSize: 14,
      color: C.silver,
      fontWeight: 500,
    },
    billedNote: {
      fontSize: 12,
      color: C.steel,
      marginBottom: 24,
    },
    featureList: {
      listStyle: 'none',
      padding: 0,
      margin: '0 0 24px 0',
    },
    featureItem: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      padding: '6px 0',
      fontSize: 13,
      color: C.silver,
      lineHeight: 1.4,
    },
    checkIcon: {
      flexShrink: 0,
      marginTop: 1,
    },
    chooseBtn: {
      width: '100%',
      padding: '12px 0',
      border: 'none',
      borderRadius: 10,
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all .15s',
      minHeight: 44,
    },
    chooseBtnActive: {
      background: C.gold,
      color: C.black,
    },
    chooseBtnCurrent: {
      background: `${C.steel}33`,
      color: C.steel,
      cursor: 'default',
    },
  }

  return (
    <div style={s.page}>
      <h1 style={s.heading}>Choose Your Plan</h1>
      <p style={s.subheading}>Simple pricing for every stage of your business.</p>

      {/* billing toggle */}
      <div style={s.toggleWrap}>
        <div style={s.toggleContainer}>
          <button
            style={{
              ...s.toggleBtn,
              background: billing === 'monthly' ? C.charcoalLight : 'transparent',
              color: billing === 'monthly' ? C.white : C.steel,
            }}
            onClick={() => setBilling('monthly')}
          >
            Monthly
          </button>
          <button
            style={{
              ...s.toggleBtn,
              background: billing === 'annual' ? C.charcoalLight : 'transparent',
              color: billing === 'annual' ? C.white : C.steel,
            }}
            onClick={() => setBilling('annual')}
          >
            Annual
            <span style={s.saveBadge}>Save 20%</span>
          </button>
        </div>
      </div>

      {/* plan cards */}
      <div style={s.grid}>
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlan
          const isPopular = !!plan.popular
          const price = billing === 'annual' ? plan.annualPrice : plan.monthlyPrice

          return (
            <div
              key={plan.id}
              style={isPopular ? s.cardPopular : s.card}
            >
              {isPopular && (
                <div style={s.popularBadge}>
                  <Crown size={12} /> Most Popular
                </div>
              )}

              <div style={s.planName}>{plan.name}</div>
              <div style={s.users}>{plan.users}</div>

              <div style={s.priceRow}>
                <span style={s.price}>{'\u00A3'}{price}</span>
                <span style={s.priceUnit}>/mo</span>
              </div>
              <div style={s.billedNote}>
                {billing === 'annual'
                  ? `Billed \u00A3${price * 12}/year`
                  : 'Billed monthly'}
              </div>

              <ul style={s.featureList}>
                {plan.features.map((feat, i) => (
                  <li key={i} style={s.featureItem}>
                    <Check size={16} color={C.green} style={s.checkIcon} />
                    {feat}
                  </li>
                ))}
              </ul>

              <button
                style={{
                  ...s.chooseBtn,
                  ...(isCurrent ? s.chooseBtnCurrent : s.chooseBtnActive),
                }}
                onClick={() => handleChoose(plan.id)}
                disabled={isCurrent || checkoutLoading === plan.id}
              >
                {isCurrent ? 'Current Plan' : checkoutLoading === plan.id ? 'Loading...' : 'Choose Plan'}
              </button>
              {checkoutError && checkoutLoading === null && (
                <div style={{ fontSize: 12, color: '#D46A6A', textAlign: 'center', marginTop: 8, padding: '6px 10px', borderRadius: 6, background: '#D46A6A15' }}>
                  {checkoutError}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
