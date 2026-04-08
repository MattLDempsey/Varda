import type { CSSProperties } from 'react'
import { useTheme } from '../theme/ThemeContext'

/* ── Shimmer keyframes (injected once) ── */
const shimmerCSS = `
@keyframes skeleton-shimmer {
  0% { background-position: -200px 0; }
  100% { background-position: 200px 0; }
}
`

let injected = false
function injectCSS() {
  if (injected) return
  injected = true
  const style = document.createElement('style')
  style.textContent = shimmerCSS
  document.head.appendChild(style)
}

function useShimmerStyle(): CSSProperties {
  const { C } = useTheme()
  injectCSS()
  return {
    background: `linear-gradient(90deg, ${C.charcoalLight} 0%, ${C.steel}33 50%, ${C.charcoalLight} 100%)`,
    backgroundSize: '400px 100%',
    animation: 'skeleton-shimmer 1.5s ease-in-out infinite',
    borderRadius: 8,
  }
}

/** Rectangle card skeleton */
export function SkeletonCard({ height = 100 }: { height?: number }) {
  const shimmer = useShimmerStyle()
  const { C } = useTheme()
  return (
    <div style={{
      ...shimmer,
      height,
      borderRadius: 12,
      borderLeft: `4px solid ${C.steel}44`,
    }} />
  )
}

/** Single line of text skeleton */
export function SkeletonText({ width = '100%', height = 14 }: { width?: string | number; height?: number }) {
  const shimmer = useShimmerStyle()
  return (
    <div style={{
      ...shimmer,
      width,
      height,
      borderRadius: 4,
    }} />
  )
}

/** Table row skeleton */
export function SkeletonRow() {
  const shimmer = useShimmerStyle()
  const { C } = useTheme()
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 12px',
      borderRadius: 8,
      background: C.charcoalLight,
    }}>
      <div style={{ ...shimmer, width: 40, height: 40, borderRadius: 8, flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ ...shimmer, width: '60%', height: 14, borderRadius: 4 }} />
        <div style={{ ...shimmer, width: '40%', height: 10, borderRadius: 4 }} />
      </div>
      <div style={{ ...shimmer, width: 60, height: 24, borderRadius: 12 }} />
    </div>
  )
}

/** Kanban column skeleton with placeholder cards */
export function SkeletonKanban() {
  const shimmer = useShimmerStyle()
  const { C } = useTheme()

  const column = (count: number, i: number) => (
    <div key={i} style={{
      background: C.black,
      borderRadius: 12,
      padding: 12,
      minWidth: 140,
    }}>
      {/* column header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '0 4px' }}>
        <div style={{ ...shimmer, width: 80, height: 12, borderRadius: 4 }} />
        <div style={{ ...shimmer, width: 24, height: 18, borderRadius: 10 }} />
      </div>
      {/* cards */}
      {Array.from({ length: count }).map((_, j) => (
        <div key={j} style={{
          background: C.charcoalLight,
          borderRadius: 10,
          padding: '14px 14px 12px',
          marginBottom: 10,
          borderLeft: `3px solid ${C.steel}44`,
        }}>
          <div style={{ ...shimmer, width: '80%', height: 14, borderRadius: 4, marginBottom: 6 }} />
          <div style={{ ...shimmer, width: '50%', height: 10, borderRadius: 4, marginBottom: 10 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ ...shimmer, width: 50, height: 14, borderRadius: 4 }} />
            <div style={{ ...shimmer, width: 40, height: 10, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(7, minmax(150px, 1fr))',
      gap: 12,
      overflowX: 'auto' as const,
    }}>
      {[3, 2, 1, 2, 1, 2, 1].map((count, i) => column(count, i))}
    </div>
  )
}

/** Dashboard loading skeleton: KPI cards + panels */
export function SkeletonDashboard() {
  const shimmer = useShimmerStyle()
  const { C } = useTheme()

  return (
    <>
      {/* KPI cards row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16, marginBottom: 28 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{
            background: C.charcoalLight,
            borderRadius: 12,
            padding: '20px 20px 16px',
            borderLeft: `4px solid ${C.steel}44`,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            <div style={{ ...shimmer, width: 80, height: 28, borderRadius: 4 }} />
            <div style={{ ...shimmer, width: 100, height: 12, borderRadius: 4 }} />
          </div>
        ))}
      </div>

      {/* Two column panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 28 }}>
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} style={{
            background: C.charcoalLight,
            borderRadius: 12,
            padding: '20px 24px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ ...shimmer, width: 120, height: 16, borderRadius: 4 }} />
              <div style={{ ...shimmer, width: 80, height: 12, borderRadius: 4 }} />
            </div>
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} style={{ marginBottom: 8 }}>
                <SkeletonRow />
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
