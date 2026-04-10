import { useMemo, useCallback } from 'react'
import type { Quote, Job, Invoice, AppSettings, ScheduleEvent, Customer } from '../data/DataContext'
import { getUpcomingReminders, type Reminder, markReminderSent } from '../lib/notifications'

/* ── Types ── */

export type FollowUpPriority = 'high' | 'medium' | 'low'

export interface FollowUp {
  id: string
  priority: FollowUpPriority
  message: string
  route: string
  /** numeric sort key — lower = more urgent */
  urgency: number
}

/* ── Helpers ── */

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysBetween(a: string, b: string): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

const DISMISSED_KEY = 'varda-dismissed-followups'

function getDismissedIds(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return []
}

function dismissFollowUp(id: string) {
  const current = getDismissedIds()
  if (!current.includes(id)) {
    current.push(id)
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(current))
  }
}

function undismissFollowUp(id: string) {
  const current = getDismissedIds().filter(x => x !== id)
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(current))
}

/* ── Core computation ── */

export function computeFollowUps(
  quotes: Quote[],
  jobs: Job[],
  invoices: Invoice[],
  settings: AppSettings,
  events?: ScheduleEvent[],
  customers?: Customer[],
): FollowUp[] {
  const today = todayStr()
  const paymentTerms = settings.quoteConfig.paymentTerms || 14
  const items: FollowUp[] = []

  // 1. Invoice seriously overdue (payment terms + 7 days)
  invoices
    .filter(i => i.status === 'Sent' && i.dueDate)
    .forEach(i => {
      const overdueDays = daysBetween(i.dueDate, today)
      if (overdueDays > 7) {
        items.push({
          id: `followup-inv-serious-${i.id}`,
          priority: 'high',
          message: `Invoice ${i.ref} is seriously overdue`,
          route: `/inv/${i.id}`,
          urgency: 0,
        })
      } else if (overdueDays > 0) {
        items.push({
          id: `followup-inv-overdue-${i.id}`,
          priority: 'high',
          message: `Invoice ${i.ref} is overdue — chase payment`,
          route: `/inv/${i.id}`,
          urgency: 1,
        })
      }
    })

  // 2. Invoice created but not yet due — check against payment terms from sentAt
  invoices
    .filter(i => (i.status === 'Sent') && i.sentAt && i.dueDate)
    .forEach(i => {
      // Already handled above if overdue
      const overdueDays = daysBetween(i.dueDate, today)
      if (overdueDays <= 0) return // not overdue yet, skip

      // the overdue cases are already added above
    })

  // 3. Quotes going cold (> 7 days, no response)
  quotes
    .filter(q => (q.status === 'Sent' || q.status === 'Viewed') && q.sentAt)
    .forEach(q => {
      const days = daysBetween(q.sentAt!, today)
      if (days > 7) {
        items.push({
          id: `followup-quote-cold-${q.id}`,
          priority: 'high',
          message: `Quote ${q.ref} is going cold — follow up urgently`,
          route: `/quote?quoteId=${q.id}`,
          urgency: 2,
        })
      } else if (days > 3) {
        items.push({
          id: `followup-quote-${q.id}`,
          priority: 'medium',
          message: `Follow up on quote ${q.ref} for ${q.customerName}`,
          route: `/quote?quoteId=${q.id}`,
          urgency: 3,
        })
      }
    })

  // 4. Job accepted but not scheduled > 5 days
  jobs
    .filter(j => j.status === 'Accepted')
    .forEach(j => {
      // Use createdAt as a proxy — when status changed to Accepted isn't tracked separately
      const days = daysBetween(j.createdAt, today)
      if (days > 5) {
        items.push({
          id: `followup-schedule-${j.id}`,
          priority: 'medium',
          message: `Schedule job for ${j.customerName}`,
          route: '/calendar',
          urgency: 4,
        })
      }
    })

  // 5. Jobs complete, need invoicing
  jobs
    .filter(j => j.status === 'Complete' && !j.invoiceId)
    .forEach(j => {
      items.push({
        id: `followup-invoice-${j.id}`,
        priority: 'low',
        message: `${j.customerName} job complete — create invoice`,
        route: '/jobs',
        urgency: 5,
      })
    })

  // 6. Recurring jobs due within 14 days
  jobs
    .filter(j => j.isRecurring && j.nextRecurrenceDate && (j.status === 'Complete' || j.status === 'Paid'))
    .forEach(j => {
      const daysUntil = daysBetween(today, j.nextRecurrenceDate!)
      if (daysUntil <= 14 && daysUntil >= -7) {
        items.push({
          id: `followup-recurring-${j.id}`,
          priority: daysUntil <= 0 ? 'high' : 'medium',
          message: `Recurring job for ${j.customerName}: ${j.jobType} due on ${j.nextRecurrenceDate}`,
          route: '/jobs',
          urgency: daysUntil <= 0 ? 1.5 : 3.5,
        })
      }
    })

  // 7. Unpaid invoices on jobs approaching their start date — deposits,
  //    progress payments, custom invoices that need collecting before
  //    the tradesperson turns up. 5-day warning window.
  jobs
    .filter(j => (j.status === 'Accepted' || j.status === 'Scheduled') && j.date)
    .forEach(j => {
      const jobInvs = invoices.filter(i => i.jobId === j.id && i.status !== 'Paid')
      if (jobInvs.length === 0) return
      const daysUntilStart = daysBetween(today, j.date)
      if (daysUntilStart > 5) return
      const inv = jobInvs[0]
      const typeLabel = inv.type === 'Deposit' ? 'Deposit'
        : inv.type === 'Progress' ? 'Progress payment'
        : `Invoice ${inv.ref}`
      if (daysUntilStart <= 0) {
        items.push({
          id: `followup-prepay-overdue-${inv.id}`,
          priority: 'high',
          message: `${typeLabel} for ${j.customerName} NOT PAID — job starts today`,
          route: '/jobs',
          urgency: 0,
        })
      } else {
        items.push({
          id: `followup-prepay-${inv.id}`,
          priority: daysUntilStart <= 3 ? 'high' : 'medium',
          message: `Chase ${typeLabel.toLowerCase()} for ${j.customerName} — job starts in ${daysUntilStart} day${daysUntilStart === 1 ? '' : 's'}`,
          route: '/jobs',
          urgency: daysUntilStart <= 3 ? 0.5 : 2,
        })
      }
    })

  // 8. Stale leads — Lead for > 7 days with no linked quote created
  jobs
    .filter(j => j.status === 'Lead' && !j.quoteId)
    .forEach(j => {
      const days = daysBetween(j.createdAt, today)
      if (days > 7) {
        items.push({
          id: `followup-stale-lead-${j.id}`,
          priority: days > 14 ? 'high' : 'medium',
          message: `Lead for ${j.customerName} is ${days} days old — create a quote or archive it`,
          route: '/jobs',
          urgency: days > 14 ? 1.5 : 4.5,
        })
      }
    })

  // 8. Expired quotes — validity period has passed
  const validityDays = settings.quoteConfig.validityDays || 30
  quotes
    .filter(q => (q.status === 'Sent' || q.status === 'Viewed') && q.sentAt)
    .forEach(q => {
      const daysSinceSent = daysBetween(q.sentAt!, today)
      if (daysSinceSent > validityDays) {
        items.push({
          id: `followup-quote-expired-${q.id}`,
          priority: 'high',
          message: `Quote ${q.ref} for ${q.customerName} has expired — follow up or extend`,
          route: `/quote?quoteId=${q.id}`,
          urgency: 1.5,
        })
      }
    })

  // 9. Overrunning jobs — In Progress with actualHours > estimatedHours
  jobs
    .filter(j => j.status === 'In Progress' && j.actualHours != null && j.estimatedHours > 0)
    .forEach(j => {
      if (j.actualHours! > j.estimatedHours * 1.2) {
        items.push({
          id: `followup-overrun-${j.id}`,
          priority: 'medium',
          message: `${j.customerName} job is overrunning — ${j.actualHours}h actual vs ${j.estimatedHours}h estimated`,
          route: '/jobs',
          urgency: 3.5,
        })
      }
    })

  // 10. Stale Scheduled — job date has passed but still in Scheduled
  jobs
    .filter(j => j.status === 'Scheduled' && j.date < today)
    .forEach(j => {
      const days = daysBetween(j.date, today)
      items.push({
        id: `followup-stale-scheduled-${j.id}`,
        priority: days > 3 ? 'high' : 'medium',
        message: `${j.customerName} was scheduled ${days} day${days === 1 ? '' : 's'} ago — update its status`,
        route: '/jobs',
        urgency: days > 3 ? 0.5 : 2.5,
      })
    })

  // 11. Schedule changed — events with unconfirmed changes need resending
  if (events) {
    // Group by job — only one action item per affected job
    const jobsWithUnsent = new Set<string>()
    events.forEach(e => {
      if (!e.category && e.jobId && e.confirmationSentAt && e.confirmedDate != null) {
        // Check if the schedule drifted from what the customer was told
        const drifted = e.confirmedDate !== e.date
          || (e.confirmedStartTime || null) !== (e.startTime || null)
          || (e.confirmedEndTime || null) !== (e.endTime || null)
        if (drifted) jobsWithUnsent.add(e.jobId)
      }
      // Brand-new unsent events
      if (!e.category && e.jobId && !e.confirmationSentAt) {
        jobsWithUnsent.add(e.jobId)
      }
    })
    jobsWithUnsent.forEach(jobId => {
      const job = jobs.find(j => j.id === jobId)
      if (!job) return
      items.push({
        id: `followup-schedule-unsent-${jobId}`,
        priority: 'medium',
        message: `Schedule for ${job.customerName} has changed — send updated confirmation`,
        route: '/jobs',
        urgency: 3,
      })
    })
  }

  // 12. Appointment reminders — events tomorrow that haven't been reminded
  if (events && customers) {
    const reminders = getUpcomingReminders(events, customers)
    const slotLabels: Record<string, string> = { morning: 'Morning', afternoon: 'Afternoon', full: 'Full Day' }
    reminders.forEach(r => {
      items.push({
        id: `followup-reminder-${r.eventId}`,
        priority: 'medium',
        message: `Send appointment reminder to ${r.customerName} — ${r.jobType} tomorrow at ${slotLabels[r.slot] || r.slot}`,
        route: '/calendar',
        urgency: 2.5,
      })
    })
  }

  items.sort((a, b) => a.urgency - b.urgency)
  return items
}

