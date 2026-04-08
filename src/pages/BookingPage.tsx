import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Calendar, Clock, CheckCircle, Loader2, Zap, Phone, Mail, User, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { CSSProperties } from 'react'

/* ── colors (matching QuoteView / InvoiceView public pages) ── */
const gold = '#C6A86A'
const bg = '#1A1C20'
const card = '#24272D'
const cardLight = '#2E3138'
const steel = '#4B5057'
const silver = '#C9CDD2'
const white = '#F5F5F3'
const green = '#6ABF8A'
const red = '#D46A6A'

interface OrgInfo {
  name: string
  trade_type: string
  phone: string
  settings: {
    workingHours?: Record<string, { enabled: boolean; start: string; end: string }>
  } | null
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1 // Monday-based
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function BookingPage() {
  const { orgId } = useParams<{ orgId: string }>()
  const [orgInfo, setOrgInfo] = useState<OrgInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Form state
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [description, setDescription] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState<'Morning' | 'Afternoon' | ''>('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Calendar state
  const now = new Date()
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [calYear, setCalYear] = useState(now.getFullYear())

  // Fetch org info
  useEffect(() => {
    if (!orgId) return
    setLoading(true)
    supabase.rpc('get_public_org_info', { p_org_id: orgId })
      .then(({ data, error: err }) => {
        if (err || !data) {
          setError('Could not load business information. The booking link may be invalid.')
          setLoading(false)
          return
        }
        setOrgInfo(data as OrgInfo)
        setLoading(false)
      })
  }, [orgId])

  // Which days are enabled (from working hours)
  const enabledDays = useMemo(() => {
    if (!orgInfo?.settings?.workingHours) return new Set([0, 1, 2, 3, 4, 5]) // default Mon-Sat
    const dayMap: Record<string, number> = {
      Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3,
      Friday: 4, Saturday: 5, Sunday: 6,
    }
    const enabled = new Set<number>()
    const wh = orgInfo.settings.workingHours
    for (const [day, config] of Object.entries(wh)) {
      if (config.enabled && dayMap[day] !== undefined) {
        enabled.add(dayMap[day])
      }
    }
    return enabled
  }, [orgInfo])

  // Calendar grid
  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(calYear, calMonth)
    const firstDay = getFirstDayOfWeek(calYear, calMonth)
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    const cells: { day: number; dateStr: string; disabled: boolean; past: boolean }[] = []

    // Empty cells for offset
    for (let i = 0; i < firstDay; i++) {
      cells.push({ day: 0, dateStr: '', disabled: true, past: false })
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const dayOfWeek = (firstDay + d - 1) % 7
      const isPast = dateStr < todayStr
      const isWorkDay = enabledDays.has(dayOfWeek)
      cells.push({ day: d, dateStr, disabled: isPast || !isWorkDay, past: isPast })
    }

    return cells
  }, [calYear, calMonth, enabledDays, now])

  const handleSubmit = async () => {
    if (!orgId || !name.trim() || !email.trim() || !selectedDate || !selectedSlot || !description.trim()) return
    setSubmitting(true)
    setSubmitError('')

    const { error: err } = await supabase.rpc('create_public_booking', {
      p_org_id: orgId,
      p_customer_name: name.trim(),
      p_customer_email: email.trim(),
      p_customer_phone: phone.trim(),
      p_preferred_date: selectedDate,
      p_preferred_slot: selectedSlot,
      p_description: description.trim(),
    })

    setSubmitting(false)
    if (err) {
      setSubmitError('Something went wrong. Please try again or call us directly.')
    } else {
      setSubmitted(true)
    }
  }

