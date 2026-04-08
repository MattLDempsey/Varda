import { useMemo, useCallback } from 'react'
import type { Quote, Job, Invoice, AppSettings } from '../data/DataContext'

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

  items.sort((a, b) => a.urgency - b.urgency)
  return items
}

/* ── Hook ── */

export function useFollowUps(
  quotes: Quote[],
  jobs: Job[],
  invoices: Invoice[],
  settings: AppSettings,
) {
  const allFollowUps = useMemo(
    () => computeFollowUps(quotes, jobs, invoices, settings),
    [quotes, jobs, invoices, settings],
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