/** Get pending appointment reminders for batch sending */
export function getPendingReminders(events: ScheduleEvent[], customers: Customer[]): Reminder[] {
  return getUpcomingReminders(events, customers)
}

/** Mark a reminder as sent */
export { markReminderSent }

/* ── Hook ── */

export function useFollowUps(
  quotes: Quote[],
  jobs: Job[],
  invoices: Invoice[],
  settings: AppSettings,
  events?: ScheduleEvent[],
  customers?: Customer[],
) {
  const allFollowUps = useMemo(
    () => computeFollowUps(quotes, jobs, invoices, settings, events, customers),
    [quotes, jobs, invoices, settings, events, customers],
  )

  const dismissed = useMemo(() => getDismissedIds(), [allFollowUps]) // re-read on data change

  const activeFollowUps = useMemo(
    () => allFollowUps.filter(f => !dismissed.includes(f.id)),
    [allFollowUps, dismissed],
  )

  const dismiss = useCallback((id: string) => {
    dismissFollowUp(id)
  }, [])

  const undismiss = useCallback((id: string) => {
    undismissFollowUp(id)
  }, [])

  return {
    allFollowUps,
    activeFollowUps,
    activeCount: activeFollowUps.length,
    dismiss,
    undismiss,
  }
}

/* ── Priority helpers for styling ── */

export function priorityColor(p: FollowUpPriority): string {
  switch (p) {
    case 'high': return '#D46A6A'
    case 'medium': return '#C6A86A'
    case 'low': return '#5B9BD5'
  }
}

export function priorityIcon(p: FollowUpPriority): string {
  switch (p) {
    case 'high': return 'urgent'
    case 'medium': return 'warning'
    case 'low': return 'info'
  }
}
