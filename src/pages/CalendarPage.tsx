import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, Clock, X, Download, Calendar, Briefcase } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useTheme } from '../theme/ThemeContext'
import { useData, type ScheduleEvent, type EventSlot } from '../data/DataContext'
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
  const eventTimes = (ev: { slot: string; startTime?: string | null; endTime?: string | null }) => {
    const def = SLOT_DEFAULTS_HHMM[ev.slot] ?? SLOT_DEFAULTS_HHMM.morning
    const start = ev.startTime || def.start
    const end = ev.endTime || def.end
    return { start, end, startMin: parseHHMM(start), endMin: parseHHMM(end) }
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
            const dayEvts = events.filter(e => e.date === dateStr)
            return (
              <div
                key={`day-${i}`}
                style={{
                  position: 'relative',
                  background: isToday ? `${C.gold}08` : C.charcoal,
                  height: DAY_GRID_HEIGHT,
                  borderLeft: isToday ? `2px solid ${C.gold}44` : 'none',
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

                {/* Time-positioned event cards */}
                {dayEvts.map(ev => {
                  const { startMin, endMin, start, end } = eventTimes(ev)
                  const dayStartMin = DAY_START_HOUR * 60
                  const dayEndMin = DAY_END_HOUR * 60
                  const visibleStart = Math.max(startMin, dayStartMin)
                  const visibleEnd = Math.min(endMin, dayEndMin)
                  if (visibleEnd <= visibleStart) return null
                  const top = ((visibleStart - dayStartMin) / 60) * HOUR_HEIGHT
                  const height = Math.max(((visibleEnd - visibleStart) / 60) * HOUR_HEIGHT, 24)
                  const isQuick = ev.slot === 'quick'
                  return (
                    <div
                      key={ev.id}
                      onClick={() => setSelectedEvent(ev)}
                      style={{
                        position: 'absolute',
                        top, height,
                        left: 4, right: 4,
                        background: statusColor[ev.status] + (isQuick ? '22' : '15'),
                        border: `1px solid ${statusColor[ev.status]}55`,
                        borderLeft: `3px solid ${statusColor[ev.status]}`,
                        borderRadius: 6,
                        padding: '4px 6px',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                        transition: 'transform .12s, box-shadow .12s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.3)' }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
                    >
                      <div style={{
                        fontSize: 11, fontWeight: 700, color: C.white,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{ev.customerName}</div>
                      {height >= 36 && (
                        <div style={{
                          fontSize: 10, color: C.silver,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {start}–{end}{isQuick ? ' · Quick' : ''}
                        </div>
                      )}
                      {height >= 56 && (
                        <div style={{
                          fontSize: 10, color: C.steel,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>{ev.jobType}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
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
            <div style={{
              position: 'relative',
              background: C.charcoal,
              height: DAY_GRID_HEIGHT,
            }}>
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

              {/* Event cards positioned by their actual times */}
              {dayEvents.map(ev => {
                const { startMin, endMin, start, end } = eventTimes(ev)
                const dayStartMin = DAY_START_HOUR * 60
                const dayEndMin = DAY_END_HOUR * 60
                // Clamp to visible range so anything before/after still shows
                // a partial card at the edge.
                const visibleStart = Math.max(startMin, dayStartMin)
                const visibleEnd = Math.min(endMin, dayEndMin)
                if (visibleEnd <= visibleStart) return null
                const top = ((visibleStart - dayStartMin) / 60) * HOUR_HEIGHT
                const height = Math.max(((visibleEnd - visibleStart) / 60) * HOUR_HEIGHT, 28)
                const val = getEventValue(ev)
                const isQuick = ev.slot === 'quick'
                return (
                  <div
                    key={ev.id}
                    onClick={() => setSelectedEvent(ev)}
                    style={{
                      position: 'absolute',
                      top, height,
                      left: 8, right: 8,
                      background: statusColor[ev.status] + (isQuick ? '22' : '15'),
                      border: `1px solid ${statusColor[ev.status]}55`,
                      borderLeft: `3px solid ${statusColor[ev.status]}`,
                      borderRadius: 8,
                      padding: '6px 10px',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      transition: 'transform .12s, box-shadow .12s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.3)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 700, color: C.white,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{ev.customerName}</div>
                      <div style={{ fontSize: 10, color: C.silver, fontWeight: 500, flexShrink: 0 }}>
                        {start}–{end}
                      </div>
                    </div>
                    {height >= 44 && (
                      <div style={{
                        fontSize: 11, color: C.silver,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {ev.jobType}{isQuick ? ' · Quick' : ''}
                      </div>
                    )}
                    {height >= 64 && val > 0 && (
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.gold }}>
                        {'\u00A3'}{val.toLocaleString('en-GB')}
                      </div>
                    )}
                  </div>
                )
              })}

              {dayEvents.length === 0 && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: C.steel, fontSize: 13, fontStyle: 'italic',
                }}>
                  No jobs scheduled for this day
                </div>
              )}
            </div>
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
