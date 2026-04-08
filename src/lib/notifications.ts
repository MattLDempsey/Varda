/**
 * Browser notification infrastructure for Varda / Grey Havens OS.
 *
 * Checks for actionable events and shows browser (Web Notification API)
 * alerts when the corresponding setting toggle is enabled.
 */

import { useEffect, useRef } from 'react'
import type { AppSettings, ScheduleEvent, Customer } from '../data/DataContext'

/* ────────────────────────────────────────────────── */
/*  Permission                                       */
/* ────────────────────────────────────────────────── */

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function hasNotificationPermission(): boolean {
  if (!('Notification' in window)) return false
  return Notification.permission === 'granted'
}

/* ────────────────────────────────────────────────── */
/*  Show a notification                              */
/* ────────────────────────────────────────────────── */

export function showNotification(
  title: string,
  body: string,
  options?: { url?: string },
): void {
  if (!hasNotificationPermission()) return
  try {
    const n = new Notification(title, {
      body,
      icon: '/varda-192.png',
      badge: '/varda-192.png',
      tag: title, // prevents duplicate notifications with same title
    })
    if (options?.url) {
      n.onclick = () => {
        window.focus()
        window.location.hash = options.url!
        n.close()
      }
    }
  } catch {
    // Service-worker-only environments may throw; silently ignore
  }
}

/* ────────────────────────────────────────────────── */
/*  Dedup tracker (localStorage)                     */
/* ────────────────────────────────────────────────── */

const STORAGE_KEY = 'gh-notif-shown'

function getShownIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed: string[] = JSON.parse(raw)
    return new Set(parsed)
  } catch {
    return new Set()
  }
}

function markShown(id: string): void {
  const shown = getShownIds()
  shown.add(id)
  // Keep only the most recent 200 entries to avoid unbounded growth
  const arr = [...shown].slice(-200)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr))
}

function wasShown(id: string): boolean {
  return getShownIds().has(id)
}

/* ────────────────────────────────────────────────── */
/*  Checker logic                                    */
/* ────────────────────────────────────────────────── */

interface CheckerDeps {
  settings: AppSettings
  jobs: Array<{ id: string; status: string; date: string; customerName: string; jobType: string }>
  quotes: Array<{ id: string; status: string; createdAt: string; customerName: string; grandTotal: number }>
  invoices: Array<{ id: string; status: string; dueDate: string; jobId: string; grandTotal: number }>
  events: Array<{ id: string; date: string; customerName: string; jobType: string; slot: string }>
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysBetween(a: string, b: string): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

export function runNotificationCheck(deps: CheckerDeps): void {
  if (!hasNotificationPermission()) return
  const { settings, jobs, quotes, invoices, events } = deps
  const n = settings.notifications
  const today = todayStr()

  // 1. Schedule alerts — jobs scheduled for today
  if (n.scheduleAlerts) {
    const todaysEvents = events.filter(e => e.date === today)
    if (todaysEvents.length > 0) {
      const id = `schedule-${today}`
      if (!wasShown(id)) {
        markShown(id)
        const summary = todaysEvents.length === 1
          ? `${todaysEvents[0].customerName} — ${todaysEvents[0].jobType}`
          : `${todaysEvents.length} jobs scheduled`
        showNotification('Today\'s Schedule', summary, { url: '/calendar' })
      }
    }
  }

  // 2. Job reminders — upcoming jobs scheduled for tomorrow
  if (n.jobReminders) {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
    const tomorrowJobs = events.filter(e => e.date === tomorrowStr)
    if (tomorrowJobs.length > 0) {
      const id = `reminder-${tomorrowStr}`
      if (!wasShown(id)) {
        markShown(id)
        const summary = tomorrowJobs.length === 1
          ? `${tomorrowJobs[0].customerName} — ${tomorrowJobs[0].jobType}`
          : `${tomorrowJobs.length} jobs tomorrow`
        showNotification('Tomorrow\'s Jobs', summary, { url: '/calendar' })
      }
    }
  }

  // 3. Quote follow-up — quotes sent > 3 days ago still in "Sent" status
  if (n.quoteFollowUp) {
    const staleQuotes = quotes.filter(q =>
      q.status === 'Sent' && daysBetween(q.createdAt, today) >= 3,
    )
    for (const q of staleQuotes) {
      const id = `followup-${q.id}`
      if (!wasShown(id)) {
        markShown(id)
        showNotification(
          'Quote Follow-up',
          `${q.customerName} — sent ${daysBetween(q.createdAt, today)} days ago (£${q.grandTotal.toLocaleString()})`,
          { url: `/quote?quoteId=${q.id}` },
        )
      }
    }
  }

  // 4. Overdue invoices
  if (n.invoiceOverdue) {
    const overdueInvoices = invoices.filter(i =>
      (i.status === 'Sent' || i.status === 'Viewed') && i.dueDate && i.dueDate < today,
    )
    for (const inv of overdueInvoices) {
      const id = `overdue-${inv.id}`
      if (!wasShown(id)) {
        markShown(id)
        showNotification(
          'Invoice Overdue',
          `£${inv.grandTotal.toLocaleString()} past due date`,
          { url: '/jobs' },
        )
      }
    }
  }
}

/* ────────────────────────────────────────────────── */
/*  Appointment Reminders                            */
/* ────────────────────────────────────────────────── */

export interface Reminder {
  eventId: string
  customerId: string
  customerName: string
  customerEmail: string
  jobType: string
  date: string
  slot: string
}

const REMINDER_SENT_KEY = 'gh-reminders-sent'

function getSentReminderIds(): Set<string> {
  try {
    const raw = localStorage.getItem(REMINDER_SENT_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

export function markReminderSent(eventId: string): void {
  const sent = getSentReminderIds()
  sent.add(eventId)
  const arr = [...sent].slice(-200)
  localStorage.setItem(REMINDER_SENT_KEY, JSON.stringify(arr))
}

export function wasReminderSent(eventId: string): boolean {
  return getSentReminderIds().has(eventId)
}

/**
 * Returns events happening tomorrow that haven't had a reminder sent.
 * Only includes events where the customer has an email address.
 */
export function getUpcomingReminders(events: ScheduleEvent[], customers: Customer[]): Reminder[] {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`

  const sentIds = getSentReminderIds()
  const customerMap = new Map(customers.map(c => [c.id, c]))

  return events
    .filter(e => e.date === tomorrowStr && !sentIds.has(e.id))
    .map(e => {
      const customer = e.customerId ? customerMap.get(e.customerId) : undefined
      return {
        eventId: e.id,
        customerId: e.customerId || '',
        customerName: e.customerName,
        customerEmail: customer?.email || '',
        jobType: e.jobType,
        date: e.date,
        slot: e.slot,
      }
    })
    .filter(r => r.customerEmail) // only include those with an email
}

/* ────────────────────────────────────────────────── */
/*  React hook — runs every 5 minutes                */
/* ────────────────────────────────────────────────── */

export function useNotificationChecker(deps: CheckerDeps): void {
  const depsRef = useRef(deps)
  depsRef.current = deps

  useEffect(() => {
    // Initial check after a short delay (let data load)
    const initial = setTimeout(() => runNotificationCheck(depsRef.current), 5000)

    // Recurring check every 5 minutes
    const interval = setInterval(() => {
      runNotificationCheck(depsRef.current)
    }, 5 * 60 * 1000)

    return () => {
      clearTimeout(initial)
      clearInterval(interval)
    }
  }, [])
}
