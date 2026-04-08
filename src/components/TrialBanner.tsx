import type { CSSProperties } from 'react'
import { useSubscription } from '../subscription/SubscriptionContext'

export default function TrialBanner() {
  const { subscription, daysLeft, isActive, plan } = useSubscription()

  // Only show for trial users or expired trials
  const isTrial = subscription?.status === 'trialing'
  const isExpired = subscription?.status === 'expired'

  if (!isTrial && !isExpired) return null
  // If they have an active paid plan, don't show
  if (plan !== 'trial' && isActive) return null

  const expired = isExpired || (daysLeft !== null && daysLeft <= 0)

  const s: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 32,
    fontSize: 13,
    fontWeight: 600,
    color: expired ? '#fff' : '#1A1C20',
    background: expired ? '#D46A6A' : '#C6A86A',
    width: '100%',
    flexShrink: 0,
  }

  const linkStyle: CSSProperties = {
    color: expired ? '#fff' : '#1A1C20',
    textDecoration: 'underline',
    fontWeight: 700,
    marginLeft: 4,
  }

  if (expired) {
    return (
      <div style={s}>
        Your trial has expired —
        <a href="/pricing" style={linkStyle}>choose a plan to continue</a>
      </div>
    )
  }

  return (
    <div style={s}>
      You're on a free trial — {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
      <a href="/pricing" style={linkStyle}>Choose Plan</a>
    </div>
  )
}
