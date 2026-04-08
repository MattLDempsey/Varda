import type { ScheduleEvent, Customer } from '../data/DataContext'

/* ──────────────────────────────────────────────────────
   Calendar Export (ICS)
   Generates .ics files for importing into Google Calendar,
   Apple Calendar, Outlook, etc.
   ────────────────────────────────────────────────────── */

const SLOT_TIMES: Record<string, { start: string; end: string }> = {
  morning:   { start: '080000', end: '120000' },
  afternoon: { start: '120000', end: '170000' },
  full:      { start: '080000', end: '170000' },
}

/** Format a date string (YYYY-MM-DD) + time (HHMMSS) into ICS datetime */
function icsDateTime(date: string, time: string): string {
  return date.replace(/-/g, '') + 'T' + time
}

/** Escape text for ICS format (fold lines, escape special chars) */
function icsEscape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

/** Generate a simple UID for an ICS event */
function generateUID(eventId?: string): string {
  const base = eventId || Math.random().toString(36).substring(2, 15)
  return `${base}@varda.greyhavens.app`
}

/** Get current UTC timestamp in ICS format */
function icsNow(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  )
}

export function generateICSEvent(event: {
  id?: string
  title: string
  description: string
  date: string // YYYY-MM-DD
  slot: 'morning' | 'afternoon' | 'full'
  customerName: string
  customerPhone?: string
  customerAddress?: string
  jobType: string
}): string {
  const times = SLOT_TIMES[event.slot]
  const summary = `${event.jobType} - ${event.customerName}`

  const descLines: string[] = [
    `Job type: ${event.jobType}`,
    `Customer: ${event.customerName}`,
  ]
  if (event.customerPhone) descLines.push(`Phone: ${event.customerPhone}`)
  if (event.description) descLines.push(event.description)

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Varda//Grey Havens//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${generateUID(event.id)}`,
    `DTSTAMP:${icsNow()}`,
    `DTSTART:${icsDateTime(event.date, times.start)}`,
    `DTEND:${icsDateTime(event.date, times.end)}`,
    `SUMMARY:${icsEscape(summary)}`,
    `DESCRIPTION:${icsEscape(descLines.join('\\n'))}`,
  ]

  if (event.customerAddress) {
    lines.push(`LOCATION:${icsEscape(event.customerAddress)}`)
  }

  lines.push('END:VEVENT', 'END:VCALENDAR')

  return lines.join('\r\n')
}

export function downloadICSFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.ics') ? filename : `${filename}.ics`
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function generateICSCalendar(
  events: ScheduleEvent[],
  customers: Customer[]
): string {
  const customerMap = new Map(customers.map(c => [c.id, c]))

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Varda//Grey Havens//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Grey Havens Schedule',
  ]

  for (const ev of events) {
    const times = SLOT_TIMES[ev.slot]
    const summary = `${ev.jobType} - ${ev.customerName}`
    const customer = ev.customerId ? customerMap.get(ev.customerId) : undefined

    const descLines: string[] = [
      `Job type: ${ev.jobType}`,
      `Customer: ${ev.customerName}`,
    ]
    if (customer?.phone) descLines.push(`Phone: ${customer.phone}`)
    if (ev.notes) descLines.push(ev.notes)

    const address = customer
      ? [customer.address1, customer.address2, customer.city, customer.postcode]
          .filter(Boolean)
          .join(', ')
      : ''

    lines.push(
      'BEGIN:VEVENT',
      `UID:${generateUID(ev.id)}`,
      `DTSTAMP:${icsNow()}`,
      `DTSTART:${icsDateTime(ev.date, times.start)}`,
      `DTEND:${icsDateTime(ev.date, times.end)}`,
      `SUMMARY:${icsEscape(summary)}`,
      `DESCRIPTION:${icsEscape(descLines.join('\\n'))}`,
      `STATUS:${ev.status === 'Complete' ? 'COMPLETED' : 'CONFIRMED'}`,
    )

    if (address) {
      lines.push(`LOCATION:${icsEscape(address)}`)
    }

    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

/** Export a single ScheduleEvent with customer data lookup */
export function exportSingleEvent(
  event: ScheduleEvent,
  customers: Customer[]
): void {
  const customer = event.customerId
    ? customers.find(c => c.id === event.customerId)
    : undefined

  const address = customer
    ? [customer.address1, customer.address2, customer.city, customer.postcode]
        .filter(Boolean)
        .join(', ')
    : ''

  const ics = generateICSEvent({
    id: event.id,
    title: `${event.jobType} - ${event.customerName}`,
    description: event.notes || '',
    date: event.date,
    slot: event.slot,
    customerName: event.customerName,
    customerPhone: customer?.phone,
    customerAddress: address || undefined,
    jobType: event.jobType,
  })

  const safeName = event.customerName.replace(/[^a-zA-Z0-9]/g, '-')
  downloadICSFile(ics, `${event.date}-${safeName}.ics`)
}

/** Export events for a given week (Mon-Sun containing the date) */
export function exportWeekEvents(
  allEvents: ScheduleEvent[],
  customers: Customer[],
  weekMonday: Date
): void {
  const monday = new Date(weekMonday)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const mondayStr = fmt(monday)
  const sundayStr = fmt(sunday)

  const weekEvents = allEvents.filter(
    e => e.date >= mondayStr && e.date <= sundayStr
  )

  if (weekEvents.length === 0) {
    alert('No events this week to export.')
    return
  }

  const ics = generateICSCalendar(weekEvents, customers)
  downloadICSFile(ics, `schedule-week-${mondayStr}.ics`)
}

/** Export all events */
export function exportAllEvents(
  allEvents: ScheduleEvent[],
  customers: Customer[]
): void {
  if (allEvents.length === 0) {
    alert('No events to export.')
    return
  }

  const ics = generateICSCalendar(allEvents, customers)
  downloadICSFile(ics, 'schedule-all-events.ics')
}
