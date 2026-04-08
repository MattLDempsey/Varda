import { useState } from 'react'
import type { CSSProperties } from 'react'
import { X } from 'lucide-react'
import { useSubscription } from '../subscription/SubscriptionContext'

export default function TrialBanner() {
  const { subscription, daysLeft, isActive, plan } = useSubscription()
  const [dismissed, setDismissed] = useState(false)

  // Only show for trial users or expired trials
  const isTrial = subscription?.status === 'trialing'
  const isExpired = subscription?.status === 'expired'

  if (!isTrial && !isExpired) return null
  if (plan !== 'trial' && isActive) return null
  if (dismissed) return null

  const expired = isExpired || (daysLeft !== null && daysLeft <= 0)

  // Don't allow dismissing expired banner — they need to act
  const canDismiss = !expired

  const s: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 36,
    fontSize: 13,
    fontWeight: 600,
    color: expired ? '#fff' : '#1A1C20',
    background: expired ? '#D46A6A' : '#C6A86A',
    width: '100%',
    flexShrink: 0,
    position: 'relative',
  }

  const linkStyle: CSSProperties = {
    color: expired ? '#fff' : '#1A1C20',
    textDecoration: 'underline',
    fontWeight: 700,
    marginLeft: 4,
  }

  const closeStyle: CSSProperties = {
    position: 'absolute',
    right: 12,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: expired ? '#fff' : '#1A1C20',
    opacity: 0.6,
    display: 'flex',
    alignItems: 'center',
    padding: 4,
  }

  if (expired) {
    return (
      <div style={s}>
        Your trial has expired —
        <a href="/plans" style={linkStyle}>choose a plan to continue</a>
      </div>
    )
  }

  return (
    <div style={s}>
      You're on a free trial — {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
      <a href="/plans" style={linkStyle}>Choose Plan</a>
      {canDismiss && (
        <button style={closeStyle} onClick={() => setDismissed(true)} title="Dismiss">
          <X size={16} />
        </button>
      )}
    </div>
  )
}