  const canSubmit = name.trim() && email.trim() && selectedDate && selectedSlot && description.trim()

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) }
    else setCalMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) }
    else setCalMonth(m => m + 1)
  }

  // Prevent going to past months
  const canGoPrev = calYear > now.getFullYear() || (calYear === now.getFullYear() && calMonth > now.getMonth())

  /* ── styles ── */
  const s: Record<string, CSSProperties> = {
    page: {
      minHeight: '100vh', background: bg, display: 'flex', justifyContent: 'center',
      alignItems: 'flex-start', padding: '40px 20px',
    },
    container: {
      width: '100%', maxWidth: 560, background: card, borderRadius: 24,
      overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.5)',
    },
    header: {
      background: `linear-gradient(135deg, #2B2E34 0%, #33363D 100%)`,
      padding: '36px 32px 28px', borderBottom: `3px solid ${gold}`, textAlign: 'center',
    },
    brand: {
      fontFamily: "'Cinzel', serif", fontSize: 24, fontWeight: 700, color: gold,
      letterSpacing: 0.5, marginBottom: 4,
    },
    tagline: { fontSize: 13, color: steel, letterSpacing: 1.5, textTransform: 'uppercase' },
    body: { padding: '28px 32px 36px' },
    sectionTitle: { fontSize: 15, fontWeight: 600, color: white, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 },
    field: { marginBottom: 16 },
    label: { fontSize: 12, fontWeight: 600, color: silver, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'block' },
    input: {
      width: '100%', background: bg, border: `1px solid ${steel}44`,
      borderRadius: 8, padding: '12px 14px', color: white, fontSize: 14,
      outline: 'none', minHeight: 44, boxSizing: 'border-box',
      fontFamily: 'inherit',
    },
    textarea: {
      width: '100%', background: bg, border: `1px solid ${steel}44`,
      borderRadius: 8, padding: '12px 14px', color: white, fontSize: 14,
      outline: 'none', minHeight: 100, resize: 'vertical', boxSizing: 'border-box',
      fontFamily: 'inherit',
    },
    row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
    divider: { borderTop: `1px solid ${steel}33`, margin: '24px 0' },
    // Calendar
    calHeader: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
    },
    calNav: {
      background: 'transparent', border: `1px solid ${steel}44`, color: silver,
      borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 14, minHeight: 32,
      fontFamily: 'inherit',
    },
    calNavDisabled: { opacity: 0.3, cursor: 'not-allowed' },
    calMonth: { fontSize: 15, fontWeight: 600, color: white },
    calGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 16 },
    calDayHeader: { fontSize: 11, fontWeight: 600, color: steel, textAlign: 'center', padding: '4px 0' },
    calDay: {
      textAlign: 'center', padding: '8px 0', borderRadius: 6, cursor: 'pointer',
      fontSize: 13, fontWeight: 500, color: silver, border: '1px solid transparent',
      transition: 'all .15s', minHeight: 36, display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'transparent',
      fontFamily: 'inherit',
    },
    calDayDisabled: { color: `${steel}66`, cursor: 'not-allowed' },
    calDaySelected: { background: gold, color: bg, fontWeight: 700, borderColor: gold },
    // Slots
    slotRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 },
    slotBtn: {
      padding: '14px 16px', borderRadius: 10, border: `1px solid ${steel}44`,
      background: cardLight, cursor: 'pointer', textAlign: 'center',
      transition: 'all .15s', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 4, fontFamily: 'inherit',
    },
    slotBtnSelected: { borderColor: gold, background: `${gold}1A` },
    slotLabel: { fontSize: 14, fontWeight: 600 },
    slotTime: { fontSize: 11, color: steel },
    // Submit
    submitBtn: {
      width: '100%', padding: '14px 20px', borderRadius: 10,
      background: gold, color: bg, border: 'none', cursor: 'pointer',
      fontSize: 15, fontWeight: 700, minHeight: 48, display: 'flex',
      alignItems: 'center', justifyContent: 'center', gap: 8,
      transition: 'opacity .15s', fontFamily: 'inherit',
    },
    submitDisabled: { opacity: 0.5, cursor: 'not-allowed' },
    errorMsg: { fontSize: 13, color: red, marginTop: 12, textAlign: 'center' },
    // Success
    successBox: {
      textAlign: 'center', padding: '48px 32px', display: 'flex',
      flexDirection: 'column', alignItems: 'center', gap: 16,
    },
    successTitle: { fontSize: 22, fontWeight: 700, color: white },
    successText: { fontSize: 14, color: silver, lineHeight: 1.6, maxWidth: 400 },
  }

  /* ── Loading / Error ── */
  if (loading) {
    return (
      <div style={{ ...s.page, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 32, height: 32, border: `3px solid ${steel}33`,
            borderTopColor: gold, borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <span style={{ color: silver, fontSize: 14 }}>Loading booking page...</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  if (error || !orgInfo) {
    return (
      <div style={{ ...s.page, alignItems: 'center' }}>
        <div style={{ textAlign: 'center', color: silver }}>
          <Zap size={48} color={steel} style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8, color: white }}>Booking Unavailable</div>
          <div style={{ fontSize: 14, color: steel }}>{error || 'This booking page could not be loaded.'}</div>
        </div>
      </div>
    )
  }

  /* ── Success state ── */
  if (submitted) {
    return (
      <div style={s.page}>
        <div style={s.container}>
          <div style={s.header}>
            <div style={s.brand as CSSProperties}>{orgInfo.name}</div>
            <div style={s.tagline as CSSProperties}>{orgInfo.trade_type || 'Professional Services'}</div>
          </div>
          <div style={s.successBox as CSSProperties}>
            <CheckCircle size={56} color={green} />
            <div style={s.successTitle}>Booking Request Sent</div>
            <div style={s.successText as CSSProperties}>
              Thanks! We'll be in touch to confirm your booking. If you need something urgently,
              {orgInfo.phone && (
                <> you can call us on <strong style={{ color: gold }}>{orgInfo.phone}</strong>.</>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Get working hours for slot labels
  const wh = orgInfo.settings?.workingHours
  const morningStart = wh?.Monday?.start || '08:00'
  const afternoonEnd = wh?.Monday?.end || '17:00'

  return (
    <div style={s.page}>
      <div style={s.container}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.brand as CSSProperties}>{orgInfo.name}</div>
          <div style={s.tagline as CSSProperties}>{orgInfo.trade_type || 'Professional Services'}</div>
        </div>

        <div style={s.body}>
          <div style={{ fontSize: 14, color: silver, marginBottom: 24, lineHeight: 1.6 }}>
            Book a convenient time and we'll confirm your appointment. Fill in your details below
            and we'll get back to you.
          </div>

          {/* Contact Info */}
          <div style={s.sectionTitle}>
            <User size={16} color={gold} /> Your Details
          </div>

          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>Name *</label>
              <input
                style={s.input}
                placeholder="Your name"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Phone</label>
              <input
                style={s.input}
                placeholder="Phone number"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div style={s.field}>
            <label style={s.label}>Email *</label>
            <input
              style={s.input}
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div style={s.divider} />

          {/* Calendar */}
          <div style={s.sectionTitle}>
            <Calendar size={16} color={gold} /> Preferred Date
          </div>

          <div style={s.calHeader}>
            <button
              style={{ ...s.calNav, ...(canGoPrev ? {} : s.calNavDisabled) }}
              onClick={canGoPrev ? prevMonth : undefined}
              disabled={!canGoPrev}
            >
              &lsaquo;
            </button>
            <span style={s.calMonth}>{MONTH_NAMES[calMonth]} {calYear}</span>
            <button style={s.calNav} onClick={nextMonth}>&rsaquo;</button>
          </div>

          <div style={s.calGrid}>
            {DAY_HEADERS.map(dh => (
              <div key={dh} style={s.calDayHeader}>{dh}</div>
            ))}
            {calendarDays.map((cell, i) => {
              if (cell.day === 0) return <div key={`empty-${i}`} />
              const isSelected = cell.dateStr === selectedDate
              return (
                <button
                  key={cell.dateStr}
                  style={{
                    ...s.calDay,
                    ...(cell.disabled ? s.calDayDisabled : {}),
                    ...(isSelected ? s.calDaySelected : {}),
                  }}
                  onClick={() => !cell.disabled && setSelectedDate(cell.dateStr)}
                  disabled={cell.disabled}
                >
                  {cell.day}
                </button>
              )
            })}
          </div>

          {/* Time Slot */}
          <div style={s.sectionTitle}>
            <Clock size={16} color={gold} /> Preferred Time
          </div>

          <div style={s.slotRow}>
            <button
              style={{
                ...s.slotBtn,
                ...(selectedSlot === 'Morning' ? s.slotBtnSelected : {}),
              } as CSSProperties}
              onClick={() => setSelectedSlot('Morning')}
            >
              <span style={{ ...s.slotLabel, color: selectedSlot === 'Morning' ? gold : white }}>Morning</span>
              <span style={s.slotTime}>{morningStart} - 12:00</span>
            </button>
            <button
              style={{
                ...s.slotBtn,
                ...(selectedSlot === 'Afternoon' ? s.slotBtnSelected : {}),
              } as CSSProperties}
              onClick={() => setSelectedSlot('Afternoon')}
            >
              <span style={{ ...s.slotLabel, color: selectedSlot === 'Afternoon' ? gold : white }}>Afternoon</span>
              <span style={s.slotTime}>12:00 - {afternoonEnd}</span>
            </button>
          </div>

          <div style={s.divider} />

          {/* Description */}
          <div style={s.sectionTitle}>
            <FileText size={16} color={gold} /> Work Description
          </div>

          <div style={s.field}>
            <label style={s.label}>What do you need done? *</label>
            <textarea
              style={s.textarea as CSSProperties}
              placeholder="Describe the work you need — e.g. 'Need 3 extra sockets installed in the kitchen'"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Submit */}
          <button
            style={{
              ...s.submitBtn,
              ...(!canSubmit || submitting ? s.submitDisabled : {}),
            }}
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? (
              <>
                <div style={{
                  width: 18, height: 18, border: `2px solid ${bg}44`,
                  borderTopColor: bg, borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }} />
                Sending...
              </>
            ) : (
              <>
                <CheckCircle size={18} />
                Request Booking
              </>
            )}
          </button>

          {submitError && <div style={s.errorMsg as CSSProperties}>{submitError}</div>}

          {orgInfo.phone && (
            <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: steel }}>
              Or call us directly: <a href={`tel:${orgInfo.phone}`} style={{ color: gold, textDecoration: 'none' }}>{orgInfo.phone}</a>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
