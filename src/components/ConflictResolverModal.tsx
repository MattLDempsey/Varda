import { useState } from 'react'
import type { CSSProperties } from 'react'
import { X, Trash2, ArrowRight } from 'lucide-react'
import { useTheme } from '../theme/ThemeContext'
import { useData, type ScheduleEvent } from '../data/DataContext'

/* ──────────────────────────────────────────────────────
   ConflictResolverModal
   Focused modal for resolving schedule clashes between a
   customer job's events and internal entries (travel, stock
   check, etc) WITHOUT leaving the job detail panel.
   For each conflicting internal event the user can:
   - Delete it outright
   - Nudge it ±30 minutes
   - Drop it onto the next free slot on the same day
   The modal closes automatically once every conflict is
   resolved, or the user can dismiss manually.
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
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function ConflictResolverModal({ jobId, onClose }: Props) {
  const { C } = useTheme()
  const { events, updateEvent, deleteEvent } = useData()
  const [busyId, setBusyId] = useState<string | null>(null)

  // Re-compute conflicts on every render so the list shrinks live as
  // the user resolves them.
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

  // No conflicts left → auto-close so the user goes straight back to send
  if (conflicts.length === 0) {
    setTimeout(onClose, 50)
  }

  /** Try to find the nearest free 1-hour gap on the same day after the
   *  customer event ends, or before it starts if no afternoon space exists. */
  const findFreeSlot = (internal: ScheduleEvent, jobEvent: ScheduleEvent): { start: string; end: string } | null => {
    const internalRange = eventRange(internal)
    const duration = internalRange.endMin - internalRange.startMin
    const dayStart = 6 * 60
    const dayEnd = 20 * 60
    const sameDay = events.filter(e =>
      e.id !== internal.id
      && e.date === internal.date
    )
    // Try after the job event first
    const tryStart = (start: number): { start: string; end: string } | null => {
      const end = start + duration
      if (end > dayEnd) return null
      const overlap = sameDay.some(e => {
        const r = eventRange(e)
        return r.startMin < end && r.endMin > start
      })
      if (overlap) return null
      return { start: formatHHMM(start), end: formatHHMM(end) }
    }
    // After the job ends
    const jobRange = eventRange(jobEvent)
    for (let s = jobRange.endMin; s + duration <= dayEnd; s += 30) {
      const slot = tryStart(s)
      if (slot) return slot
    }
    // Before the job starts
    for (let s = jobRange.startMin - duration; s >= dayStart; s -= 30) {
      const slot = tryStart(s)
      if (slot) return slot
    }
    return null
  }

  const handleNudge = (internal: ScheduleEvent, deltaMins: number) => {
    setBusyId(internal.id)
    const r = eventRange(internal)
    const newStart = Math.max(6 * 60, Math.min(20 * 60 - (r.endMin - r.startMin), r.startMin + deltaMins))
    const newEnd = newStart + (r.endMin - r.startMin)
    updateEvent(internal.id, {
      startTime: formatHHMM(newStart),
      endTime: formatHHMM(newEnd),
    })
    setTimeout(() => setBusyId(null), 200)
  }

  const handleAutoMove = (internal: ScheduleEvent, jobEvent: ScheduleEvent) => {
    const slot = findFreeSlot(internal, jobEvent)
    if (!slot) {
      window.alert(`No free 1-hour slot on ${fmtDate(internal.date)} — try deleting "${internal.customerName}" or moving it to a different day on the calendar.`)
      return
    }
    setBusyId(internal.id)
    updateEvent(internal.id, { startTime: slot.start, endTime: slot.end })
    setTimeout(() => setBusyId(null), 200)
  }

  const handleDelete = (internal: ScheduleEvent) => {
    if (!window.confirm(`Delete "${internal.customerName}" from your calendar?`)) return
    setBusyId(internal.id)
    deleteEvent(internal.id)
    setTimeout(() => setBusyId(null), 200)
  }

  const s: Record<string, CSSProperties> = {
    overlay: {
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 220,
    },
    modal: {
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      background: C.charcoalLight, borderRadius: 16, padding: 'clamp(20px, 4vw, 28px)',
      width: 'min(480px, calc(100vw - 24px))',
      maxHeight: 'calc(100dvh - 24px)', overflowY: 'auto',
      zIndex: 230, boxShadow: '0 16px 48px rgba(0,0,0,.5)',
      border: `1px solid ${C.steel}44`,
    },
    header: {
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      gap: 12, marginBottom: 6,
    },
    title: { fontSize: 17, fontWeight: 700, color: C.white },
    sub: { fontSize: 12, color: C.silver, marginTop: 2 },
    closeBtn: {
      background: 'transparent', border: 'none', color: C.silver,
      cursor: 'pointer', padding: 4, display: 'flex',
    },
    sectionLabel: {
      fontSize: 11, color: C.steel, textTransform: 'uppercase' as const,
      letterSpacing: 0.8, fontWeight: 600, marginTop: 18, marginBottom: 8,
    },
    conflictRow: {
      background: C.black, borderRadius: 10, padding: '12px 14px',
      marginBottom: 10, border: `1px solid ${C.steel}33`,
    },
    customerLine: {
      fontSize: 11, color: C.silver, marginBottom: 8,
      display: 'flex', alignItems: 'center', gap: 6,
    },
    internalRow: {
      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
    },
    internalIcon: { fontSize: 18, flexShrink: 0 },
    internalInfo: { flex: 1, minWidth: 0 },
    internalName: { fontSize: 14, fontWeight: 600, color: C.white },
    internalTime: { fontSize: 11, color: C.silver },
    actionRow: {
      display: 'flex', gap: 6, flexWrap: 'wrap' as const,
    },
    nudgeBtn: {
      padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
      background: 'transparent', border: `1px solid ${C.steel}44`,
      color: C.silver, cursor: 'pointer', minHeight: 30,
      display: 'flex', alignItems: 'center', gap: 4,
    },
    autoBtn: {
      padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
      background: `${C.gold}15`, border: `1px solid ${C.gold}66`,
      color: C.gold, cursor: 'pointer', minHeight: 30,
      display: 'flex', alignItems: 'center', gap: 4,
    },
    deleteBtn: {
      padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
      background: 'transparent', border: '1px solid #D46A6A66',
      color: '#D46A6A', cursor: 'pointer', minHeight: 30,
      display: 'flex', alignItems: 'center', gap: 4,
    },
    doneBtn: {
      width: '100%', padding: '12px', borderRadius: 10,
      background: C.gold, border: 'none', color: C.charcoal,
      fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 12, minHeight: 44,
    },
  }

  const fmtRange = (ev: ScheduleEvent): string => {
    const r = eventRange(ev)
    return `${formatHHMM(r.startMin)}–${formatHHMM(r.endMin)}`
  }

  return (
    <>
      <div style={s.overlay} onClick={onClose} />
      <div style={s.modal}>
        <div style={s.header}>
          <div>
            <div style={s.title}>Resolve schedule clashes</div>
            <div style={s.sub}>{conflicts.length} clash{conflicts.length === 1 ? '' : 'es'} between this job and your own diary</div>
          </div>
          <button onClick={onClose} style={s.closeBtn} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div style={s.sectionLabel}>Pick what to do with each entry</div>

        {conflicts.map((c, idx) => (
          <div key={`${c.jobEvent.id}-${c.internal.id}-${idx}`} style={s.conflictRow}>
            {/* The customer event — locked, just for context */}
            <div style={s.customerLine}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 18, height: 18, borderRadius: 4, background: `${C.gold}22`,
                color: C.gold, fontSize: 11, fontWeight: 700,
              }}>★</span>
              <span>
                <strong style={{ color: C.white }}>Customer time:</strong>{' '}
                {c.jobEvent.customerName} on {fmtDate(c.jobEvent.date)} · {fmtRange(c.jobEvent)}
              </span>
            </div>

            {/* The internal event — actionable */}
            <div style={s.internalRow}>
              <span style={s.internalIcon}>📌</span>
              <div style={s.internalInfo}>
                <div style={s.internalName}>{c.internal.customerName}</div>
                <div style={s.internalTime}>{fmtRange(c.internal)}</div>
              </div>
            </div>

            <div style={s.actionRow}>
              <button
                style={s.autoBtn}
                disabled={busyId === c.internal.id}
                onClick={() => handleAutoMove(c.internal, c.jobEvent)}
                title="Move to the nearest free slot on the same day"
              >
                <ArrowRight size={11} /> Auto-move
              </button>
              <button
                style={s.nudgeBtn}
                disabled={busyId === c.internal.id}
                onClick={() => handleNudge(c.internal, -30)}
              >
                −30m
              </button>
              <button
                style={s.nudgeBtn}
                disabled={busyId === c.internal.id}
                onClick={() => handleNudge(c.internal, 30)}
              >
                +30m
              </button>
              <button
                style={s.deleteBtn}
                disabled={busyId === c.internal.id}
                onClick={() => handleDelete(c.internal)}
              >
                <Trash2 size={11} /> Delete
              </button>
            </div>
          </div>
        ))}

        <button style={s.doneBtn} onClick={onClose}>
          Done
        </button>
      </div>
    </>
  )
}
