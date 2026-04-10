import { useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Briefcase, PoundSterling, Clock, TrendingUp,
  CalendarCheck, CheckCircle, AlertTriangle, ChevronRight,
  Calendar, Bell, X, Square, CheckSquare,
  PenLine, UserPlus, ClipboardList, Play,
} from 'lucide-react'
import { useTheme } from '../theme/ThemeContext'
import { useData } from '../data/DataContext'
import { useIsMobile } from '../hooks/useIsMobile'
import { useFollowUps, priorityColor, getPendingReminders, markReminderSent } from '../components/FollowUpManager'
import { buildBookingConfirmationEmail } from '../lib/email-templates'
import { sendEmail, buildFromName } from '../lib/send-email'
import { useAuth } from '../auth/AuthContext'
import { SkeletonDashboard } from '../components/Skeleton'
import type { CSSProperties } from 'react'

/* ── helpers ── */

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]}`
}

function fmtCurrency(n: number): string {
  return '\u00A3' + n.toLocaleString('en-GB', { maximumFractionDigits: 0 })
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysBetween(a: string, b: string): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

function slotLabel(slot: string): string {
  if (slot === 'morning') return 'Morning'
  if (slot === 'afternoon') return 'Afternoon'
  return 'Full Day'
}

/* ── status colours ── */

const statusColor: Record<string, string> = {
  Sent: '#5B9BD5',
  Viewed: '#C6A86A',
  Accepted: '#6ABF8A',
  Expired: '#D46A6A',
  Draft: '#8A8F96',
  Declined: '#D46A6A',
  Scheduled: '#5B9BD5',
  'In Progress': '#C6A86A',
  'On Hold': '#D46A6A',
  Complete: '#6ABF8A',
  Quoted: '#9B7ED8',
  Lead: '#8A8F96',
  Invoiced: '#5B9BD5',
  Paid: '#6ABF8A',
  Overdue: '#D46A6A',
}


export default function Dashboard() {
  const navigate = useNavigate()
  const { C } = useTheme()
  const { quotes, jobs, events, invoices, settings, customers, addComm, updateJob, moveJob, isDataLoading } = useData()
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const today = todayStr()

  // Follow-up system
  const { activeFollowUps, dismiss: dismissFollowUp } = useFollowUps(quotes, jobs, invoices, settings, events, customers)
  const [localDismissed, setLocalDismissed] = useState<string[]>([])
  const handleDismiss = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    dismissFollowUp(id)
    setLocalDismissed(prev => [...prev, id])
  }, [dismissFollowUp])
  const visibleFollowUps = activeFollowUps.filter(f => !localDismissed.includes(f.id))

  // Appointment reminder helpers
  const pendingReminders = useMemo(() => getPendingReminders(events, customers), [events, customers])
  const [sendingReminders, setSendingReminders] = useState(false)

  const sendOneReminder = useCallback(async (eventId: string) => {
    const reminder = pendingReminders.find(r => r.eventId === eventId)
    if (!reminder) return
    const biz = settings.business
    const slotLabels: Record<string, string> = { morning: 'Morning (AM)', afternoon: 'Afternoon (PM)', full: 'Full Day' }
    const emailData = buildBookingConfirmationEmail({
      customerName: reminder.customerName,
      businessName: biz.businessName,
      jobTitle: reminder.jobType,
      date: reminder.date,
      time: slotLabels[reminder.slot] || reminder.slot,
      businessPhone: biz.phone,
      businessEmail: biz.email,
    })
    await sendEmail({
      to: reminder.customerEmail,
      subject: `Reminder: ${emailData.subject}`,
      htmlBody: emailData.html,
      textBody: emailData.text,
      replyTo: biz.email,
      fromName: buildFromName(biz),
      orgId: user?.orgId || '',
      customerId: reminder.customerId,
      templateName: 'Appointment Reminder',
    })
    markReminderSent(eventId)
    addComm({
      customerId: reminder.customerId,
      customerName: reminder.customerName,
      templateName: 'Appointment Reminder',
      channel: 'email',
      status: 'Sent',
      date: new Date().toISOString(),
      body: `Reminder for ${reminder.jobType} on ${reminder.date}`,
    })
    dismissFollowUp(`followup-reminder-${eventId}`)
    setLocalDismissed(prev => [...prev, `followup-reminder-${eventId}`])
  }, [pendingReminders, settings, user, addComm, dismissFollowUp])

  const handleRemindAll = useCallback(async () => {
    setSendingReminders(true)
    for (const r of pendingReminders) {
      await sendOneReminder(r.eventId)
    }
    setSendingReminders(false)
  }, [pendingReminders, sendOneReminder])

  /* ── KPI stats (6 cards) ── */
  const stats = useMemo(() => {
    const now = new Date()

    // Quotes created in last 7 days
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const quotesThisWeek = quotes.filter(q => new Date(q.createdAt) >= sevenDaysAgo).length

    // Active jobs: Scheduled or In Progress
    const activeJobs = jobs.filter(j => j.status === 'In Progress' || j.status === 'Scheduled').length

    // Revenue MTD: sum value for Complete or Invoiced or Paid jobs this month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const revenueMTD = jobs
      .filter(j => (j.status === 'Complete' || j.status === 'Invoiced' || j.status === 'Paid') && new Date(j.date) >= monthStart)
      .reduce((sum, j) => sum + j.value, 0)

    // Outstanding invoices: sum value for Invoiced jobs
    const outstanding = jobs
      .filter(j => j.status === 'Invoiced')
      .reduce((sum, j) => sum + j.value, 0)

    // Win rate: accepted quotes / total non-draft quotes
    const nonDraft = quotes.filter(q => q.status !== 'Draft')
    const accepted = nonDraft.filter(q => q.status === 'Accepted')
    const winRate = nonDraft.length > 0 ? Math.round((accepted.length / nonDraft.length) * 100) : 0

    // Jobs today
    const jobsToday = events.filter(e => e.date === today).length

    return [
      { label: 'Quotes This Week', value: String(quotesThisWeek), icon: <FileText size={20} /> },
      { label: 'Active Jobs', value: String(activeJobs), icon: <Briefcase size={20} /> },
      { label: 'Revenue MTD', value: fmtCurrency(revenueMTD), icon: <PoundSterling size={20} /> },
      { label: 'Outstanding', value: fmtCurrency(outstanding), icon: <Clock size={20} /> },
      { label: 'Win Rate', value: `${winRate}%`, icon: <TrendingUp size={20} /> },
      { label: 'Jobs Today', value: String(jobsToday), icon: <CalendarCheck size={20} /> },
    ]
  }, [quotes, jobs, events, today])

  /* ── Today's schedule ── */
  const todaysEvents = useMemo(() =>
    events
      .filter(e => e.date === today)
      .sort((a, b) => {
        // Quick fit-ins come first (they're typically before the morning block),
        // then morning, afternoon, full.
        const order: Record<string, number> = { quick: -1, morning: 0, afternoon: 1, full: 2 }
        return (order[a.slot] ?? 2) - (order[b.slot] ?? 2)
      }),
    [events, today],
  )

  /* ── Action items now powered by FollowUpManager ── */

  /* ── Recent quotes (most recent 5) with linked job status for context ── */
  const recentQuotes = useMemo(() =>
    [...quotes]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map(q => {
        // Find the linked job so we can show pipeline context
        const linkedJob = jobs.find(j => j.quoteId === q.id)
        return {
          id: q.id,
          customer: q.customerName,
          jobType: q.jobTypeName,
          amount: fmtCurrency(q.grandTotal),
          date: fmtDate(q.createdAt),
          status: q.status,
          jobStatus: linkedJob?.status ?? null,
          jobId: linkedJob?.id ?? null,
        }
      }),
    [quotes, jobs],
  )

  /* ── Pipeline overview — includes Complete + Invoiced so the user sees
       the commercial state of the business, not just outstanding work. Paid
       is excluded since those are done-and-dusted. ── */
  const pipeline = useMemo(() => {
    const stages: { label: string; status: string; color: string }[] = [
      { label: 'Lead',        status: 'Lead',        color: '#8A8F96' },
      { label: 'Quoted',      status: 'Quoted',      color: '#9B7ED8' },
      { label: 'Accepted',    status: 'Accepted',    color: '#6ABF8A' },
      { label: 'Scheduled',   status: 'Scheduled',   color: '#5B9BD5' },
      { label: 'In Progress', status: 'In Progress', color: '#C6A86A' },
      { label: 'Complete',    status: 'Complete',     color: '#6ABF8A' },
      { label: 'Invoiced',    status: 'Invoiced',     color: '#5BBFD4' },
    ]

    const counts = stages.map(st => ({
      ...st,
      count: jobs.filter(j => j.status === st.status).length,
      value: jobs.filter(j => j.status === st.status).reduce((s, j) => s + j.value, 0),
    }))

    const totalCount = counts.reduce((s, c) => s + c.count, 0)
    const totalValue = counts.reduce((s, c) => s + c.value, 0)

    return { stages: counts, totalCount, totalValue }
  }, [jobs])

  /* ── styles ── */
  const s: Record<string, CSSProperties> = {
    page: { padding: 'clamp(16px, 4vw, 32px)', maxWidth: 1200, margin: '0 auto' },
    heading: { fontSize: 'clamp(22px, 5vw, 28px)' as any, fontWeight: 600, color: C.white, marginBottom: 8 },
    subheading: { fontSize: 14, color: C.silver, marginBottom: 28 },
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 28 },
    statCard: { background: C.charcoalLight, borderRadius: 12, padding: '20px 20px 16px', borderLeft: `4px solid ${C.gold}`, display: 'flex', flexDirection: 'column', gap: 6 },
    statValue: { fontSize: 28, fontWeight: 700, color: C.white, lineHeight: 1 },
    statLabel: { fontSize: 12, color: C.silver, display: 'flex', alignItems: 'center', gap: 6 },
    columns: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 24, marginBottom: 28 },
    panel: { background: C.charcoalLight, borderRadius: 12, padding: '20px 24px' },
    panelHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    panelTitle: { fontSize: 16, fontWeight: 600, color: C.white },
    panelLink: { fontSize: 12, color: C.gold, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' },
    listItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 12px', borderRadius: 8, cursor: 'pointer', minHeight: 44, transition: 'background .15s' },
    listLeft: { display: 'flex', flexDirection: 'column', gap: 2 },
    listName: { fontSize: 14, fontWeight: 500, color: C.white },
    listMeta: { fontSize: 12, color: C.silver },
    listRight: { display: 'flex', alignItems: 'center', gap: 12 },
    badge: { fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
    amount: { fontSize: 14, fontWeight: 600, color: C.gold },
    empty: { textAlign: 'center' as const, padding: '32px 16px', color: C.steel, fontSize: 13 },
  }

  /* ── Onboarding checklist ── */
  const [onboardingDismissed, setOnboardingDismissed] = useState(() =>
    localStorage.getItem('varda-onboarding-dismissed') === 'true',
  )

  const onboardingItems = useMemo(() => {
    const hasPhone = settings.business.phone && settings.business.phone !== '07XXX XXX XXX'
    const hasCustomer = customers.length > 0
    const hasQuote = quotes.length > 0
    const hasEvent = events.length > 0

    return [
      { label: 'Create your account', done: true, route: '/' },
      { label: 'Set up your business details', done: !!hasPhone, route: '/settings' },
      { label: 'Add your first customer', done: hasCustomer, route: '/customers' },
      { label: 'Create your first quote', done: hasQuote, route: '/quote' },
      { label: 'Schedule a job', done: hasEvent, route: '/calendar' },
    ]
  }, [settings, customers, quotes, events])

  const onboardingComplete = onboardingItems.filter(i => i.done).length
  const allOnboardingDone = onboardingComplete === onboardingItems.length
  const showOnboarding = jobs.length < 3 && !onboardingDismissed

  const dismissOnboarding = useCallback(() => {
    setOnboardingDismissed(true)
    localStorage.setItem('varda-onboarding-dismissed', 'true')
  }, [])

  if (isDataLoading) {
    return (
      <div style={s.page}>
        <h1 style={s.heading}>Dashboard</h1>
        <p style={s.subheading}>Your business at a glance.</p>
        <SkeletonDashboard />
      </div>
    )
  }

  return (
    <div style={s.page}>
      <h1 style={s.heading}>Dashboard</h1>
      <p style={s.subheading}>Your business at a glance.</p>

      {/* ── Quick Actions (only when onboarding is not showing) ── */}
      {!showOnboarding && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          {([
            { label: 'Quick Quote', icon: <PenLine size={15} />, route: '/quote' },
            { label: 'Add Customer', icon: <UserPlus size={15} />, route: '/customers' },
            { label: 'View Jobs', icon: <ClipboardList size={15} />, route: '/jobs' },
            { label: 'Calendar', icon: <Calendar size={15} />, route: '/calendar' },
          ] as const).map(action => (
            <button
              key={action.label}
              onClick={() => navigate(action.route)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', borderRadius: 10,
                background: 'transparent',
                border: `1px solid ${C.steel}66`,
                color: C.silver, fontSize: 13, fontWeight: 500,
                cursor: 'pointer', transition: 'all .15s',
                minHeight: 38,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.color = C.gold }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.steel + '66'; e.currentTarget.style.color = C.silver }}
            >
              {action.icon} {action.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Onboarding Checklist ── */}
      {showOnboarding && (
        <div style={{
          background: C.charcoalLight,
          border: `2px solid ${C.gold}`,
          borderRadius: 14,
          padding: '24px 28px 20px',
          marginBottom: 28,
          boxShadow: '0 6px 24px rgba(0,0,0,.25)',
          position: 'relative',
        }}>
          <button
            onClick={dismissOnboarding}
            title="Dismiss"
            style={{
              position: 'absolute', top: 14, right: 14,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: C.steel, padding: 4, minWidth: 32, minHeight: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.silver)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.steel)}
          >
            <X size={16} />
          </button>

          {allOnboardingDone ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: C.white, marginBottom: 4 }}>
                You're all set!
              </div>
              <div style={{ fontSize: 13, color: C.silver, marginBottom: 16 }}>
                Your workspace is ready to go. Start quoting and managing jobs.
              </div>
              <button
                onClick={dismissOnboarding}
                style={{
                  background: C.gold, color: C.black, border: 'none', borderRadius: 8,
                  padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  minHeight: 44,
                }}
              >
                Dismiss
              </button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.white, marginBottom: 4 }}>
                Get started with Varda
              </div>
              <div style={{ fontSize: 13, color: C.silver, marginBottom: 16 }}>
                {onboardingComplete} of {onboardingItems.length} complete
              </div>

              {/* Progress bar */}
              <div style={{
                height: 6, borderRadius: 3, background: `${C.steel}33`,
                overflow: 'hidden', marginBottom: 18,
              }}>
                <div style={{
                  width: `${(onboardingComplete / onboardingItems.length) * 100}%`,
                  height: '100%', background: C.gold, borderRadius: 3,
                  transition: 'width .3s ease',
                }} />
              </div>

              {/* Checklist items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {onboardingItems.map((item) => (
                  <div
                    key={item.label}
                    onClick={() => !item.done && navigate(item.route)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 10px', borderRadius: 8,
                      cursor: item.done ? 'default' : 'pointer',
                      transition: 'background .15s',
                    }}
                    onMouseEnter={(e) => { if (!item.done) e.currentTarget.style.background = C.steel + '33' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    {item.done ? (
                      <CheckSquare size={18} color={C.gold} />
                    ) : (
                      <Square size={18} color={C.steel} />
                    )}
                    <span style={{
                      fontSize: 14, fontWeight: 500,
                      color: item.done ? C.steel : C.white,
                      textDecoration: item.done ? 'line-through' : 'none',
                    }}>
                      {item.label}
                    </span>
                    {!item.done && <ChevronRight size={14} color={C.steel} style={{ marginLeft: 'auto' }} />}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Row 1: KPI Cards ── */}
      <div style={s.statsRow}>
        {stats.map((st) => (
          <div key={st.label} style={s.statCard}>
            <span style={s.statValue}>{st.value}</span>
            <span style={s.statLabel}>{st.icon}{st.label}</span>
          </div>
        ))}
      </div>

      {/* ── Row 2: Today's Schedule + Action Items ── */}
      <div style={s.columns}>
        {/* Today's Schedule */}
        <div style={s.panel}>
          <div style={s.panelHeader}>
            <h2 style={s.panelTitle}>Today's Schedule</h2>
            <span style={s.panelLink} onClick={() => navigate('/calendar')}>
              View Calendar <ChevronRight size={14} />
            </span>
          </div>
          {todaysEvents.length === 0 && (
            <div style={s.empty}>Nothing scheduled today.</div>
          )}
          {todaysEvents.map((ev) => {
            // Internal events (travel/admin/etc) skip the Start button.
            const isInternal = !!ev.category
            const linkedJob = !isInternal && ev.jobId ? jobs.find(j => j.id === ev.jobId) : undefined
            const canStart = !!linkedJob && linkedJob.status === 'Scheduled'
            const inProgress = !!linkedJob && linkedJob.status === 'In Progress'
            const handleStart = (e: React.MouseEvent) => {
              e.stopPropagation()
              if (!linkedJob) return
              const ts = new Date().toISOString()
              updateJob(linkedJob.id, { startedAt: ts })
              moveJob(linkedJob.id, 'In Progress')
            }
            return (
              <div
                key={ev.id}
                style={s.listItem}
                onClick={() => navigate('/calendar')}
                onMouseEnter={(e) => (e.currentTarget.style.background = C.steel + '33')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={s.listLeft}>
                  <span style={s.listName}>{ev.customerName}</span>
                  <span style={s.listMeta}>
                    {isInternal ? 'Internal' : ev.jobType} &middot;{' '}
                    {ev.startTime || slotLabel(ev.slot)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {canStart && (
                    <button
                      onClick={handleStart}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '6px 10px', borderRadius: 8,
                        background: `${C.gold}15`, border: `1px solid ${C.gold}66`,
                        color: C.gold, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        minHeight: 30,
                      }}
                      title="Mark this job as started — moves it to In Progress"
                    >
                      <Play size={11} fill="currentColor" /> Start
                    </button>
                  )}
                  <span style={{
                    ...s.badge,
                    color: inProgress ? C.gold : statusColor[ev.status],
                    background: (inProgress ? C.gold : statusColor[ev.status]) + '1A',
                  }}>
                    {linkedJob?.status ?? ev.status}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Action Items — powered by FollowUpManager */}
        <div style={s.panel}>
          <div style={s.panelHeader}>
            <h2 style={{ ...s.panelTitle, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bell size={18} /> Action Items
              {visibleFollowUps.length > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 700, background: '#D46A6A', color: '#fff',
                  borderRadius: 10, padding: '2px 8px', minWidth: 20, textAlign: 'center',
                }}>{visibleFollowUps.length}</span>
              )}
            </h2>
            {pendingReminders.length > 0 && (
              <button
                onClick={handleRemindAll}
                disabled={sendingReminders}
                style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  cursor: sendingReminders ? 'not-allowed' : 'pointer',
                  background: `${C.gold}15`, border: `1px solid ${C.gold}44`, color: C.gold,
                  opacity: sendingReminders ? 0.5 : 1,
                }}
              >
                {sendingReminders ? 'Sending...' : `Remind All (${pendingReminders.length})`}
              </button>
            )}
          </div>
          {visibleFollowUps.length === 0 && (
            <div style={{ ...s.empty, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 8 }}>
              <CheckCircle size={32} color={C.green} />
              <span>All clear — nothing needs attention</span>
            </div>
          )}
          {visibleFollowUps.slice(0, 8).map((item) => {
            const color = priorityColor(item.priority)
            const icon = item.priority === 'high'
              ? <AlertTriangle size={16} />
              : item.priority === 'medium'
                ? <Clock size={16} />
                : <FileText size={16} />
            return (
              <div
                key={item.id}
                style={{
                  ...s.listItem,
                  borderLeft: `3px solid ${color}`,
                  marginBottom: 4,
                }}
                onClick={() => {
                  if (item.id.startsWith('followup-reminder-')) {
                    const eventId = item.id.replace('followup-reminder-', '')
                    sendOneReminder(eventId)
                  } else {
                    navigate(item.route)
                  }
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = C.steel + '33')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                  <span style={{ color, flexShrink: 0 }}>{icon}</span>
                  <span style={{ fontSize: 13, color: C.white }}>{item.message}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    onClick={(e) => handleDismiss(item.id, e)}
                    title="Dismiss"
                    style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: C.steel, padding: 4, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', borderRadius: 4, minWidth: 28, minHeight: 28,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = C.silver)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = C.steel)}
                  >
                    <X size={14} />
                  </button>
                  <ChevronRight size={16} color={C.steel} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Row 3: Recent Quotes + Pipeline Overview ── */}
      <div style={s.columns}>
        {/* Recent Quotes — clickable rows go to the linked job or the
            quote editor, depending on whether a job exists. Shows the job's
            pipeline status alongside the quote status for context. */}
        <div style={s.panel}>
          <div style={s.panelHeader}>
            <h2 style={s.panelTitle}>Recent Quotes</h2>
            <span style={s.panelLink} onClick={() => navigate('/jobs')}>
              View Jobs <ChevronRight size={14} />
            </span>
          </div>
          {recentQuotes.length === 0 && (
            <div style={s.empty}>No quotes yet. Create one from Quick Quote.</div>
          )}
          {recentQuotes.map((q) => {
            const jobStatusColors: Record<string, string> = {
              Lead: '#8A8F96', Quoted: '#9B7ED8', Accepted: '#6ABF8A', Scheduled: '#5B9BD5',
              'In Progress': '#C6A86A', Complete: '#6ABF8A', Invoiced: '#5BBFD4', Paid: '#4CAF50',
            }
            return (
              <div
                key={q.id}
                style={s.listItem}
                onClick={() => navigate(`/quote?quoteId=${q.id}`)}
                onMouseEnter={(e) => (e.currentTarget.style.background = C.steel + '33')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={s.listLeft}>
                  <span style={s.listName}>{q.customer}</span>
                  <span style={s.listMeta}>{q.jobType} &middot; {q.date}</span>
                </div>
                <div style={{ ...s.listRight, gap: 6 }}>
                  <span style={s.amount}>{q.amount}</span>
                  {q.jobStatus ? (
                    <span style={{
                      ...s.badge,
                      color: jobStatusColors[q.jobStatus] ?? C.steel,
                      background: (jobStatusColors[q.jobStatus] ?? C.steel) + '1A',
                    }}>
                      {q.jobStatus}
                    </span>
                  ) : (
                    <span style={{
                      ...s.badge,
                      color: statusColor[q.status],
                      background: statusColor[q.status] + '1A',
                    }}>
                      {q.status}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Pipeline Overview */}
        <div style={s.panel}>
          <div style={s.panelHeader}>
            <h2 style={s.panelTitle}>Pipeline Overview</h2>
            <span style={s.panelLink} onClick={() => navigate('/jobs')}>
              View Jobs <ChevronRight size={14} />
            </span>
          </div>

          {/* Pipeline value summary */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: C.silver }}>{pipeline.totalCount} jobs in pipeline</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.gold }}>{fmtCurrency(pipeline.totalValue)}</span>
          </div>

          {/* Horizontal bar */}
          {pipeline.totalCount > 0 && (
            <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', height: 24, marginBottom: 20 }}>
              {pipeline.stages
                .filter(st => st.count > 0)
                .map(st => (
                  <div
                    key={st.status}
                    style={{
                      flex: st.count,
                      background: st.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'opacity .15s',
                    }}
                    title={`${st.label}: ${st.count}`}
                    onClick={() => navigate('/jobs')}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                  >
                    {st.count > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{st.count}</span>
                    )}
                  </div>
                ))}
            </div>
          )}

          {/* Stage breakdown */}
          {pipeline.stages.map(st => (
            <div
              key={st.status}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'background .15s',
              }}
              onClick={() => navigate('/jobs')}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.steel + '33')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: st.color }} />
                <span style={{ fontSize: 13, color: C.white }}>{st.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.white }}>{st.count}</span>
                <span style={{ fontSize: 12, color: C.silver, minWidth: 60, textAlign: 'right' as const }}>
                  {fmtCurrency(st.value)}
                </span>
              </div>
            </div>
          ))}

          {pipeline.totalCount === 0 && (
            <div style={s.empty}>No active jobs in pipeline.</div>
          )}
        </div>
      </div>
    </div>
  )
}
