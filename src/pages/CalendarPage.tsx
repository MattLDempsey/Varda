import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, Clock, X, Download, Calendar, Briefcase, AlertCircle } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useTheme } from '../theme/ThemeContext'
import { useData, isEventConfirmed, type ScheduleEvent, type EventSlot } from '../data/DataContext'
import { exportWeekEvents, exportAllEvents, exportSingleEvent } from '../lib/calendar-export'
import { useUndo } from '../hooks/useUndo'
import LoadingSpinner from '../components/LoadingSpinner'

const statusColor: Record<string, string> = {
  Scheduled: '#5B9BD5',
  'In Progress': '#C6A86A',
  Complete: '#6ABF8A',
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/* ── helpers ── */
function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function slotLabel(slot: 'morning' | 'afternoon' | 'full' | 'quick'): string {
  if (slot === 'morning') return 'Morning'
  if (slot === 'afternoon') return 'Afternoon'
  if (slot === 'quick') return 'Quick (<1h)'
  return 'Full Day'
}

/** Build an array of dates for the month grid (always starts on Monday, 5-6 rows). */
function getMonthGridDates(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1)
  const lastOfMonth = new Date(year, month + 1, 0)

  // Find the Monday on or before the 1st
  const startDay = firstOfMonth.getDay() // 0=Sun
  const mondayOffset = startDay === 0 ? -6 : 1 - startDay
  const gridStart = new Date(year, month, 1 + mondayOffset)

  // We need enough rows to cover the whole month (5 or 6 weeks)
  const endDay = lastOfMonth.getDate()
  const totalDaysShown = (() => {
    // Calculate how many days from gridStart to end-of-month Sunday
    const diffToEnd = Math.ceil((lastOfMonth.getTime() - gridStart.getTime()) / 86400000) + 1
    const rows = Math.ceil(diffToEnd / 7)
    return rows * 7
  })()

  const dates: Date[] = []
  for (let i = 0; i < totalDaysShown; i++) {
    dates.push(addDays(gridStart, i))
  }
  return dates
}

