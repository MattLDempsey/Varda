import { useNavigate } from 'react-router-dom'
import { useTheme } from '../theme/ThemeContext'
import type { CSSProperties } from 'react'

const items = [
  { key: 'settings', label: 'Settings', path: '/settings' },
  { key: 'pricing', label: 'Pricing Rules', path: '/pricing' },
  { key: 'integrations', label: 'Integrations', path: '/integrations' },
] as const

type ActivePage = typeof items[number]['key']

export default function SettingsNav({ active }: { active: ActivePage }) {
  const navigate = useNavigate()
  const { C } = useTheme()

  const s: Record<string, CSSProperties> = {
    nav: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      marginBottom: 20,
      paddingBottom: 12,
      borderBottom: `1px solid ${C.steel}22`,
    },
    link: {
      padding: '6px 14px',
      borderRadius: 8,
      border: 'none',
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 600,
      transition: 'background .15s',
      minHeight: 36,
    },
    sep: {
      color: C.steel,
      fontSize: 13,
      opacity: 0.4,
      userSelect: 'none',
    },
  }

  return (
    <div style={s.nav}>
      {items.map((item, i) => (
        <span key={item.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {i > 0 && <span style={s.sep}>|</span>}
          <button
            style={{
              ...s.link,
              background: active === item.key ? `${C.gold}15` : 'transparent',
              color: active === item.key ? C.gold : C.steel,
            }}
            onClick={() => {
              if (active !== item.key) navigate(item.path)
            }}
            onMouseEnter={e => {
              if (active !== item.key) e.currentTarget.style.background = `${C.steel}15`
            }}
            onMouseLeave={e => {
              if (active !== item.key) e.currentTarget.style.background = 'transparent'
            }}
          >
            {item.label}
          </button>
        </span>
      ))}
    </div>
  )
}
