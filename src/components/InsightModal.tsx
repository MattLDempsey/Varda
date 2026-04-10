import type { CSSProperties, ReactNode } from 'react'
import { X } from 'lucide-react'
import { useTheme } from '../theme/ThemeContext'

/**
 * Reusable modal wrapper for Insights drill-down views.
 * Renders a fixed overlay + centred panel with a title and close button.
 */
export default function InsightModal({
  title,
  subtitle,
  onClose,
  children,
  width = 580,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  width?: number
}) {
  const { C } = useTheme()

  const s: Record<string, CSSProperties> = {
    overlay: {
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)',
      zIndex: 200,
    },
    modal: {
      position: 'fixed', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      background: C.charcoalLight, borderRadius: 16,
      padding: 'clamp(20px, 4vw, 28px)',
      width: `min(${width}px, calc(100vw - 24px))`,
      maxHeight: 'calc(100dvh - 24px)', overflowY: 'auto',
      zIndex: 210, boxShadow: '0 16px 48px rgba(0,0,0,.5)',
      border: `1px solid ${C.steel}44`,
    },
    header: {
      display: 'flex', justifyContent: 'space-between',
      alignItems: 'flex-start', gap: 12, marginBottom: 16,
    },
    title: { fontSize: 20, fontWeight: 700, color: C.white },
    subtitle: { fontSize: 12, color: C.silver, marginTop: 2 },
    closeBtn: {
      background: 'transparent', border: 'none', color: C.silver,
      cursor: 'pointer', padding: 4, display: 'flex', flexShrink: 0,
    },
  }

  return (
    <>
      <div style={s.overlay} onClick={onClose} />
      <div style={s.modal}>
        <div style={s.header}>
          <div>
            <div style={s.title}>{title}</div>
            {subtitle && <div style={s.subtitle}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={s.closeBtn} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </>
  )
}
