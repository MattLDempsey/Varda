import { useState, useRef, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { X, CheckCircle } from 'lucide-react'
import { useTheme } from '../theme/ThemeContext'
import { useData, type ScheduleEvent } from '../data/DataContext'

/* ──────────────────────────────────────────────────────
   ConflictResolverModal
   Focused mini calendar for resolving schedule clashes
   between a customer job's events and internal entries
   (travel, stock check, admin, etc) WITHOUT leaving the
   job detail panel.

   For each conflict day we render a tight time grid
   showing every event on that day. Customer events are
   locked (gold, non-draggable) — they're the priority.
   Internal events are draggable vertically and have a
   delete X. Drag snaps to 30 minutes and clamps so an
   internal entry can never be dropped on top of a
   customer block. Once every conflict is resolved the
   modal auto-dismisses.
   ────────────────────────────────────────────────────── */

interface Props {
  /** ID of the customer job whose conflicts we're resolving */
  jobId: string
  /** Called when the modal should close */
  onClose: () => void
}

const SLOT_DEFAULTS: Record<string, { start: string; end: string }> = {
  morning:   { start: '08:00', end: '12:00' },
  afternoon: { start: '12:00', end: '17:00' },
  full:      { start: '08:00', end: '17:00' },
  quick:     { start: '08:00', end: '09:00' },
}

const parseHHMM = (s: string): number => {
  const [h, m] = s.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

const formatHHMM = (mins: number): string => {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, mins))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const eventRange = (ev: ScheduleEvent): { startMin: number; endMin: number } => {
  const def = SLOT_DEFAULTS[ev.slot] ?? SLOT_DEFAULTS.morning
  return {
    startMin: parseHHMM(ev.startTime || def.start),
    endMin: parseHHMM(ev.endTime || def.end),
  }
}

const fmtDate = (iso: string): string => {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

// ── Mini grid constants ──
const HOUR_HEIGHT = 36           // px per hour — smaller than the main calendar
const DAY_START_HOUR = 6
const DAY_END_HOUR = 20
const SNAP_MIN = 30

const snap = (mins: number): number => Math.round(mins / SNAP_MIN) * SNAP_MIN

type DragMode = 'move' | 'resize-top' | 'resize-bottom'

interface DragState {
  eventId: string
  mode: DragMode
  origStart: number
  origEnd: number
  date: string
  pointerStartY: number
  previewStart: number
  previewEnd: number
  clampedTop: boolean
  clampedBottom: boolean
}

export default function ConflictResolverModal({ jobId, onClose }: Props) {
  const { C } = useTheme()
  const { events, updateEvent, deleteEvent } = useData()
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  dragRef.current = drag

  // ── Compute conflicts live so the modal shrinks as the user resolves them ──
  const jobEvents = events.filter(e => e.jobId === jobId)
  const conflicts: Array<{ jobEvent: ScheduleEvent; internal: ScheduleEvent }> = []
  for (const je of jobEvents) {
    const jeRange = eventRange(je)
    const overlapping = events.filter(other =>
      !!other.category
      && other.date === je.date
      && (() => {
        const r = eventRange(other)
        return r.startMin < jeRange.endMin && r.endMin > jeRange.startMin
      })()
    )
    for (const o of overlapping) conflicts.push({ jobEvent: je, internal: o })
  }
  // We deliberately do NOT auto-close when conflicts hit zero — the user
  // should explicitly hit Save & close so they have a moment to review the
  // arrangement and tweak it further if they want.
  const allClear = conflicts.length === 0

  // ── Group by day so we can show one mini grid per affected day. We seed
  //    the day map from the conflict list, then if everything's resolved we
  //    fall back to showing the days the user's job actually runs across so
  //    the grid stays useful while they review the arrangement. ──
  const dayMap = new Map<string, { allEvents: ScheduleEvent[] }>()
  for (const c of conflicts) {
    if (!dayMap.has(c.jobEvent.date)) dayMap.set(c.jobEvent.date, { allEvents: [] })
  }
  if (dayMap.size === 0) {
    // No conflicts left — keep showing the job's days so the user can verify
    // and tweak before closing.
    for (const je of jobEvents) {
      if (!dayMap.has(je.date)) dayMap.set(je.date, { allEvents: [] })
    }
  }
  for (const [date, entry] of dayMap) {
    entry.allEvents = events.filter(e => e.date === date)
  }
  const sortedDays = Array.from(dayMap.keys()).sort()

  // ── Find the contiguous free gap around the candidate position. In the
  //    resolver we treat ALL other events on the day as constraints (both
  //    customer and internal) because the explicit goal is to find a
  //    non-overlapping arrangement. The kind-aware soft-conflict rules
  //    only apply on the main calendar. ──
  const findGap = (excludeId: string, date: string, candidateStart: number, candidateEnd: number) => {
    let floor = DAY_START_HOUR * 60
    let ceiling = DAY_END_HOUR * 60
    const others = events.filter(e =>
      e.id !== excludeId
      && e.date === date
    )
    const mid = (candidateStart + candidateEnd) / 2
    for (const e of others) {
      const t = eventRange(e)
      if (t.endMin <= mid && t.endMin > floor) floor = t.endMin
      if (t.startMin >= mid && t.startMin < ceiling) ceiling = t.startMin
    }
    return { floor, ceiling }
  }

  // ── Global pointer handlers, attached only while a drag is in flight ──
  useEffect(() => {
    if (!drag) return
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const deltaY = e.clientY - d.pointerStartY
      const deltaMins = snap(Math.round((deltaY / HOUR_HEIGHT) * 60))

      let newStart = d.origStart
      let newEnd = d.origEnd
      if (d.mode === 'move') {
        newStart = d.origStart + deltaMins
        newEnd = d.origEnd + deltaMins
      } else if (d.mode === 'resize-top') {
        // Drag the top edge — moves start, leaves end. Refuse to collapse
        // below 30 minutes.
        newStart = Math.min(d.origStart + deltaMins, d.origEnd - SNAP_MIN)
      } else if (d.mode === 'resize-bottom') {
        // Drag the bottom edge — moves end, leaves start.
        newEnd = Math.max(d.origEnd + deltaMins, d.origStart + SNAP_MIN)
      }

      // Clamp to visible range
      const dayMin = DAY_START_HOUR * 60
      const dayMax = DAY_END_HOUR * 60
      if (newStart < dayMin) {
        const shift = dayMin - newStart
        newStart += shift
        if (d.mode === 'move') newEnd += shift
      }
      if (newEnd > dayMax) {
        const shift = newEnd - dayMax
        newEnd -= shift
        if (d.mode === 'move') newStart -= shift
      }

      // Clamp to the contiguous free gap on this day so blocks can't overlap
      const gap = findGap(d.eventId, d.date, newStart, newEnd)
      let clampedTop = false
      let clampedBottom = false
      if (d.mode === 'move') {
        const duration = newEnd - newStart
        if (newStart < gap.floor)   { newStart = gap.floor; newEnd = newStart + duration; clampedTop = true }
        if (newEnd > gap.ceiling)   { newEnd = gap.ceiling; newStart = newEnd - duration; clampedBottom = true }
        // If the gap is too small for the duration, refuse the move
        if (newEnd - newStart > gap.ceiling - gap.floor) {
          newStart = d.previewStart
          newEnd = d.previewEnd
          clampedTop = true
          clampedBottom = true
        }
      } else if (d.mode === 'resize-top') {
        if (newStart < gap.floor) { newStart = gap.floor; clampedTop = true }
      } else if (d.mode === 'resize-bottom') {
        if (newEnd > gap.ceiling) { newEnd = gap.ceiling; clampedBottom = true }
      }

      setDrag(prev => prev ? {
        ...prev,
        previewStart: newStart,
        previewEnd: newEnd,
        clampedTop,
        clampedBottom,
      } : prev)
    }
    const onUp = () => {
      const d = dragRef.current
      if (d && (d.previewStart !== d.origStart || d.previewEnd !== d.origEnd)) {
        updateEvent(d.eventId, {
          startTime: formatHHMM(d.previewStart),
          endTime: formatHHMM(d.previewEnd),
        })
      }
      setDrag(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [drag, events, updateEvent])

  const beginDrag = (ev: ScheduleEvent, mode: DragMode, e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const r = eventRange(ev)
    setDrag({
      eventId: ev.id,
      mode,
      origStart: r.startMin,
      origEnd: r.endMin,
      date: ev.date,
      pointerStartY: e.clientY,
      previewStart: r.startMin,
      previewEnd: r.endMin,
      clampedTop: false,
      clampedBottom: false,
    })
  }

  const handleDelete = (internal: ScheduleEvent, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm(`Delete "${internal.customerName}" from your calendar?`)) return
    deleteEvent(internal.id)
  }

  const dayGridHours = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i)
  const dayGridHeight = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_HEIGHT

  const s: Record<string, CSSProperties> = {
    overlay: {
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 220,
    },
    modal: {
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      background: C.charcoalLight, borderRadius: 16, padding: 'clamp(20px, 4vw, 28px)',
      width: 'min(440px, calc(100vw - 24px))',
      maxHeight: 'calc(100dvh - 24px)', overflowY: 'auto',
      zIndex: 230, boxShadow: '0 16px 48px rgba(0,0,0,.5)',
      border: `1px solid ${C.steel}44`,
    },
    header: {
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      gap: 12, marginBottom: 14,
    },
    title: { fontSize: 17, fontWeight: 700, color: C.white },
    sub: { fontSize: 12, color: C.silver, marginTop: 2 },
    closeBtn: {
      background: 'transparent', border: 'none', color: C.silver,
      cursor: 'pointer', padding: 4, display: 'flex',
    },
    dayLabel: {
      fontSize: 11, color: C.steel, textTransform: 'uppercase' as const,
      letterSpacing: 0.8, fontWeight: 700, marginBottom: 8, marginTop: 4,
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: '44px 1fr',
      borderRadius: 10,
      overflow: 'hidden',
      background: `${C.steel}22`,
      gap: 1,
      marginBottom: 14,
    },
    hourCol: {
      background: C.charcoal, position: 'relative', height: dayGridHeight,
    },
    eventsCol: {
      background: C.charcoal, position: 'relative', height: dayGridHeight,
    },
    saveBtn: {
      width: '100%', padding: '12px', borderRadius: 10,
      border: 'none', color: C.charcoal,
      fontSize: 13, fontWeight: 700, cursor: 'pointer', minHeight: 44, marginTop: 4,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    },
    helpRow: {
      fontSize: 11, color: C.steel, marginBottom: 12, lineHeight: 1.5,
    },
    resolvedBanner: {
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 14px', borderRadius: 10, marginTop: 4, marginBottom: 12,
      background: '#6ABF8A12', border: '1px solid #6ABF8A66',
      color: C.silver, fontSize: 12, lineHeight: 1.5,
    },
  }

  return (
    <>
      <div style={s.overlay} onClick={onClose} />
      <div style={s.modal}>
        <div style={s.header}>
          <div>
            <div style={s.title}>Resolve schedule clashes</div>
            <div style={s.sub}>
              {allClear
                ? 'All clear — review the arrangement and save when you\'re happy.'
                : `${conflicts.length} clash${conflicts.length === 1 ? '' : 'es'} — drag any block to move it out of the way.`}
            </div>
          </div>
          <button onClick={onClose} style={s.closeBtn} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div style={s.helpRow}>
          <strong style={{ color: C.gold }}>★ This job</strong> in gold and{' '}
          <strong style={{ color: C.silver }}>📌 internal entries</strong> in steel are both draggable.
          Drag the body to move, or grab the top/bottom edge to resize.
          Snaps to 30 minutes and stops at neighbouring blocks. Other customers' jobs are locked.
        </div>

        {sortedDays.map(date => {
          const entry = dayMap.get(date)!
          return (
            <div key={date}>
              <div style={s.dayLabel}>{fmtDate(date)}</div>
              <div style={s.grid}>
                {/* Hour-label column */}
                <div style={s.hourCol}>
                  {dayGridHours.map(hour => (
                    <div
                      key={`hl-${hour}`}
                      style={{
                        position: 'absolute',
                        top: (hour - DAY_START_HOUR) * HOUR_HEIGHT,
                        right: 6,
                        fontSize: 10, color: C.steel, fontWeight: 500,
                        transform: 'translateY(-5px)',
                      }}
                    >
                      {String(hour).padStart(2, '0')}:00
                    </div>
                  ))}
                </div>

                {/* Events column */}
                <div style={s.eventsCol}>
                  {/* Hour grid lines */}
                  {dayGridHours.map(hour => (
                    <div
                      key={`gl-${hour}`}
                      style={{
                        position: 'absolute', left: 0, right: 0,
                        top: (hour - DAY_START_HOUR) * HOUR_HEIGHT,
                        borderTop: `1px solid ${C.steel}22`,
                        pointerEvents: 'none',
                      }}
                    />
                  ))}

                  {entry.allEvents.map(ev => {
                    const isDragging = drag?.eventId === ev.id
                    const r = eventRange(ev)
                    const startMin = isDragging ? drag!.previewStart : r.startMin
                    const endMin = isDragging ? drag!.previewEnd : r.endMin
                    const dayMinMins = DAY_START_HOUR * 60
                    const visStart = Math.max(startMin, dayMinMins)
                    const visEnd = Math.min(endMin, DAY_END_HOUR * 60)
                    if (visEnd <= visStart) return null
                    const top = ((visStart - dayMinMins) / 60) * HOUR_HEIGHT
                    const height = Math.max(((visEnd - visStart) / 60) * HOUR_HEIGHT, 22)
                    const isCustomer = !ev.category
                    const isJobEvent = isCustomer && ev.jobId === jobId
                    const isOtherCustomer = isCustomer && !isJobEvent
                    const flashTop = isDragging && drag!.clampedTop
                    const flashBottom = isDragging && drag!.clampedBottom

                    // Other customers' jobs (not the one we're resolving) are
                    // genuinely off-limits — leave them locked.
                    if (isOtherCustomer) {
                      return (
                        <div
                          key={ev.id}
                          style={{
                            position: 'absolute', top, height,
                            left: 4, right: 4,
                            background: `${C.silver}10`,
                            border: `1px solid ${C.silver}66`,
                            borderLeft: `3px solid ${C.silver}`,
                            borderRadius: 6,
                            padding: '4px 8px',
                            overflow: 'hidden',
                            display: 'flex', flexDirection: 'column', gap: 1,
                            cursor: 'not-allowed',
                            zIndex: 1,
                          }}
                          title={`${ev.customerName} — another customer, locked`}
                        >
                          <div style={{
                            fontSize: 11, fontWeight: 700, color: C.white,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>{ev.customerName}</div>
                          {height >= 32 && (
                            <div style={{ fontSize: 10, color: C.silver }}>
                              {formatHHMM(r.startMin)}–{formatHHMM(r.endMin)}
                            </div>
                          )}
                        </div>
                      )
                    }

                    // Both the active job's customer event AND any internal
                    // event are draggable. Top/bottom edges are resize
                    // handles; the body is the move handle. Different
                    // colours so the user can tell them apart at a glance.
                    const accent = isJobEvent ? C.gold : C.silver
                    const bgShade = isJobEvent ? `${C.gold}20` : `${C.steel}33`
                    return (
                      <div
                        key={ev.id}
                        onPointerDown={(e) => beginDrag(ev, 'move', e)}
                        style={{
                          position: 'absolute', top, height,
                          left: 4, right: 4,
                          background: bgShade,
                          border: `1px solid ${flashTop || flashBottom ? '#D46A6A88' : accent + '88'}`,
                          borderLeft: `3px solid ${accent}`,
                          borderRadius: 6,
                          padding: '4px 8px',
                          overflow: 'hidden',
                          display: 'flex', flexDirection: 'column', gap: 1,
                          cursor: isDragging ? 'grabbing' : 'grab',
                          touchAction: 'none' as const,
                          userSelect: 'none' as const,
                          zIndex: isDragging ? 10 : 2,
                          boxShadow: isDragging ? '0 6px 18px rgba(0,0,0,.5)' : 'none',
                          transition: isDragging ? 'none' : 'border-color .15s',
                        }}
                      >
                        {/* Top resize handle — flashes red when clamped */}
                        <div
                          onPointerDown={(e) => beginDrag(ev, 'resize-top', e)}
                          style={{
                            position: 'absolute', top: 0, left: 0, right: 0, height: 6,
                            cursor: 'ns-resize', touchAction: 'none' as const,
                            background: flashTop ? '#D46A6A88' : 'transparent',
                            transition: 'background .15s',
                          }}
                        />
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4,
                        }}>
                          <div style={{
                            fontSize: 11, fontWeight: 700, color: C.white,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            display: 'flex', alignItems: 'center', gap: 3, minWidth: 0,
                          }}>
                            <span>{isJobEvent ? '★' : '📌'}</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.customerName}</span>
                          </div>
                          {!isJobEvent && (
                            <button
                              onClick={(e) => handleDelete(ev, e)}
                              onPointerDown={(e) => e.stopPropagation()}
                              style={{
                                background: 'transparent', border: 'none', color: C.steel,
                                cursor: 'pointer', padding: 2, display: 'flex', flexShrink: 0,
                                zIndex: 1,
                              }}
                              title="Delete"
                              aria-label="Delete"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                        {height >= 32 && (
                          <div style={{ fontSize: 10, color: C.silver }}>
                            {formatHHMM(startMin)}–{formatHHMM(endMin)}
                          </div>
                        )}
                        {/* Bottom resize handle — flashes red when clamped */}
                        <div
                          onPointerDown={(e) => beginDrag(ev, 'resize-bottom', e)}
                          style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0, height: 6,
                            cursor: 'ns-resize', touchAction: 'none' as const,
                            background: flashBottom ? '#D46A6A88' : 'transparent',
                            transition: 'background .15s',
                          }}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}

        {allClear && (
          <div style={s.resolvedBanner}>
            <CheckCircle size={16} color="#6ABF8A" style={{ flexShrink: 0 }} />
            <div>
              <strong style={{ color: C.white }}>Conflict resolved.</strong> Hit Save &amp; close to send the customer their confirmation, or keep adjusting if you want to fine-tune the arrangement.
            </div>
          </div>
        )}

        <button
          style={{
            ...s.saveBtn,
            background: allClear ? '#6ABF8A' : C.gold,
          }}
          onClick={onClose}
        >
          {allClear && <CheckCircle size={14} />}
          Save &amp; close
        </button>
      </div>
    </>
  )
}
