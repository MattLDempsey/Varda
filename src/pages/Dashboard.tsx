import { useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Briefcase, PoundSterling, Clock, TrendingUp,
  CalendarCheck, CheckCircle, AlertTriangle, ChevronRight,
  Calendar, Bell, X,
} from 'lucide-react'
import { useTheme } from '../theme/ThemeContext'
import { useData } from '../data/DataContext'
import { useFollowUps, priorityColor } from '../components/FollowUpManager'
import LoadingSpinner from '../components/LoadingSpinner'
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
  const { quotes, jobs, events, invoices, settings, isDataLoading } = useData()
  const today = todayStr()

  // Follow-up system
  const { activeFollowUps, dismiss: dismissFollowUp } = useFollowUps(quotes, jobs, invoices, settings)
  const [localDismissed, setLocalDismissed] = useState<string[]>([])
  const handleDismiss = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    dismissFollowUp(id)
    setLocalDismissed(prev => [...prev, id])
  }, [dismissFollowUp])
  const visibleFollowUps = activeFollowUps.filter(f => !localDismissed.includes(f.id))

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
        const order = { morning: 0, afternoon: 1, full: 2 }
        return (order[a.slot] ?? 2) - (order[b.slot] ?? 2)
      }),
    [events, today],
  )

  /* ── Action items now powered by FollowUpManager ── */

  /* ── Recent quotes (most recent 5) ── */
  const recentQuotes = useMemo(() =>
    [...quotes]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map(q => ({
        id: q.id,
        customer: q.customerName,
        jobType: q.jobTypeName,
        amount: fmtCurrency(q.grandTotal),
        date: fmtDate(q.createdAt),
        status: q.status,
      })),
    [quotes],
  )

  /* ── Pipeline overview ── */
  const pipeline = useMemo(() => {
    const stages: { label: string; status: string; color: string }[] = [
      { label: 'Lead', status: 'Lead', color: '#8A8F96' },
      { label: 'Quoted', status: 'Quoted', color: '#9B7ED8' },
      { label: 'Accepted', status: 'Accepted', color: '#6ABF8A' },
      { label: 'Scheduled', status: 'Scheduled', color: '#5B9BD5' },
      { label: 'In Progress', status: 'In Progress', color: '#C6A86A' },
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
    page: { padding: '32px', maxWidth: 1200, margin: '0 auto' },
    heading: { fontSize: 28, fontWeight: 600, color: C.white, marginBottom: 8 },
    subheading: { fontSize: 14, color: C.silver, marginBottom: 28 },
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16, marginBottom: 28 },
    statCard: { background: C.charcoalLight, borderRadius: 12, padding: '20px 20px 16px', borderLeft: `4px solid ${C.gold}`, display: 'flex', flexDirection: 'column', gap: 6 },
    statValue: { fontSize: 28, fontWeight: 700, color: C.white, lineHeight: 1 },
    statLabel: { fontSize: 12, color: C.silver, display: 'flex', alignItems: 'center', gap: 6 },
    columns: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 28 },
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

  if (isDataLoading) {
    return (
      <div style={s.page}>
        <h1 style={s.heading}>Dashboard</h1>
        <p style={s.subheading}>Your business at a glance.</p>
        <LoadingSpinner message="Loading dashboard..." />
      </div>
    )
  }

  return (
    <div style={s.page}>
      <h1 style={s.heading}>Dashboard</h1>
      <p style={s.subheading}>Your business at a glance.</p>

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
            <span style={s.panelLink} onClick={() => navigate('/schedule')}>
              View Calendar <ChevronRight size={14} />
            </span>
          </div>
          {todaysEvents.length === 0 && (
            <div style={s.empty}>Nothing scheduled today.</div>
          )}
          {todaysEvents.map((ev) => (
            <div
              key={ev.id}
              style={s.listItem}
              onClick={() => navigate('/schedule')}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.steel + '33')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={s.listLeft}>
                <span style={s.listName}>{ev.customerName}</span>
                <span style={s.listMeta}>{ev.jobType} &middot; {slotLabel(ev.slot)}</span>
              </div>
              <span style={{ ...s.badge, color: statusColor[ev.status], background: statusColor[ev.status] + '1A' }}>
                {ev.status}
              </span>
            </div>
          ))}
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
                onClick={() => navigate(item.route)}
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
        {/* Recent Quotes */}
        <div style={s.panel}>
          <div style={s.panelHeader}>
            <h2 style={s.panelTitle}>Recent Quotes</h2>
            <span style={s.panelLink} onClick={() => navigate('/quotes')}>
              View All <ChevronRight size={14} />
            </span>
          </div>
          {recentQuotes.length === 0 && (
            <div style={s.empty}>No quotes yet. Create one from Quick Quote.</div>
          )}
          {recentQuotes.map((q) => (
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
              <div style={s.listRight}>
                <span style={s.amount}>{q.amount}</span>
                <span style={{ ...s.badge, color: statusColor[q.status], background: statusColor[q.status] + '1A' }}>{q.status}</span>
              </div>
            </div>
          ))}
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
