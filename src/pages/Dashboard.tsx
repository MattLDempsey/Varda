import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Briefcase, PoundSterling, Clock } from 'lucide-react'
import { useTheme } from '../theme/ThemeContext'
import { useData } from '../data/DataContext'
import LoadingSpinner from '../components/LoadingSpinner'
import type { CSSProperties } from 'react'

/* ── helpers ── */

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]}`
}

function fmtCurrency(n: number): string {
  return '£' + n.toLocaleString('en-GB', { maximumFractionDigits: 0 })
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
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { C } = useTheme()
  const { quotes, jobs, isDataLoading } = useData()

  /* ── computed stats ── */
  const stats = useMemo(() => {
    const now = new Date()

    // Quotes created in last 7 days
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const quotesThisWeek = quotes.filter(q => new Date(q.createdAt) >= sevenDaysAgo).length

    // Active jobs: Scheduled or In Progress
    const activeJobs = jobs.filter(j => j.status === 'In Progress' || j.status === 'Scheduled').length

    // Revenue MTD: sum value for Complete or Invoiced jobs this month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const revenueMTD = jobs
      .filter(j => (j.status === 'Complete' || j.status === 'Invoiced' || j.status === 'Paid') && new Date(j.date) >= monthStart)
      .reduce((sum, j) => sum + j.value, 0)

    // Outstanding invoices: sum value for Invoiced jobs
    const outstanding = jobs
      .filter(j => j.status === 'Invoiced')
      .reduce((sum, j) => sum + j.value, 0)

    return [
      { label: 'Quotes This Week', value: String(quotesThisWeek), icon: <FileText size={22} /> },
      { label: 'Active Jobs', value: String(activeJobs), icon: <Briefcase size={22} /> },
      { label: 'Revenue MTD', value: fmtCurrency(revenueMTD), icon: <PoundSterling size={22} /> },
      { label: 'Outstanding Invoices', value: fmtCurrency(outstanding), icon: <Clock size={22} /> },
    ]
  }, [quotes, jobs])

  /* ── recent quotes (most recent 5) ── */
  const recentQuotes = useMemo(() =>
    [...quotes]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map(q => ({
        customer: q.customerName,
        jobType: q.jobTypeName,
        amount: fmtCurrency(q.grandTotal),
        date: fmtDate(q.createdAt),
        status: q.status,
      })),
    [quotes],
  )

  /* ── upcoming jobs (Scheduled / In Progress, most recent 5) ── */
  const upcomingJobs = useMemo(() =>
    [...jobs]
      .filter(j => j.status === 'Scheduled' || j.status === 'In Progress')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5)
      .map(j => ({
        customer: j.customerName,
        jobType: j.jobType,
        date: fmtDate(j.date),
        status: j.status,
      })),
    [jobs],
  )

  const s: Record<string, CSSProperties> = {
    page: { padding: '32px', maxWidth: 1200, margin: '0 auto' },
    heading: { fontSize: 28, fontWeight: 600, color: C.white, marginBottom: 8 },
    subheading: { fontSize: 14, color: C.silver, marginBottom: 28 },
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 32 },
    statCard: { background: C.charcoalLight, borderRadius: 12, padding: '24px 24px 20px', borderLeft: `4px solid ${C.gold}`, display: 'flex', flexDirection: 'column', gap: 8 },
    statValue: { fontSize: 32, fontWeight: 700, color: C.white, lineHeight: 1 },
    statLabel: { fontSize: 13, color: C.silver, display: 'flex', alignItems: 'center', gap: 8 },
    columns: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 },
    panel: { background: C.charcoalLight, borderRadius: 12, padding: '20px 24px' },
    panelTitle: { fontSize: 16, fontWeight: 600, color: C.white, marginBottom: 16 },
    listItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 12px', borderRadius: 8, cursor: 'pointer', minHeight: 44, transition: 'background .15s' },
    listLeft: { display: 'flex', flexDirection: 'column', gap: 2 },
    listName: { fontSize: 14, fontWeight: 500, color: C.white },
    listMeta: { fontSize: 12, color: C.silver },
    listRight: { display: 'flex', alignItems: 'center', gap: 12 },
    badge: { fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
    amount: { fontSize: 14, fontWeight: 600, color: C.gold },
  }

  if (isDataLoading) {
    return (
      <div style={s.page}>
        <h1 style={s.heading}>Dashboard</h1>
        <p style={s.subheading}>Overview of your business at a glance.</p>
        <LoadingSpinner message="Loading dashboard..." />
      </div>
    )
  }

  return (
    <div style={s.page}>
      <h1 style={s.heading}>Dashboard</h1>
      <p style={s.subheading}>Overview of your business at a glance.</p>

      <div style={s.statsRow}>
        {stats.map((st) => (
          <div key={st.label} style={s.statCard}>
            <span style={s.statValue}>{st.value}</span>
            <span style={s.statLabel}>{st.icon}{st.label}</span>
          </div>
        ))}
      </div>

      <div style={s.columns}>
        <div style={s.panel}>
          <h2 style={s.panelTitle}>Recent Quotes</h2>
          {recentQuotes.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: C.steel, fontSize: 13 }}>
              No quotes yet. Create one from Quick Quote.
            </div>
          )}
          {recentQuotes.map((q, i) => (
            <div
              key={i}
              style={s.listItem}
              onClick={() => navigate('/quote')}
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

        <div style={s.panel}>
          <h2 style={s.panelTitle}>Upcoming Jobs</h2>
          {upcomingJobs.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: C.steel, fontSize: 13 }}>
              No upcoming jobs. Schedule one from the Jobs page.
            </div>
          )}
          {upcomingJobs.map((j, i) => (
            <div
              key={i}
              style={s.listItem}
              onClick={() => navigate('/jobs')}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.steel + '33')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={s.listLeft}>
                <span style={s.listName}>{j.customer}</span>
                <span style={s.listMeta}>{j.jobType} &middot; {j.date}</span>
              </div>
              <span style={{ ...s.badge, color: statusColor[j.status], background: statusColor[j.status] + '1A' }}>{j.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