/* ── component ── */
export default function CalendarPage() {
  const { C } = useTheme()
  const navigate = useNavigate()
  const { events, customers, jobs, addEvent, updateEvent, deleteEvent, isDataLoading } = useData()
  const { showUndo } = useUndo()

  /** Look up the job value for an event */
  const getEventValue = (ev: ScheduleEvent): number => {
    if (!ev.jobId) return 0
    const job = jobs.find(j => j.id === ev.jobId)
    return job?.value ?? 0
  }

  const [view, setView] = useState<'month' | 'week' | 'day'>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editSlot, setEditSlot] = useState<EventSlot>('morning')
  const [isEditing, setIsEditing] = useState(false)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const monday = getMonday(currentDate)

  // ── Drag / resize state for the time-grid views ──
  // Tracks an in-flight drag or resize operation. While active, the
  // affected card renders at the dragState position instead of its
  // committed times, so the user gets live visual feedback.
  type DragMode = 'move' | 'resize-top' | 'resize-bottom'
  interface DragState {
    eventId: string
    mode: DragMode
    // Original times (in minutes from midnight) and date when drag started
    origStartMin: number
    origEndMin: number
    origDate: string
    // Current preview times (recomputed on every pointermove)
    previewStartMin: number
    previewEndMin: number
    previewDate: string
    // The free-gap bounds the card is currently constrained to. Used to
    // render the gold "you can drop me anywhere in here" highlight.
    gapFloorMin: number
    gapCeilingMin: number
    // True if the user has bumped into a clamp this frame (drives a brief
    // red flash on the offending boundary).
    clampedTop: boolean
    clampedBottom: boolean
    // Pixel position where the pointer first went down (for delta calc)
    pointerStartY: number
    pointerStartX: number
  }
  const [dragState, setDragState] = useState<DragState | null>(null)
  const dragStateRef = useRef<DragState | null>(null)
  dragStateRef.current = dragState

  // ── Quick-create internal events (travel, admin, supplies, etc.) ──
  // When the user clicks an empty slot in the day or week view, this state
  // tracks the picked time + day so the inline create modal knows what to
  // pre-fill.
  interface QuickCreateState {
    date: string
    startMin: number
  }
  const [quickCreate, setQuickCreate] = useState<QuickCreateState | null>(null)

  interface InternalPreset {
    key: string
    label: string
    durationMin: number
    color: string
    icon: string
  }
  const INTERNAL_PRESETS: InternalPreset[] = [
    { key: 'travel',      label: 'Travelling',  durationMin: 30, color: '#5B9BD5', icon: '🚗' },
    { key: 'supplies',    label: 'Supply Run',  durationMin: 60, color: '#9B7ED8', icon: '🧰' },
    { key: 'stockcheck',  label: 'Stock Check', durationMin: 30, color: '#6ABF8A', icon: '📦' },
    { key: 'admin',       label: 'Admin',       durationMin: 60, color: '#C6A86A', icon: '📋' },
    { key: 'training',    label: 'Training',    durationMin: 90, color: '#D46A6A', icon: '🎓' },
    { key: 'break',       label: 'Break',       durationMin: 30, color: '#8A8F96', icon: '☕' },
    { key: 'custom',      label: 'Custom',      durationMin: 60, color: '#9CA3AF', icon: '📌' },
  ]
  // When the user picks the Custom preset we switch the modal to a name
  // input. This holds whatever they're typing until they hit Create.
  const [customName, setCustomName] = useState('')
  // Internal event being edited via the click-to-edit modal. Customer
  // events open the existing selectedEvent panel; internal events use
  // this lighter sheet so they can be renamed or deleted in two taps.
  const [editingInternal, setEditingInternal] = useState<ScheduleEvent | null>(null)
  const [editingInternalName, setEditingInternalName] = useState('')

  // Convert a vertical pixel offset within a day column into a snapped
  // start time in minutes from midnight (relative to DAY_START_HOUR).
  const pixelYToMinutes = (offsetY: number): number => {
    const mins = (offsetY / HOUR_HEIGHT) * 60 + DAY_START_HOUR * 60
    return snap(mins)
  }

  // Click handler for empty space in a day column. Computes the start time
  // from the click position and opens the quick-create modal.
  const handleColumnClick = (e: React.MouseEvent<HTMLDivElement>, dateStr: string) => {
    // Ignore clicks that originated on a card or its children.
    if ((e.target as HTMLElement).closest('[data-event-card]')) return
    if (dragStateRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const offsetY = e.clientY - rect.top
    const startMin = pixelYToMinutes(offsetY)
    setQuickCreate({ date: dateStr, startMin })
  }

  // Create an internal event from one of the presets at the picked time.
  // The Custom preset uses the user-typed `customName`; everything else
  // uses the preset's own label.
  const createInternalEvent = (preset: InternalPreset, overrideName?: string) => {
    if (!quickCreate) return
    const startMin = quickCreate.startMin
    const endMin = Math.min(startMin + preset.durationMin, DAY_END_HOUR * 60)
    const displayName = overrideName?.trim() || preset.label
    addEvent({
      jobId: undefined,
      customerId: undefined,
      customerName: displayName,
      jobType: 'Internal',
      date: quickCreate.date,
      slot: 'quick',
      status: 'Scheduled',
      notes: '',
      startTime: `${String(Math.floor(startMin / 60)).padStart(2, '0')}:${String(startMin % 60).padStart(2, '0')}`,
      endTime: `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`,
      category: preset.key,
      // Internal events don't need customer confirmation — pre-stamp it
      // so they don't trigger the "Unsent" badge.
      confirmationSentAt: new Date().toISOString(),
    })
    setQuickCreate(null)
    setCustomName('')
  }

  const weekDates = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(monday, i)),
    [monday.getTime()]
  )

  const monthGridDates = useMemo(() =>
    getMonthGridDates(currentDate.getFullYear(), currentDate.getMonth()),
    [currentDate.getFullYear(), currentDate.getMonth()]
  )

  const today = formatDate(new Date())

  const prevWeek = () => setCurrentDate(addDays(currentDate, -7))
  const nextWeek = () => setCurrentDate(addDays(currentDate, 7))
  const prevDay = () => setCurrentDate(addDays(currentDate, -1))
  const nextDay = () => setCurrentDate(addDays(currentDate, 1))
  const prevMonth = () => {
    const d = new Date(currentDate)
    d.setMonth(d.getMonth() - 1)
    setCurrentDate(d)
  }
  const nextMonth = () => {
    const d = new Date(currentDate)
    d.setMonth(d.getMonth() + 1)
    setCurrentDate(d)
  }
  const goToday = () => setCurrentDate(new Date())

  const weekRange = `${weekDates[0].getDate()} ${MONTHS[weekDates[0].getMonth()]} – ${weekDates[6].getDate()} ${MONTHS[weekDates[6].getMonth()]} ${weekDates[6].getFullYear()}`

  const monthLabel = `${MONTHS_FULL[currentDate.getMonth()]} ${currentDate.getFullYear()}`

  // ── Day view time-grid constants ──
  // Pixel height for each hour row in the day view. Used to position event
  // cards by their actual start time and stretch them to their duration.
  const HOUR_HEIGHT = 64
  const DAY_START_HOUR = 6  // 06:00
  const DAY_END_HOUR = 20   // 20:00 (8pm)
  const DAY_GRID_HEIGHT = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_HEIGHT
  const dayGridHours = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i)

  // Resolve an event's effective time range, falling back to slot defaults
  // when explicit start_time/end_time aren't set (legacy events or untouched
  // half-day blocks).
  const SLOT_DEFAULTS_HHMM: Record<string, { start: string; end: string }> = {
    morning:   { start: '08:00', end: '12:00' },
    afternoon: { start: '12:00', end: '17:00' },
    full:      { start: '08:00', end: '17:00' },
    quick:     { start: '08:00', end: '09:00' },
  }
  const parseHHMM = (s: string): number => {
    const [h, m] = s.split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }
  // Current-time indicator position (red line on today's column)
  const nowMinutes = (() => {
    const n = new Date()
    return n.getHours() * 60 + n.getMinutes()
  })()
  const nowInRange = nowMinutes >= DAY_START_HOUR * 60 && nowMinutes <= DAY_END_HOUR * 60
  const nowTop = ((nowMinutes - DAY_START_HOUR * 60) / 60) * HOUR_HEIGHT

  const eventTimes = (ev: { slot: string; startTime?: string | null; endTime?: string | null }) => {
    const def = SLOT_DEFAULTS_HHMM[ev.slot] ?? SLOT_DEFAULTS_HHMM.morning
    const start = ev.startTime || def.start
    const end = ev.endTime || def.end
    return { start, end, startMin: parseHHMM(start), endMin: parseHHMM(end) }
  }
  const formatHHMM = (mins: number): string => {
    const clamped = Math.max(0, Math.min(24 * 60 - 1, mins))
    const h = Math.floor(clamped / 60)
    const m = clamped % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  // 30-minute snap — coarse enough that the user doesn't end up with awkward
  // 08:23–09:23 windows but precise enough for a tradesperson's day.
  const SNAP_MINUTES = 30
  const snap = (mins: number): number => Math.round(mins / SNAP_MINUTES) * SNAP_MINUTES

  // For overlap prevention during drag/resize: find the contiguous "free
  // gap" on the target day that the candidate position falls into. Returns
  // the floor (latest end of any event ending before the candidate window)
  // and ceiling (earliest start of any event starting after it). Drag/resize
  // clamps within this gap so events of the same kind can never overlap.
  //
  // Cross-kind events (a customer job vs an internal event) are NOT blocked:
  // customer-facing work always takes precedence over the user's own time
  // blocks, but the conflict is surfaced as a warning in the job panel so the
  // user reviews it before sending the customer their confirmation.
  const findGap = (excludeId: string, targetDate: string, candidateStart: number, candidateEnd: number): { floor: number; ceiling: number } => {
    let floor = DAY_START_HOUR * 60
    let ceiling = DAY_END_HOUR * 60
    const dragging = events.find(e => e.id === excludeId)
    const draggingIsInternal = !!dragging?.category
    const others = events.filter(e =>
      e.id !== excludeId
      && e.date === targetDate
      // Only same-kind events constrain the gap (customer↔customer or
      // internal↔internal). Cross-kind events float through.
      && !!e.category === draggingIsInternal
    )
    // Use the midpoint of the candidate window to decide which gap we're in.
    // This gives sensible behaviour when the user drags through an existing
    // event — the active card moves to whichever side the cursor is closer to.
    const mid = (candidateStart + candidateEnd) / 2
    for (const e of others) {
      const t = eventTimes(e)
      if (t.endMin <= mid && t.endMin > floor) floor = t.endMin
      if (t.startMin >= mid && t.startMin < ceiling) ceiling = t.startMin
    }
    return { floor, ceiling }
  }

  // ── Global pointer handlers for drag/resize ──
  // We attach these to the window so the drag continues even if the cursor
  // leaves the card. The dragStateRef holds the live state to avoid React
  // batching issues during high-frequency pointer moves.
  useEffect(() => {
    if (!dragState) return
    const onMove = (e: PointerEvent) => {
      const drag = dragStateRef.current
      if (!drag) return
      const deltaY = e.clientY - drag.pointerStartY
      const deltaMins = snap(Math.round((deltaY / HOUR_HEIGHT) * 60))

      // Horizontal drag → day column shift (only for the week view)
      let newDate = drag.origDate
      if (drag.mode === 'move' && view === 'week') {
        const overEl = document.elementFromPoint(e.clientX, e.clientY)
        const col = (overEl as HTMLElement | null)?.closest?.('[data-day-col]') as HTMLElement | null
        if (col?.dataset.dayCol) {
          newDate = col.dataset.dayCol
        }
      }

      let newStart = drag.origStartMin
      let newEnd = drag.origEndMin
      if (drag.mode === 'move') {
        newStart = drag.origStartMin + deltaMins
        newEnd = drag.origEndMin + deltaMins
      } else if (drag.mode === 'resize-top') {
        newStart = Math.min(drag.origStartMin + deltaMins, drag.origEndMin - SNAP_MINUTES)
      } else if (drag.mode === 'resize-bottom') {
        newEnd = Math.max(drag.origEndMin + deltaMins, drag.origStartMin + SNAP_MINUTES)
      }

      // Clamp to the visible day range
      const dayMinMins = DAY_START_HOUR * 60
      const dayMaxMins = DAY_END_HOUR * 60
      if (newStart < dayMinMins) {
        const shift = dayMinMins - newStart
        newStart += shift
        if (drag.mode === 'move') newEnd += shift
      }
      if (newEnd > dayMaxMins) {
        const shift = newEnd - dayMaxMins
        newEnd -= shift
        if (drag.mode === 'move') newStart -= shift
      }

      // ── Overlap prevention ──
      // Find the contiguous free gap on the target day around the candidate
      // window and clamp our new times within it. This stops cards bleeding
      // through other events on the same day, regardless of mode.
      const gap = findGap(drag.eventId, newDate, newStart, newEnd)
      let clampedTop = false
      let clampedBottom = false
      if (drag.mode === 'move') {
        const duration = newEnd - newStart
        if (newStart < gap.floor) { newStart = gap.floor; newEnd = newStart + duration; clampedTop = true }
        if (newEnd > gap.ceiling) { newEnd = gap.ceiling; newStart = newEnd - duration; clampedBottom = true }
        // If the gap can't fit the duration, don't move at all (stay where we
        // were). This handles dragging into a gap that's too small.
        if (newEnd - newStart > gap.ceiling - gap.floor) {
          newStart = drag.previewStartMin
          newEnd = drag.previewEndMin
          newDate = drag.previewDate
          clampedTop = true; clampedBottom = true
        }
      } else if (drag.mode === 'resize-top') {
        if (newStart < gap.floor) { newStart = gap.floor; clampedTop = true }
      } else if (drag.mode === 'resize-bottom') {
        if (newEnd > gap.ceiling) { newEnd = gap.ceiling; clampedBottom = true }
      }

      setDragState(prev => prev ? {
        ...prev,
        previewStartMin: newStart,
        previewEndMin: newEnd,
        previewDate: newDate,
        gapFloorMin: gap.floor,
        gapCeilingMin: gap.ceiling,
        clampedTop,
        clampedBottom,
      } : prev)
    }
    const onUp = () => {
      const drag = dragStateRef.current
      if (drag) {
        const changed = drag.previewStartMin !== drag.origStartMin
          || drag.previewEndMin !== drag.origEndMin
          || drag.previewDate !== drag.origDate
        if (changed) {
          // Real drag/resize → commit. updateEvent will auto-clear
          // confirmation_sent_at if the customer was already notified.
          updateEvent(drag.eventId, {
            startTime: formatHHMM(drag.previewStartMin),
            endTime: formatHHMM(drag.previewEndMin),
            date: drag.previewDate,
          })
        } else {
          // No movement → treat as a click on the card. Internal events
          // open the lightweight rename/delete sheet; customer events
          // open the existing detail panel.
          const ev = events.find(e => e.id === drag.eventId)
          if (ev) {
            if (ev.category) {
              setEditingInternal(ev)
              setEditingInternalName(ev.customerName)
            } else {
              setSelectedEvent(ev)
            }
          }
        }
      }
      setDragState(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [dragState, view, updateEvent, events])

  // Begin a drag/resize from a pointer-down on a card or its edge handles.
  const beginDrag = (ev: ScheduleEvent, mode: DragMode, e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const { startMin, endMin } = eventTimes(ev)
    const gap = findGap(ev.id, ev.date, startMin, endMin)
    setDragState({
      eventId: ev.id,
      mode,
      origStartMin: startMin,
      origEndMin: endMin,
      origDate: ev.date,
      previewStartMin: startMin,
      previewEndMin: endMin,
      previewDate: ev.date,
      gapFloorMin: gap.floor,
      gapCeilingMin: gap.ceiling,
      clampedTop: false,
      clampedBottom: false,
      pointerStartY: e.clientY,
      pointerStartX: e.clientX,
    })
  }

  const dayEvents = events.filter(e => e.date === formatDate(currentDate))

  /* Navigation handlers based on view */
  const handlePrev = () => {
    if (view === 'month') prevMonth()
    else if (view === 'week') prevWeek()
    else prevDay()
  }
  const handleNext = () => {
    if (view === 'month') nextMonth()
    else if (view === 'week') nextWeek()
    else nextDay()
  }

  const headerLabel = (() => {
    if (view === 'month') return monthLabel
    if (view === 'week') return weekRange
    return `${DAYS[currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1]} ${currentDate.getDate()} ${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`
  })()

  /* ── styles (inside component to access theme C) ── */
  const s: Record<string, CSSProperties> = {
    page: { padding: 32, maxWidth: 1400, margin: '0 auto' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 },
    heading: { fontSize: 28, fontWeight: 600, color: C.white },
    navRow: { display: 'flex', alignItems: 'center', gap: 8 },
    navBtn: {
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: 40, height: 40, borderRadius: 10, background: C.charcoalLight,
      border: 'none', color: C.silver, cursor: 'pointer', transition: 'background .15s',
    },
    weekLabel: { fontSize: 15, fontWeight: 500, color: C.silver, minWidth: 0, padding: '0 8px', textAlign: 'center' as const, whiteSpace: 'nowrap' as const },
    todayBtn: {
      padding: '8px 16px', borderRadius: 8, background: 'transparent',
      border: `1px solid ${C.steel}`, color: C.silver, fontSize: 13, fontWeight: 500,
      cursor: 'pointer', minHeight: 40, transition: 'all .15s',
    },
    viewToggle: { display: 'flex', background: C.black, borderRadius: 8, overflow: 'hidden' },
    viewBtn: {
      padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13,
      fontWeight: 500, minHeight: 40, transition: 'background .15s, color .15s',
    },
    exportBtn: {
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
      background: `${C.steel}15`, border: `1px solid ${C.steel}33`,
      color: C.silver, cursor: 'pointer', minHeight: 40,
      transition: 'background .15s',
    },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, background: `${C.steel}22`, borderRadius: 12, overflow: 'hidden' },
    dayHeader: {
      padding: '12px 8px', textAlign: 'center', fontSize: 12, fontWeight: 600,
      color: C.silver, textTransform: 'uppercase', letterSpacing: 0.8, background: C.charcoalLight,
    },
    dayCell: {
      background: C.charcoal, padding: 8, minHeight: 160, display: 'flex', flexDirection: 'column', gap: 6,
    },
    dayCellToday: { background: C.charcoal, borderTop: `2px solid ${C.gold}` },
    dateNum: { fontSize: 13, fontWeight: 600, color: C.silver, marginBottom: 4, padding: '0 4px' },
    dateNumToday: { color: C.gold },
    eventCard: {
      borderRadius: 8, padding: '8px 10px', fontSize: 12, cursor: 'pointer',
      borderLeft: '3px solid', transition: 'transform .1s',
    },
    eventCustomer: { fontWeight: 600, color: C.white, marginBottom: 2 },
    eventJob: { color: C.silver, fontSize: 11 },
    eventSlot: { fontSize: 10, color: C.steel, marginTop: 3, display: 'flex', alignItems: 'center', gap: 3 },
    // day view
    dayGrid: { display: 'grid', gridTemplateColumns: '80px 1fr', borderRadius: 12, overflow: 'hidden', background: `${C.steel}22`, gap: 1 },
    timeLabel: {
      padding: '16px 12px', fontSize: 12, fontWeight: 500, color: C.steel,
      textAlign: 'right', background: C.charcoalLight,
    },
    timeSlot: {
      background: C.charcoal, padding: 8, minHeight: 64, display: 'flex', alignItems: 'center', gap: 8,
    },
    emptyState: {
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 60, color: C.steel, fontSize: 14, gap: 12,
    },
    quickBook: {
      display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap',
    },
    quickBtn: {
      padding: '10px 20px', borderRadius: 10, border: `1px solid ${C.steel}44`,
      background: C.charcoalLight, color: C.silver, fontSize: 13, fontWeight: 500,
      cursor: 'pointer', minHeight: 44, transition: 'all .15s', display: 'flex',
      alignItems: 'center', gap: 6,
    },
    fab: {
      position: 'fixed', bottom: 32, right: 32, width: 56, height: 56,
      borderRadius: 16, background: C.gold, color: C.black, border: 'none',
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 4px 20px rgba(0,0,0,.4)', transition: 'transform .15s', zIndex: 50,
    },
    // month view
    monthGrid: {
      display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1,
      background: `${C.steel}22`, borderRadius: 12, overflow: 'hidden',
    },
    monthCell: {
      background: C.charcoal, padding: 6, minHeight: 100, display: 'flex',
      flexDirection: 'column', gap: 3, cursor: 'pointer', transition: 'background .12s',
    },
    monthDateNum: {
      fontSize: 13, fontWeight: 600, color: C.silver, padding: '2px 4px',
    },
    monthEvent: {
      borderRadius: 4, padding: '2px 6px', fontSize: 11, fontWeight: 500,
      color: C.white, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      cursor: 'pointer', borderLeft: '2px solid', lineHeight: '18px',
    },
    // modal styles
    overlay: {
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 100,
    },
    modal: {
      background: C.charcoalLight, borderRadius: 16, padding: 'clamp(18px, 5vw, 28px)',
      width: 'min(440px, calc(100vw - 24px))', maxHeight: 'calc(100dvh - 24px)', overflowY: 'auto' as const,
      boxShadow: '0 12px 40px rgba(0,0,0,.5)', position: 'relative',
    },
    modalClose: {
      position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: 8,
      background: 'transparent', border: 'none', color: C.silver, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .15s',
    },
    modalTitle: { fontSize: 20, fontWeight: 600, color: C.white, marginBottom: 20 },
    modalRow: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${C.steel}33` },
    modalLabel: { fontSize: 13, fontWeight: 500, color: C.steel },
    modalValue: { fontSize: 13, fontWeight: 600, color: C.white, textAlign: 'right' },
    statusBadge: {
      display: 'inline-block', padding: '3px 10px', borderRadius: 6, fontSize: 12,
      fontWeight: 600, color: '#fff',
    },
  }

  if (isDataLoading) {
    return (
      <div style={s.page}>
        <h1 style={s.heading}>Calendar</h1>
        <LoadingSpinner message="Loading calendar..." />
      </div>
    )
  }

  return (
    <div style={s.page}>
      {/* header */}
      <div style={s.header}>
        <h1 style={s.heading}>Calendar</h1>

        <div style={s.navRow}>
          <button style={s.navBtn} onClick={handlePrev}>
            <ChevronLeft size={20} />
          </button>
          <span style={s.weekLabel as CSSProperties}>
            {headerLabel}
          </span>
          <button style={s.navBtn} onClick={handleNext}>
            <ChevronRight size={20} />
          </button>
          <button style={s.todayBtn} onClick={goToday}>Today</button>
        </div>

        <div style={s.viewToggle}>
          <button
            style={{ ...s.viewBtn, background: view === 'month' ? C.charcoalLight : 'transparent', color: view === 'month' ? C.gold : C.steel }}
            onClick={() => setView('month')}
          >
            Month
          </button>
          <button
            style={{ ...s.viewBtn, background: view === 'week' ? C.charcoalLight : 'transparent', color: view === 'week' ? C.gold : C.steel }}
            onClick={() => setView('week')}
          >
            Week
          </button>
          <button
            style={{ ...s.viewBtn, background: view === 'day' ? C.charcoalLight : 'transparent', color: view === 'day' ? C.gold : C.steel }}
            onClick={() => setView('day')}
          >
            Day
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            style={s.exportBtn}
            onClick={() => exportWeekEvents(events, customers, monday)}
            onMouseEnter={e => { e.currentTarget.style.background = `${C.steel}33` }}
            onMouseLeave={e => { e.currentTarget.style.background = `${C.steel}15` }}
          >
            <Download size={14} /> Export Week
          </button>
          <button
            style={s.exportBtn}
            onClick={() => exportAllEvents(events, customers)}
            onMouseEnter={e => { e.currentTarget.style.background = `${C.steel}33` }}
            onMouseLeave={e => { e.currentTarget.style.background = `${C.steel}15` }}
          >
            <Calendar size={14} /> Export All
          </button>
        </div>
      </div>

      {/* empty state */}
      {events.length === 0 && (
        <div style={{ textAlign: 'center', padding: '64px 24px', color: C.steel, fontSize: 15 }}>
          No events scheduled. Book jobs from the Jobs page.
        </div>
      )}

      {/* month view */}
      {view === 'month' && (
        <div style={s.monthGrid}>
          {/* day-of-week headers */}
          {DAYS.map(day => (
            <div key={`mh-${day}`} style={s.dayHeader}>{day}</div>
          ))}

          {/* day cells */}
          {monthGridDates.map((d, i) => {
            const dateStr = formatDate(d)
            const cellEvents = events.filter(e => e.date === dateStr)
            const isToday = dateStr === today
            const isCurrentMonth = d.getMonth() === currentDate.getMonth()

            return (
              <div
                key={`mc-${i}`}
                style={{
                  ...s.monthCell,
                  ...(isToday ? { borderTop: `2px solid ${C.gold}` } : {}),
                  ...(!isCurrentMonth ? { opacity: 0.35 } : {}),
                }}
                onClick={() => { setCurrentDate(new Date(d)); setView('day') }}
              >
                <div style={{
                  ...s.monthDateNum,
                  ...(isToday ? { color: C.gold } : {}),
                }}>
                  {d.getDate()}
                </div>
                {cellEvents.slice(0, 3).map(ev => {
                  const val = getEventValue(ev)
                  return (
                  <div
                    key={ev.id}
                    style={{
                      ...s.monthEvent,
                      borderLeftColor: statusColor[ev.status],
                      background: statusColor[ev.status] + '20',
                    }}
                    onClick={(e) => { e.stopPropagation(); setSelectedEvent(ev) }}
                  >
                    {ev.customerName}{val > 0 ? ` \u00A3${val.toLocaleString('en-GB')}` : ''}
                  </div>
                  )
                })}
                {cellEvents.length > 3 && (
                  <div style={{ fontSize: 10, color: C.steel, padding: '0 4px' }}>
                    +{cellEvents.length - 3} more
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* week view */}
      {view === 'week' && (
        <>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '64px repeat(7, 1fr)',
          background: `${C.steel}22`,
          borderRadius: 12,
          overflow: 'hidden',
          gap: 1,
        }}>
          {/* Top-left empty cell + day headers */}
          <div style={{ background: C.charcoalLight, padding: '12px 8px', minHeight: 44 }} />
          {weekDates.map((d, i) => (
            <div
              key={`h-${i}`}
              onClick={() => { setCurrentDate(d); setView('day') }}
              style={{
                background: C.charcoalLight,
                padding: '12px 8px', minHeight: 44,
                fontSize: 11, fontWeight: 700, color: formatDate(d) === today ? C.gold : C.silver,
                textTransform: 'uppercase', letterSpacing: 0.8,
                cursor: 'pointer', textAlign: 'center',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {DAYS[i]} <span style={{ fontSize: 13, fontWeight: 700 }}>{d.getDate()}</span>
            </div>
          ))}

          {/* Hour labels column (first column, full grid height) */}
          <div style={{
            background: C.charcoalLight, position: 'relative',
            height: DAY_GRID_HEIGHT,
            gridColumn: '1 / 2',
          }}>
            {dayGridHours.map(hour => (
              <div
                key={`week-label-${hour}`}
                style={{
                  position: 'absolute',
                  top: (hour - DAY_START_HOUR) * HOUR_HEIGHT,
                  right: 8,
                  fontSize: 11, fontWeight: 500, color: C.steel,
                  transform: 'translateY(-6px)',
                }}
              >
                {String(hour).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* One day column per weekday */}
          {weekDates.map((d, i) => {
            const dateStr = formatDate(d)
            const isToday = dateStr === today
            // Collect events whose committed date is this column, plus any
            // event currently being dragged whose preview date is this column
            // (so cross-day drag visually moves the card live).
            const committedEvts = events.filter(e => e.date === dateStr)
            const dragVisitor = dragState && dragState.previewDate === dateStr && dragState.origDate !== dateStr
              ? events.find(e => e.id === dragState.eventId)
              : undefined
            const dayEvts = dragVisitor && !committedEvts.some(e => e.id === dragVisitor.id)
              ? [...committedEvts, dragVisitor]
              : committedEvts
            return (
              <div
                key={`day-${i}`}
                data-day-col={dateStr}
                onClick={(e) => handleColumnClick(e, dateStr)}
                style={{
                  position: 'relative',
                  background: isToday ? `${C.gold}08` : C.charcoal,
                  height: DAY_GRID_HEIGHT,
                  borderLeft: isToday ? `2px solid ${C.gold}44` : 'none',
                  cursor: 'cell',
                }}
              >
                {/* Hour grid lines */}
                {dayGridHours.map(hour => (
                  <div
                    key={`week-line-${i}-${hour}`}
                    style={{
                      position: 'absolute', left: 0, right: 0,
                      top: (hour - DAY_START_HOUR) * HOUR_HEIGHT,
                      borderTop: `1px solid ${C.steel}22`,
                      pointerEvents: 'none',
                    }}
                  />
                ))}

                {/* Current-time indicator — red line on today's column only */}
                {isToday && nowInRange && (
                  <div style={{
                    position: 'absolute', left: 0, right: 0, top: nowTop,
                    borderTop: '2px solid #D46A6A', zIndex: 5, pointerEvents: 'none',
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%', background: '#D46A6A',
                      position: 'absolute', top: -4, left: -3,
                    }} />
                  </div>
                )}

                {/* Drag gap highlight on the column the drag is targeting */}
                {dragState && dragState.previewDate === dateStr && (() => {
                  const top = ((dragState.gapFloorMin - DAY_START_HOUR * 60) / 60) * HOUR_HEIGHT
                  const height = ((dragState.gapCeilingMin - dragState.gapFloorMin) / 60) * HOUR_HEIGHT
                  return (
                    <div style={{
                      position: 'absolute', left: 2, right: 2,
                      top, height,
                      background: `${C.gold}10`,
                      border: `1px dashed ${C.gold}55`,
                      borderRadius: 4,
                      pointerEvents: 'none',
                      zIndex: 0,
                    }} />
                  )
                })()}

                {/* Time-positioned event cards */}
                {dayEvts.map(ev => {
                  const drag = dragState && dragState.eventId === ev.id ? dragState : null
                  // Hide the card from its original column once it's been
                  // dragged into a different one.
                  if (drag && drag.previewDate !== dateStr) return null
                  const baseTimes = eventTimes(ev)
                  const startMin = drag ? drag.previewStartMin : baseTimes.startMin
                  const endMin = drag ? drag.previewEndMin : baseTimes.endMin
                  const start = formatHHMM(startMin)
                  const end = formatHHMM(endMin)
                  const dayStartMin = DAY_START_HOUR * 60
                  const dayEndMin = DAY_END_HOUR * 60
                  const visibleStart = Math.max(startMin, dayStartMin)
                  const visibleEnd = Math.min(endMin, dayEndMin)
                  if (visibleEnd <= visibleStart) return null
                  const top = ((visibleStart - dayStartMin) / 60) * HOUR_HEIGHT
                  const height = Math.max(((visibleEnd - visibleStart) / 60) * HOUR_HEIGHT, 24)
                  const isQuick = ev.slot === 'quick'
                  const isInternal = !!ev.category
                  const internalPreset = isInternal ? INTERNAL_PRESETS.find(p => p.key === ev.category) : null
                  const isBeingDragged = !!drag
                  const needsResend = !isEventConfirmed(ev) && !isInternal
                  const accent = internalPreset?.color ?? statusColor[ev.status]
                  return (
                    <div
                      key={ev.id}
                      data-event-card
                      onPointerDown={(e) => beginDrag(ev, 'move', e)}
                      onClick={(e) => e.stopPropagation()}
                      title={needsResend ? 'Customer needs new confirmation — schedule changed' : undefined}
                      style={{
                        position: 'absolute',
                        top, height,
                        left: 4, right: 4,
                        background: needsResend ? '#D46A6A18' : accent + (isQuick || isInternal ? '22' : '15'),
                        border: `1px solid ${needsResend ? '#D46A6A66' : accent + '55'}`,
                        borderLeft: `3px solid ${needsResend ? '#D46A6A' : accent}`,
                        borderRadius: 6,
                        padding: '4px 6px',
                        cursor: isBeingDragged ? 'grabbing' : 'grab',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                        transition: isBeingDragged ? 'none' : 'transform .12s, box-shadow .12s',
                        boxShadow: isBeingDragged ? '0 8px 24px rgba(0,0,0,.5)' : 'none',
                        zIndex: isBeingDragged ? 10 : 1,
                        touchAction: 'none',
                        userSelect: 'none',
                      }}
                    >
                      {/* Top resize handle — flashes red when clamped against another event */}
                      <div
                        onPointerDown={(e) => beginDrag(ev, 'resize-top', e)}
                        style={{
                          position: 'absolute', top: 0, left: 0, right: 0, height: 5,
                          cursor: 'ns-resize', touchAction: 'none',
                          background: drag?.clampedTop ? '#D46A6A88' : 'transparent',
                          transition: 'background .15s',
                        }}
                      />
                      <div style={{
                        fontSize: 11, fontWeight: 700, color: C.white,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        display: 'flex', alignItems: 'center', gap: 3, minWidth: 0,
                      }}>
                        {internalPreset && <span style={{ flexShrink: 0, fontSize: 10 }}>{internalPreset.icon}</span>}
                        {needsResend && <AlertCircle size={10} color="#D46A6A" style={{ flexShrink: 0 }} />}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.customerName}</span>
                      </div>
                      {height >= 36 && (
                        <div style={{
                          fontSize: 10, color: C.silver,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {start}–{end}{!isInternal && isQuick ? ' · Quick' : ''}
                        </div>
                      )}
                      {height >= 56 && !isInternal && (
                        <div style={{
                          fontSize: 10, color: C.steel,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>{ev.jobType}</div>
                      )}
                      {/* Bottom resize handle — flashes red when clamped */}
                      <div
                        onPointerDown={(e) => beginDrag(ev, 'resize-bottom', e)}
                        style={{
                          position: 'absolute', bottom: 0, left: 0, right: 0, height: 5,
                          cursor: 'ns-resize', touchAction: 'none',
                          background: drag?.clampedBottom ? '#D46A6A88' : 'transparent',
                          transition: 'background .15s',
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
        <div style={{ fontSize: 11, color: C.steel, marginTop: 8, textAlign: 'center' }}>
          Drag a card to reschedule, or the top/bottom edge to resize. Snaps to 30-minute increments. Cards stop at neighbouring jobs — free up time by adjusting the neighbour first.
        </div>
        </>
      )}

      {/* day view — proper time-positioned grid. Each event card sits at
          its actual start time and stretches to its duration, so a Quick
          fit-in at 11:00–12:00 visibly slots in next to (or shrinks)
          the morning block. */}
      {view === 'day' && (
        <>
          <div style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: '64px 1fr',
            background: `${C.steel}22`,
            borderRadius: 12,
            overflow: 'hidden',
            gap: 1,
          }}>
            {/* Hour labels column */}
            <div style={{ background: C.charcoalLight, position: 'relative', height: DAY_GRID_HEIGHT }}>
              {dayGridHours.map(hour => (
                <div
                  key={`label-${hour}`}
                  style={{
                    position: 'absolute',
                    top: (hour - DAY_START_HOUR) * HOUR_HEIGHT,
                    right: 8,
                    fontSize: 11,
                    fontWeight: 500,
                    color: C.steel,
                    transform: 'translateY(-6px)',
                  }}
                >
                  {String(hour).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* Events column */}
            <div
              data-day-col={formatDate(currentDate)}
              onClick={(e) => handleColumnClick(e, formatDate(currentDate))}
              style={{
                position: 'relative',
                background: C.charcoal,
                height: DAY_GRID_HEIGHT,
                cursor: 'cell',
              }}
            >
              {/* Hour grid lines */}
              {dayGridHours.map(hour => (
                <div
                  key={`line-${hour}`}
                  style={{
                    position: 'absolute',
                    left: 0, right: 0,
                    top: (hour - DAY_START_HOUR) * HOUR_HEIGHT,
                    borderTop: `1px solid ${C.steel}22`,
                    pointerEvents: 'none',
                  }}
                />
              ))}

              {/* Current-time indicator — red line across today's column */}
              {nowInRange && (
                <div style={{
                  position: 'absolute', left: 0, right: 0, top: nowTop,
                  borderTop: '2px solid #D46A6A', zIndex: 5, pointerEvents: 'none',
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', background: '#D46A6A',
                    position: 'absolute', top: -5, left: -4,
                  }} />
                </div>
              )}

              {/* Drag gap highlight — shows the free range the dragged
                  card is allowed to land in. Appears only on the day the
                  drag is currently targeting. */}
              {dragState && dragState.previewDate === formatDate(currentDate) && (() => {
                const top = ((dragState.gapFloorMin - DAY_START_HOUR * 60) / 60) * HOUR_HEIGHT
                const height = ((dragState.gapCeilingMin - dragState.gapFloorMin) / 60) * HOUR_HEIGHT
                return (
                  <div style={{
                    position: 'absolute', left: 4, right: 4,
                    top, height,
                    background: `${C.gold}10`,
                    border: `1px dashed ${C.gold}55`,
                    borderRadius: 6,
                    pointerEvents: 'none',
                    zIndex: 0,
                  }} />
                )
              })()}

              {/* Event cards positioned by their actual times */}
              {dayEvents.map(ev => {
                const drag = dragState && dragState.eventId === ev.id ? dragState : null
                // If this card is being dragged across days in the day view,
                // skip rendering it here when the preview date moved away (the
                // day view only shows currentDate).
                if (drag && drag.previewDate !== formatDate(currentDate)) return null
                const baseTimes = eventTimes(ev)
                const startMin = drag ? drag.previewStartMin : baseTimes.startMin
                const endMin = drag ? drag.previewEndMin : baseTimes.endMin
                const start = formatHHMM(startMin)
                const end = formatHHMM(endMin)
                const dayStartMin = DAY_START_HOUR * 60
                const dayEndMin = DAY_END_HOUR * 60
                const visibleStart = Math.max(startMin, dayStartMin)
                const visibleEnd = Math.min(endMin, dayEndMin)
                if (visibleEnd <= visibleStart) return null
                const top = ((visibleStart - dayStartMin) / 60) * HOUR_HEIGHT
                const height = Math.max(((visibleEnd - visibleStart) / 60) * HOUR_HEIGHT, 28)
                const val = getEventValue(ev)
                const isQuick = ev.slot === 'quick'
                const isInternal = !!ev.category
                const internalPreset = isInternal ? INTERNAL_PRESETS.find(p => p.key === ev.category) : null
                const isBeingDragged = !!drag
                // Schedule has changed since the customer was last notified.
                // Surface a red warning indicator on the card so the user
                // sees it without opening the panel.
                const needsResend = !ev.confirmationSentAt && !isInternal
                const accent = internalPreset?.color ?? statusColor[ev.status]
                return (
                  <div
                    key={ev.id}
                    data-event-card
                    onPointerDown={(e) => beginDrag(ev, 'move', e)}
                    onClick={(e) => e.stopPropagation()}
                    title={needsResend ? 'Customer needs new confirmation — schedule changed' : undefined}
                    style={{
                      position: 'absolute',
                      top, height,
                      left: 8, right: 8,
                      background: needsResend ? '#D46A6A18' : accent + (isInternal ? '22' : isQuick ? '22' : '15'),
                      border: `1px solid ${needsResend ? '#D46A6A66' : accent + '55'}`,
                      borderLeft: `3px solid ${needsResend ? '#D46A6A' : accent}`,
                      borderRadius: 8,
                      padding: '6px 10px',
                      cursor: isBeingDragged ? 'grabbing' : 'grab',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      transition: isBeingDragged ? 'none' : 'transform .12s, box-shadow .12s',
                      boxShadow: isBeingDragged ? '0 8px 24px rgba(0,0,0,.5)' : 'none',
                      zIndex: isBeingDragged ? 10 : 1,
                      touchAction: 'none',
                      userSelect: 'none',
                    }}
                  >
                    {/* Top resize handle — flashes red when clamped */}
                    <div
                      onPointerDown={(e) => beginDrag(ev, 'resize-top', e)}
                      style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: 6,
                        cursor: 'ns-resize', touchAction: 'none',
                        background: drag?.clampedTop ? '#D46A6A88' : 'transparent',
                        transition: 'background .15s',
                      }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 700, color: C.white,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        display: 'flex', alignItems: 'center', gap: 4, minWidth: 0,
                      }}>
                        {internalPreset && <span style={{ flexShrink: 0 }}>{internalPreset.icon}</span>}
                        {needsResend && <AlertCircle size={11} color="#D46A6A" style={{ flexShrink: 0 }} />}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.customerName}</span>
                      </div>
                      <div style={{ fontSize: 10, color: C.silver, fontWeight: 500, flexShrink: 0 }}>
                        {start}–{end}
                      </div>
                    </div>
                    {height >= 44 && !isInternal && (
                      <div style={{
                        fontSize: 11, color: C.silver,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {ev.jobType}{isQuick ? ' · Quick' : ''}
                      </div>
                    )}
                    {height >= 64 && val > 0 && !isInternal && (
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.gold }}>
                        {'\u00A3'}{val.toLocaleString('en-GB')}
                      </div>
                    )}
                    {/* Bottom resize handle — flashes red when clamped */}
                    <div
                      onPointerDown={(e) => beginDrag(ev, 'resize-bottom', e)}
                      style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0, height: 6,
                        cursor: 'ns-resize', touchAction: 'none',
                        background: drag?.clampedBottom ? '#D46A6A88' : 'transparent',
                        transition: 'background .15s',
                      }}
                    />
                  </div>
                )
              })}

              {dayEvents.length === 0 && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: C.steel, fontSize: 13, fontStyle: 'italic',
                  pointerEvents: 'none',
                }}>
                  No jobs scheduled for this day
                </div>
              )}
            </div>
          </div>
          <div style={{ fontSize: 11, color: C.steel, marginTop: 8, textAlign: 'center' }}>
            Drag a card to reschedule, or the top/bottom edge to resize. Snaps to 30-minute increments. Cards stop at neighbouring jobs — free up time by adjusting the neighbour first.
          </div>
        </>
      )}

      {/* FAB */}
      <button
        style={s.fab}
        title="New Event"
        onClick={() => alert('New Event — coming soon with Supabase integration')}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>

      {/* Quick-create modal for internal events (travel, admin, etc.) */}
      {quickCreate && (() => {
        const customPreset = INTERNAL_PRESETS.find(p => p.key === 'custom')!
        const showingCustomInput = customName !== '' || (typeof window !== 'undefined' && (window as Window & { __qcCustom?: boolean }).__qcCustom)
        return (
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 200 }}
            onClick={() => { setQuickCreate(null); setCustomName('') }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: C.charcoalLight, borderRadius: 16, padding: 'clamp(20px, 4vw, 28px)',
            width: 'min(400px, calc(100vw - 24px))', maxHeight: 'calc(100dvh - 24px)', overflowY: 'auto',
            zIndex: 210, boxShadow: '0 16px 48px rgba(0,0,0,.5)',
            border: `1px solid ${C.steel}44`,
          }}>
            <div style={{
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
              gap: 12, marginBottom: 4,
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.white, marginBottom: 2 }}>
                  New entry
                </div>
                <div style={{ fontSize: 12, color: C.silver }}>
                  {new Date(quickCreate.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} at {String(Math.floor(quickCreate.startMin / 60)).padStart(2, '0')}:{String(quickCreate.startMin % 60).padStart(2, '0')}
                </div>
              </div>
              <button
                onClick={() => { setQuickCreate(null); setCustomName('') }}
                style={{
                  background: 'transparent', border: 'none', color: C.silver,
                  cursor: 'pointer', padding: 4, display: 'flex',
                }}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            {!showingCustomInput && (
              <>
                <div style={{
                  fontSize: 11, color: C.steel, textTransform: 'uppercase', letterSpacing: 0.8,
                  fontWeight: 600, marginTop: 18, marginBottom: 10,
                }}>
                  Pick a category
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {INTERNAL_PRESETS.filter(p => p.key !== 'custom').map(preset => (
                    <button
                      key={preset.key}
                      onClick={() => createInternalEvent(preset)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '12px 14px', borderRadius: 10,
                        background: preset.color + '12', border: `1px solid ${preset.color}55`,
                        color: C.white, cursor: 'pointer', minHeight: 48,
                        transition: 'background .15s',
                        textAlign: 'left',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = preset.color + '24' }}
                      onMouseLeave={e => { e.currentTarget.style.background = preset.color + '12' }}
                    >
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{preset.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{preset.label}</div>
                        <div style={{ fontSize: 10, color: C.steel }}>{preset.durationMin} min</div>
                      </div>
                    </button>
                  ))}
                </div>
                {/* Custom — full-width separate row */}
                <button
                  onClick={() => setCustomName(' ')}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '12px 14px', borderRadius: 10, marginTop: 8,
                    background: 'transparent', border: `1px dashed ${C.steel}66`,
                    color: C.silver, cursor: 'pointer', minHeight: 44,
                    fontSize: 12, fontWeight: 600,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.color = C.gold }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = `${C.steel}66`; e.currentTarget.style.color = C.silver }}
                >
                  📌 Custom — type your own name
                </button>
              </>
            )}
            {showingCustomInput && (
              <>
                <div style={{
                  fontSize: 11, color: C.steel, textTransform: 'uppercase', letterSpacing: 0.8,
                  fontWeight: 600, marginTop: 18, marginBottom: 8,
                }}>
                  Custom entry name
                </div>
                <input
                  type="text"
                  autoFocus
                  value={customName.trim()}
                  onChange={e => setCustomName(e.target.value || ' ')}
                  onKeyDown={e => { if (e.key === 'Enter' && customName.trim()) createInternalEvent(customPreset, customName.trim()) }}
                  placeholder="e.g. Quote follow-up call"
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 10,
                    background: C.black, border: `1px solid ${C.steel}44`,
                    color: C.white, fontSize: 14, outline: 'none', boxSizing: 'border-box',
                    marginBottom: 12,
                  }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setCustomName('')}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: 'transparent', border: `1px solid ${C.steel}44`,
                      color: C.silver, cursor: 'pointer', minHeight: 38,
                    }}
                  >
                    Back
                  </button>
                  <button
                    onClick={() => createInternalEvent(customPreset, customName.trim())}
                    disabled={!customName.trim()}
                    style={{
                      flex: 2, padding: '10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                      background: customName.trim() ? C.gold : C.black,
                      border: `1px solid ${C.gold}`,
                      color: customName.trim() ? C.charcoal : C.steel,
                      cursor: customName.trim() ? 'pointer' : 'not-allowed',
                      minHeight: 38,
                    }}
                  >
                    Create
                  </button>
                </div>
              </>
            )}
          </div>
        </>
        )
      })()}

      {/* Edit/delete modal for internal events */}
      {editingInternal && (() => {
        const preset = INTERNAL_PRESETS.find(p => p.key === editingInternal.category)
        return (
          <>
            <div
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 200 }}
              onClick={() => setEditingInternal(null)}
            />
            <div style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              background: C.charcoalLight, borderRadius: 16, padding: 'clamp(20px, 4vw, 28px)',
              width: 'min(380px, calc(100vw - 24px))', maxHeight: 'calc(100dvh - 24px)', overflowY: 'auto',
              zIndex: 210, boxShadow: '0 16px 48px rgba(0,0,0,.5)',
              border: `1px solid ${C.steel}44`,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 12, marginBottom: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 22 }}>{preset?.icon ?? '📌'}</span>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.white }}>
                    Edit entry
                  </div>
                </div>
                <button
                  onClick={() => setEditingInternal(null)}
                  style={{
                    background: 'transparent', border: 'none', color: C.silver,
                    cursor: 'pointer', padding: 4, display: 'flex',
                  }}
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ fontSize: 11, color: C.steel, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600, marginBottom: 6 }}>
                Name
              </div>
              <input
                type="text"
                value={editingInternalName}
                onChange={e => setEditingInternalName(e.target.value)}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10,
                  background: C.black, border: `1px solid ${C.steel}44`,
                  color: C.white, fontSize: 14, outline: 'none', boxSizing: 'border-box',
                  marginBottom: 14,
                }}
              />

              <div style={{ fontSize: 11, color: C.steel, marginBottom: 16 }}>
                {new Date(editingInternal.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                {editingInternal.startTime && editingInternal.endTime && ` · ${editingInternal.startTime}–${editingInternal.endTime}`}
                <br />
                Drag the card on the calendar to move it or change its duration.
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete "${editingInternal.customerName}" from your calendar?`)) {
                      deleteEvent(editingInternal.id)
                      setEditingInternal(null)
                    }
                  }}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: 'transparent', border: '1px solid #D46A6A66',
                    color: '#D46A6A', cursor: 'pointer', minHeight: 40,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <X size={13} /> Delete
                </button>
                <button
                  onClick={() => {
                    const trimmed = editingInternalName.trim()
                    if (trimmed && trimmed !== editingInternal.customerName) {
                      updateEvent(editingInternal.id, { customerName: trimmed })
                    }
                    setEditingInternal(null)
                  }}
                  disabled={!editingInternalName.trim()}
                  style={{
                    flex: 2, padding: '10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                    background: editingInternalName.trim() ? C.gold : C.black,
                    border: `1px solid ${C.gold}`,
                    color: editingInternalName.trim() ? C.charcoal : C.steel,
                    cursor: editingInternalName.trim() ? 'pointer' : 'not-allowed',
                    minHeight: 40,
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </>
        )
      })()}

      {/* Event detail modal — shows all bookings for this job */}
      {selectedEvent && (() => {
        // Find all events for the same job (or same customer if no jobId)
        const relatedEvents = selectedEvent.jobId
          ? events.filter(e => e.jobId === selectedEvent.jobId).sort((a, b) => a.date.localeCompare(b.date))
          : [selectedEvent]

        const inputStyle: CSSProperties = {
          width: '100%', padding: '8px 10px', borderRadius: 8,
          background: C.black, border: `1px solid ${C.steel}33`,
          color: C.white, fontSize: 13, outline: 'none',
        }

        return (
          <div style={s.overlay} onClick={() => { setSelectedEvent(null); setIsEditing(false) }}>
            <div style={s.modal} onClick={e => e.stopPropagation()}>
              <button
                style={s.modalClose}
                onClick={() => { setSelectedEvent(null); setIsEditing(false) }}
                onMouseEnter={e => { e.currentTarget.style.background = `${C.steel}33` }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <X size={18} />
              </button>

              <div style={s.modalTitle}>{selectedEvent.customerName}</div>
              <div style={{ fontSize: 13, color: C.silver, marginBottom: 16 }}>{selectedEvent.jobType}</div>

              {/* All bookings for this job */}
              <div style={{ fontSize: 11, fontWeight: 600, color: C.steel, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                Bookings ({relatedEvents.length})
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                {relatedEvents.map(ev => (
                  <div key={ev.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', background: C.black, borderRadius: 8,
                    borderLeft: `3px solid ${statusColor[ev.status]}`,
                  }}>
                    {isEditing && editingEventId === ev.id ? (
                      <>
                        <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                          style={{ ...inputStyle, flex: 1, colorScheme: 'dark' }} />
                        <select value={editSlot} onChange={e => setEditSlot(e.target.value as EventSlot)}
                          style={{ ...inputStyle, flex: 1, appearance: 'none', WebkitAppearance: 'none' as any }}>
                          <option value="morning">AM</option>
                          <option value="afternoon">PM</option>
                          <option value="full">Full</option>
                        </select>
                        <button onClick={() => {
                          updateEvent(ev.id, { date: editDate, slot: editSlot })
                          setIsEditing(false)
                        }} style={{ background: 'transparent', border: 'none', color: C.gold, cursor: 'pointer', padding: 4, fontSize: 12, fontWeight: 600 }}>
                          Save
                        </button>
                      </>
                    ) : (
                      <>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: C.white }}>
                            {new Date(ev.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </span>
                          <span style={{ fontSize: 12, color: C.steel, marginLeft: 8 }}>{slotLabel(ev.slot)}</span>
                        </div>
                        <button onClick={() => {
                          setEditDate(ev.date)
                          setEditSlot(ev.slot)
                          setEditingEventId(ev.id)
                          setIsEditing(true)
                        }} style={{ background: 'transparent', border: 'none', color: C.steel, cursor: 'pointer', padding: 4, display: 'flex' }}>
                          <Clock size={14} />
                        </button>
                        <button onClick={() => {
                          const evData = { ...ev }
                          deleteEvent(ev.id)
                          showUndo({
                            message: `Event removed: ${ev.customerName}`,
                            undo: () => addEvent({ jobId: evData.jobId, customerId: evData.customerId, customerName: evData.customerName, jobType: evData.jobType, date: evData.date, slot: evData.slot, status: evData.status, notes: evData.notes }),
                          })
                        }}
                          style={{ background: 'transparent', border: 'none', color: C.steel, cursor: 'pointer', padding: 4, display: 'flex' }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#D46A6A' }}
                          onMouseLeave={e => { e.currentTarget.style.color = C.steel }}
                        >
                          <X size={14} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Add another booking */}
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                  style={{ ...inputStyle, flex: 1, colorScheme: 'dark' }} />
                <select value={editSlot} onChange={e => setEditSlot(e.target.value as EventSlot)}
                  style={{ ...inputStyle, flex: 1, appearance: 'none', WebkitAppearance: 'none' as any }}>
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="full">Full Day</option>
                </select>
                <button
                  disabled={!editDate}
                  onClick={() => {
                    if (!editDate) return
                    addEvent({
                      jobId: selectedEvent.jobId,
                      customerId: selectedEvent.customerId,
                      customerName: selectedEvent.customerName,
                      jobType: selectedEvent.jobType,
                      date: editDate,
                      slot: editSlot,
                      status: 'Scheduled',
                      notes: '',
                    })
                    setEditDate('')
                  }}
                  style={{
                    padding: '8px 14px', borderRadius: 8,
                    background: editDate ? `${C.gold}15` : C.black,
                    border: `1px solid ${editDate ? C.gold + '44' : C.steel + '33'}`,
                    color: editDate ? C.gold : C.steel, cursor: editDate ? 'pointer' : 'not-allowed',
                    fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
                  }}
                >
                  + Add
                </button>
              </div>

              {/* View Job button */}
              {selectedEvent.jobId && (
                <button
                  onClick={() => { setSelectedEvent(null); setIsEditing(false); navigate('/jobs') }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    width: '100%', padding: '10px 16px', borderRadius: 10, marginTop: 14,
                    background: `${C.gold}15`, border: `1px solid ${C.gold}33`,
                    color: C.gold, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    transition: 'background .15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${C.gold}33` }}
                  onMouseLeave={e => { e.currentTarget.style.background = `${C.gold}15` }}
                >
                  <Briefcase size={14} /> View Job
                </button>
              )}

              {/* Add to Calendar export */}
              <button
                onClick={() => exportSingleEvent(selectedEvent, customers)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  width: '100%', padding: '10px 16px', borderRadius: 10, marginTop: 14,
                  background: `${C.steel}15`, border: `1px solid ${C.steel}33`,
                  color: C.silver, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  transition: 'background .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `${C.steel}33` }}
                onMouseLeave={e => { e.currentTarget.style.background = `${C.steel}15` }}
              >
                <Download size={14} /> Add to Calendar (.ics)
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
