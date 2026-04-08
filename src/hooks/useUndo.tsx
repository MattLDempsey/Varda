import { createContext, useContext, useState, useRef, useCallback, type ReactNode, type CSSProperties } from 'react'

interface UndoAction {
  message: string
  undo: () => void
}

interface UndoContextValue {
  showUndo: (action: UndoAction) => void
}

const UndoContext = createContext<UndoContextValue>({ showUndo: () => {} })

export function useUndo() {
  return useContext(UndoContext)
}

export function UndoProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<UndoAction | null>(null)
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismiss = useCallback(() => {
    setVisible(false)
    setTimeout(() => setActive(null), 300)
  }, [])

  const showUndo = useCallback((action: UndoAction) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setActive(action)
    setVisible(true)
    timerRef.current = setTimeout(() => {
      dismiss()
    }, 5000)
  }, [dismiss])

  const handleUndo = () => {
    if (!active) return
    if (timerRef.current) clearTimeout(timerRef.current)
    active.undo()
    dismiss()
  }

  const s: Record<string, CSSProperties> = {
    toast: {
      position: 'fixed',
      bottom: visible ? 32 : -80,
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#1A1D21',
      border: '1px solid #3A3F47',
      borderRadius: 12,
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      zIndex: 9999,
      boxShadow: '0 8px 32px rgba(0,0,0,.6)',
      transition: 'bottom .3s ease',
      minWidth: 280,
    },
    message: {
      fontSize: 14,
      color: '#C9CDD2',
      flex: 1,
      whiteSpace: 'nowrap',
    },
    undoBtn: {
      background: 'transparent',
      border: '1px solid #C6A86A',
      borderRadius: 8,
      padding: '6px 16px',
      color: '#C6A86A',
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      transition: 'background .15s',
    },
  }

  return (
    <UndoContext.Provider value={{ showUndo }}>
      {children}
      {active && (
        <div style={s.toast}>
          <span style={s.message}>{active.message}</span>
          <button
            style={s.undoBtn}
            onClick={handleUndo}
            onMouseEnter={e => { e.currentTarget.style.background = '#C6A86A22' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            Undo
          </button>
        </div>
      )}
    </UndoContext.Provider>
  )
}
