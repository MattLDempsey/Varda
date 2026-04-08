import type { CSSProperties } from 'react'
import { useTheme } from '../theme/ThemeContext'

interface LoadingSpinnerProps {
  message?: string
  size?: 'small' | 'medium' | 'large'
}

export default function LoadingSpinner({ message, size = 'medium' }: LoadingSpinnerProps) {
  const { C } = useTheme()

  const dim = size === 'small' ? 20 : size === 'large' ? 40 : 28

  const s: Record<string, CSSProperties> = {
    wrap: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
      padding: '48px 24px',
      width: '100%',
    },
    spinner: {
      width: dim,
      height: dim,
      border: `3px solid ${C.steel}33`,
      borderTopColor: C.gold,
      borderRadius: '50%',
      animation: 'gh-spin 0.8s linear infinite',
    },
    message: {
      fontSize: 14,
      color: C.silver,
      textAlign: 'center',
    },
  }

  return (
    <div style={s.wrap}>
      <div style={s.spinner} />
      {message && <div style={s.message}>{message}</div>}
      <style>{`@keyframes gh-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
