import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, LayoutGrid, Table, X, FileDown, Send, Link2, Receipt, Pencil, CalendarDays, AlertCircle, Clock, Search, Filter, ChevronRight, Copy, Trash2, Package, FileCheck } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useTheme } from '../theme/ThemeContext'
import { useData, type JobStatus, type Job, type InvoiceType } from '../data/DataContext'
import { generateQuotePDF, generateInvoicePDF, settingsToBusinessInfo } from '../lib/pdf-generator'
import { useSubscription } from '../subscription/SubscriptionContext'
import { LimitWarning } from '../components/FeatureGate'
import LoadingSpinner from '../components/LoadingSpinner'

/* ── helpers ── */

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]}`
}

function fmtCurrency(n: number): string {
  return '£' + n.toLocaleString('en-GB', { maximumFractionDigits: 0 })
}

function fmtCurrencyDecimals(n: number): string {
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/* ── constants ── */

const columns: JobStatus[] = ['Lead', 'Quoted', 'Accepted', 'Scheduled', 'In Progress', 'Complete', 'Invoiced']

const statusColor: Record<JobStatus, string> = {
  Lead: '#8A8F96',
  Quoted: '#9B7ED8',
  Accepted: '#6ABF8A',
  Scheduled: '#5B9BD5',
  'In Progress': '#C6A86A',
  Complete: '#6ABF8A',
  Invoiced: '#5BBFD4',
  Paid: '#4CAF50',
}

const invoiceTypeColors: Record<InvoiceType, string> = {
  Deposit: '#9B7ED8',
  Progress: '#5B9BD5',
  Final: '#6ABF8A',
  Custom: '#C6A86A',
}

const invoiceStatusColors: Record<string, string> = {
  Draft: '#8A8F96',
  Sent: '#C6A86A',
  Viewed: '#5B9BD5',
  Paid: '#4CAF50',
  Overdue: '#D46A6A',
}

export default function Jobs() {
  const { C } = useTheme()
  const { jobs, quotes, customers, invoices, events, settings, moveJob, updateQuote, updateJob, addInvoice, updateInvoice, getInvoicesForJob, addEvent, deleteEvent, addComm, isDataLoading } = useData()
  const { features, plan } = useSubscription()
  const activeJobCount = useMemo(() => jobs.filter(j => j.status !== 'Paid').length, [jobs])

  // History view state (must be declared before useMemos that reference them)
  const [historySearch, setHistorySearch] = useState('')
  const [historyFilterType, setHistoryFilterType] = useState('')
  const [historyFilterCustomer, setHistoryFilterCustomer] = useState('')
  const [showHistoryFilters, setShowHistoryFilters] = useState(false)

  // History view data
  const paidJobs = useMemo(() => jobs.filter(j => j.status === 'Paid').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [jobs])
  const historyJobTypes = useMemo(() => [...new Set(paidJobs.map(j => j.jobType))].sort(), [paidJobs])
  const historyCustomerNames = useMemo(() => [...new Set(paidJobs.map(j => j.customerName))].sort(), [paidJobs])
  const filteredHistory = useMemo(() => {
    let result = paidJobs
    if (historySearch) {
      const term = historySearch.toLowerCase()
      result = result.filter(j => j.customerName.toLowerCase().includes(term) || j.jobType.toLowerCase().includes(term) || j.id.toLowerCase().includes(term))
    }
    if (historyFilterType) result = result.filter(j => j.jobType === historyFilterType)
    if (historyFilterCustomer) result = result.filter(j => j.customerName === historyFilterCustomer)
    return result
  }, [paidJobs, historySearch, historyFilterType, historyFilterCustomer])
  const historyRevenue = useMemo(() => filteredHistory.reduce((s, j) => s + j.value, 0), [filteredHistory])
  const navigate = useNavigate()
  const [view, setView] = useState<'kanban' | 'table' | 'history'>('kanban')
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [dragOverCol, setDragOverCol] = useState<JobStatus | null>(null)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleSlot, setScheduleSlot] = useState<'morning' | 'afternoon' | 'full'>('morning')

  // Add-invoice form state
  const [showAddInvoice, setShowAddInvoice] = useState(false)
  const [newInvType, setNewInvType] = useState<InvoiceType>('Deposit')
  const [newInvAmount, setNewInvAmount] = useState('')
  const [newInvDesc, setNewInvDesc] = useState('')

  // Panel tab state
  const [panelTab, setPanelTab] = useState<'details' | 'quote' | 'payments'>('details')
  const [requoteSuccess, setRequoteSuccess] = useState(false)

  // Materials breakdown editor state
  const [materialsEditMode, setMaterialsEditMode] = useState(false)
  const [materialLines, setMaterialLines] = useState<Array<{ description: string; quantity: number; unitPrice: number }>>([])
  const [materialsInitialised, setMaterialsInitialised] = useState<string | null>(null)

  /* ── select job handler (resets panel tab) ── */
  function selectJob(job: Job) {
    setSelectedJob(job)
    setPanelTab('details')
    setMaterialsEditMode(false)
    setMaterialsInitialised(null)
    setShowAddInvoice(false)
    setRequoteSuccess(false)
  }

  /* ── missing info check ── */
  function getJobWarning(job: Job): string | null {
    const hasQuote = !!job.quoteId
    const jobInvoices = getInvoicesForJob(job.id)
    const hasInvoice = jobInvoices.length > 0
    switch (job.status) {
      case 'Quoted':
      case 'Accepted':
        return !hasQuote ? 'No quote linked' : null
      case 'Scheduled':
      case 'In Progress':
        return !job.date ? 'No date set' : null
      case 'Complete':
        return !hasQuote ? 'No quote — cannot invoice' : null
      case 'Invoiced':
        return !hasInvoice ? 'No invoice created' : null
      default:
        return null
    }
  }

  /* ── styles ── */
  const s: Record<string, CSSProperties> = {
    page: {
      padding: '32px',
      maxWidth: 1400,
      margin: '0 auto',
      position: 'relative',
      minHeight: '100%',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 24,
    },
    heading: {
      fontSize: 28,
      fontWeight: 600,
      color: C.white,
    },
    toggleWrap: {
      display: 'flex',
      background: C.black,
      borderRadius: 8,
      overflow: 'hidden',
    },
    toggleBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '10px 18px',
      border: 'none',
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 500,
      minHeight: 44,
      transition: 'background .15s, color .15s',
    },
    /* kanban */
    kanban: {
      display: 'grid',
      gridTemplateColumns: 'repeat(7, minmax(150px, 1fr))',
      gap: 12,
      overflowX: 'auto' as const,
    },
    column: {
      background: C.black,
      borderRadius: 12,
      padding: 12,
      minWidth: 140,
      transition: 'background .15s',
    },
    colHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
      padding: '0 4px',
    },
    colTitle: {
      fontSize: 13,
      fontWeight: 600,
      color: C.silver,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.8,
    },
    colCount: {
      fontSize: 11,
      fontWeight: 700,
      color: C.charcoal,
      background: C.silver,
      borderRadius: 10,
      padding: '2px 8px',
    },
    card: {
      background: C.charcoalLight,
      borderRadius: 10,
      padding: '14px 14px 12px',
      marginBottom: 10,
      borderLeft: '3px solid',
      cursor: 'grab',
      transition: 'transform .1s, box-shadow .15s',
    },
    cardCustomer: {
      fontSize: 14,
      fontWeight: 500,
      color: C.white,
      marginBottom: 4,
    },
    cardType: {
      fontSize: 12,
      color: C.silver,
      marginBottom: 8,
    },
    cardFooter: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardValue: {
      fontSize: 14,
      fontWeight: 600,
      color: C.gold,
    },
    cardDate: {
      fontSize: 11,
      color: C.steel,
    },
    /* table */
    table: {
      width: '100%',
      borderCollapse: 'collapse' as const,
      background: C.charcoalLight,
      borderRadius: 12,
      overflow: 'hidden',
    },
    th: {
      textAlign: 'left' as const,
      padding: '14px 16px',
      fontSize: 12,
      fontWeight: 600,
      color: C.silver,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.6,
      borderBottom: `1px solid ${C.steel}33`,
      cursor: 'pointer',
    },
    td: {
      padding: '14px 16px',
      fontSize: 14,
      color: C.white,
      borderBottom: `1px solid ${C.steel}1A`,
    },
    tableRow: {
      cursor: 'pointer',
      transition: 'background .15s',
    },
    badge: {
      fontSize: 11,
      fontWeight: 600,
      padding: '3px 10px',
      borderRadius: 20,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
    },
    fab: {
      position: 'fixed' as const,
      bottom: 32,
      right: 32,
      width: 56,
      height: 56,
      borderRadius: 16,
      background: C.gold,
      color: C.black,
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 4px 20px rgba(0,0,0,.4)',
      transition: 'transform .15s, box-shadow .15s',
      zIndex: 50,
    },
    /* slide-in panel */
    overlay: {
      position: 'fixed' as const,
      inset: 0,
      background: 'rgba(0,0,0,.45)',
      zIndex: 90,
    },
    panel: {
      position: 'fixed' as const,
      top: 0,
      right: 0,
      bottom: 0,
      width: 440,
      maxWidth: '100vw',
      background: C.charcoal,
      borderLeft: `1px solid ${C.steel}44`,
      zIndex: 100,
      overflowY: 'auto' as const,
      padding: '28px 28px 40px',
      boxShadow: '-8px 0 32px rgba(0,0,0,.5)',
    },
    panelHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 24,
    },
    panelTitle: {
      fontSize: 20,
      fontWeight: 600,
      color: C.white,
    },
    closeBtn: {
      background: 'transparent',
      border: 'none',
      color: C.silver,
      cursor: 'pointer',
      padding: 8,
      minWidth: 44,
      minHeight: 44,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: 600,
      color: C.silver,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
      marginBottom: 6,
      display: 'block',
    },
    fieldValue: {
      fontSize: 14,
      color: C.white,
      marginBottom: 16,
    },
    detailRow: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12,
    },
  }

  /* ── drag handlers ── */
  function handleDragStart(e: React.DragEvent, jobId: string) {
    e.dataTransfer.setData('text/plain', jobId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent, col: JobStatus) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverCol !== col) setDragOverCol(col)
  }

  function handleDragLeave() {
    setDragOverCol(null)
  }

  function handleDrop(e: React.DragEvent, col: JobStatus) {
    e.preventDefault()
    setDragOverCol(null)
    const jobId = e.dataTransfer.getData('text/plain')
    if (jobId) moveJob(jobId, col)
  }

  /* ── helper: payment progress bar for kanban cards ── */
  function renderCardPaymentBar(jobId: string, jobValue: number) {
    const jobInvoices = invoices.filter(i => i.jobId === jobId)
    if (jobInvoices.length === 0) return null
    const totalPaid = jobInvoices.filter(i => i.status === 'Paid').reduce((sum, i) => sum + i.grandTotal, 0)
    const totalInvoiced = jobInvoices.reduce((sum, i) => sum + i.grandTotal, 0)
    const total = Math.max(jobValue, totalInvoiced)
    if (total === 0) return null
    const paidPct = Math.min((totalPaid / total) * 100, 100)
    const invoicedPct = Math.min(((totalInvoiced - totalPaid) / total) * 100, 100 - paidPct)

    return (
      <div style={{ marginTop: 6, height: 3, borderRadius: 2, background: `${C.steel}33`, overflow: 'hidden', display: 'flex' }}>
        {paidPct > 0 && <div style={{ width: `${paidPct}%`, background: '#4CAF50', height: '100%' }} />}
        {invoicedPct > 0 && <div style={{ width: `${invoicedPct}%`, background: C.gold, height: '100%' }} />}
      </div>
    )
  }

  if (isDataLoading) {
    return (
      <div style={s.page}>
        <h1 style={s.heading}>Jobs</h1>
        <LoadingSpinner message="Loading jobs..." />
      </div>
    )
  }

  return (
    <div style={s.page}>
      {/* header */}
      <div style={s.header}>
        <h1 style={s.heading}>Jobs</h1>
        <div style={s.toggleWrap}>
          <button
            style={{
              ...s.toggleBtn,
              background: view === 'kanban' ? C.charcoalLight : 'transparent',
              color: view === 'kanban' ? C.gold : C.steel,
            }}
            onClick={() => setView('kanban')}
          >
            <LayoutGrid size={16} /> Kanban
          </button>
          <button
            style={{
              ...s.toggleBtn,
              background: view === 'table' ? C.charcoalLight : 'transparent',
              color: view === 'table' ? C.gold : C.steel,
            }}
            onClick={() => setView('table')}
          >
            <Table size={16} /> Table
          </button>
          <button
            style={{
              ...s.toggleBtn,
              background: view === 'history' ? C.charcoalLight : 'transparent',
              color: view === 'history' ? C.gold : C.steel,
            }}
            onClick={() => setView('history')}
          >
            <Clock size={16} /> History
          </button>
        </div>
      </div>

      {/* Job limit warning */}
      <LimitWarning current={activeJobCount} max={features?.maxActiveJobs ?? null} label="active jobs" plan={plan} />

      {/* kanban view */}
      {view === 'kanban' && (
        <div style={s.kanban}>
          {columns.map((col) => {
            const colJobs = jobs.filter((j) => j.status === col)
            const isOver = dragOverCol === col
            return (
              <div
                key={col}
                style={{
                  ...s.column,
                  background: isOver ? (C.steel + '33') : C.black,
                  outline: isOver ? `2px dashed ${C.gold}66` : 'none',
                }}
                onDragOver={(e) => handleDragOver(e, col)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col)}
              >
                <div style={s.colHeader}>
                  <span style={s.colTitle}>{col}</span>
                  <span style={s.colCount}>{colJobs.length}</span>
                </div>
                {colJobs.map((job) => (
                  <div
                    key={job.id}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, job.id)}
                    style={{ ...s.card, borderLeftColor: statusColor[job.status] }}
                    onClick={() => selectJob(job)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.3)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'none'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    <div style={s.cardCustomer}>
                      {job.customerName}
                      {getJobWarning(job) && (
                        <span title={getJobWarning(job)!} style={{ marginLeft: 6, display: 'inline-flex', verticalAlign: -2 }}>
                          <AlertCircle size={13} color="#D46A6A" />
                        </span>
                      )}
                    </div>
                    <div style={s.cardType}>{job.jobType !== 'TBC' ? job.jobType : (() => { const q = job.quoteId ? quotes.find(qq => qq.id === job.quoteId) : undefined; return q?.jobTypeName || 'TBC' })()}</div>
                    <div style={s.cardFooter}>
                      <span style={s.cardValue}>{fmtCurrency(job.value > 0 ? job.value : (() => { const q = job.quoteId ? quotes.find(qq => qq.id === job.quoteId) : undefined; return q?.netTotal || 0 })())}</span>
                      <span style={s.cardDate}>{fmtDate(job.date)}</span>
                    </div>
                    {renderCardPaymentBar(job.id, job.value > 0 ? job.value : (() => { const q = job.quoteId ? quotes.find(qq => qq.id === job.quoteId) : undefined; return q?.grandTotal || 0 })())}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* table view */}
      {view === 'table' && (
        <div style={{ borderRadius: 12, overflow: 'hidden' }}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Job #</th>
                <th style={s.th}>Customer</th>
                <th style={s.th}>Type</th>
                <th style={s.th}>Value</th>
                <th style={s.th}>Date</th>
                <th style={s.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {jobs.filter(j => j.status !== 'Paid').map((job) => (
                <tr
                  key={job.id}
                  style={s.tableRow}
                  onClick={() => selectJob(job)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = C.steel + '22')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ ...s.td, color: C.gold, fontWeight: 600 }}>{job.id}</td>
                  <td style={s.td}>{job.customerName}</td>
                  <td style={s.td}>{job.jobType}</td>
                  <td style={{ ...s.td, fontWeight: 600, color: C.gold }}>{fmtCurrency(job.value)}</td>
                  <td style={{ ...s.td, color: C.silver }}>{fmtDate(job.date)}</td>
                  <td style={s.td}>
                    <span
                      style={{
                        ...s.badge,
                        color: statusColor[job.status],
                        background: statusColor[job.status] + '1A',
                      }}
                    >
                      {job.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* history view */}
      {view === 'history' && (
        <div>
          {/* Stats + Search + Filters */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ background: C.charcoalLight, borderRadius: 10, padding: '10px 16px', display: 'flex', gap: 16 }}>
              <span style={{ fontSize: 12, color: C.steel }}>{filteredHistory.length} jobs</span>
              <span style={{ fontSize: 12, color: C.gold, fontWeight: 600 }}>£{historyRevenue.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', background: C.black, borderRadius: 10, padding: '0 14px', flex: '1 1 240px', maxWidth: 360, minHeight: 44 }}>
              <Search size={18} color={C.steel} />
              <input
                style={{ background: 'transparent', border: 'none', outline: 'none', color: C.white, fontSize: 14, padding: '10px 8px', width: '100%' }}
                placeholder="Search history..."
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
              />
            </div>
            <button
              onClick={() => setShowHistoryFilters(!showHistoryFilters)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px',
                borderRadius: 10, border: `1px solid ${historyFilterType || historyFilterCustomer ? C.gold + '44' : C.steel + '33'}`,
                background: C.black, color: historyFilterType || historyFilterCustomer ? C.gold : C.silver,
                cursor: 'pointer', fontSize: 13, fontWeight: 500, minHeight: 44,
              }}
            >
              <Filter size={16} /> Filters
            </button>
          </div>

          {showHistoryFilters && (
            <div style={{ background: C.charcoalLight, borderRadius: 12, padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.steel, textTransform: 'uppercase', marginBottom: 6 }}>Job Type</div>
                <select value={historyFilterType} onChange={e => setHistoryFilterType(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: 8, background: C.black, border: `1px solid ${C.steel}33`, color: C.white, fontSize: 13, outline: 'none' }}>
                  <option value="">All</option>
                  {historyJobTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.steel, textTransform: 'uppercase', marginBottom: 6 }}>Customer</div>
                <select value={historyFilterCustomer} onChange={e => setHistoryFilterCustomer(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: 8, background: C.black, border: `1px solid ${C.steel}33`, color: C.white, fontSize: 13, outline: 'none' }}>
                  <option value="">All</option>
                  {historyCustomerNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <button onClick={() => { setHistoryFilterType(''); setHistoryFilterCustomer('') }}
                style={{ padding: '8px 14px', borderRadius: 8, background: 'transparent', border: `1px solid ${C.steel}33`, color: C.steel, cursor: 'pointer', fontSize: 12 }}>
                Clear
              </button>
            </div>
          )}

          {filteredHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: C.steel, fontSize: 14 }}>
              {paidJobs.length === 0 ? 'No completed jobs yet.' : 'No matches found.'}
            </div>
          ) : (
            <div style={{ borderRadius: 12, overflow: 'hidden' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Job #</th>
                    <th style={s.th}>Customer</th>
                    <th style={s.th}>Type</th>
                    <th style={s.th}>Value</th>
                    <th style={s.th}>Date</th>
                    <th style={{ ...s.th, width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map(job => (
                    <tr
                      key={job.id}
                      style={s.tableRow}
                      onClick={() => selectJob(job)}
                      onMouseEnter={e => { e.currentTarget.style.background = C.steel + '22' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <td style={{ ...s.td, color: C.gold, fontWeight: 600 }}>{job.id}</td>
                      <td style={{ ...s.td, fontWeight: 500 }}>
                        {job.customerName}
                        {(() => { const cust = customers.find(c => c.id === job.customerId); return cust?.postcode ? <span style={{ color: C.steel, fontWeight: 400, marginLeft: 6, fontSize: 12 }}>{cust.postcode}</span> : null })()}
                      </td>
                      <td style={s.td}>{job.jobType !== 'TBC' ? job.jobType : (() => { const q = job.quoteId ? quotes.find(qq => qq.id === job.quoteId) : undefined; return q?.jobTypeName || 'TBC' })()}</td>
                      <td style={{ ...s.td, fontWeight: 600, color: C.gold }}>{fmtCurrency(job.value > 0 ? job.value : (() => { const q = job.quoteId ? quotes.find(qq => qq.id === job.quoteId) : undefined; return q?.netTotal || 0 })())}</td>
                      <td style={{ ...s.td, color: C.silver }}>{fmtDate(job.date)}</td>
                      <td style={s.td}><ChevronRight size={14} color={C.steel} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* slide-in detail panel */}
      {selectedJob && (() => {
        const linkedQuote = selectedJob.quoteId ? quotes.find(q => q.id === selectedJob.quoteId) : undefined
        const jobInvoices = invoices.filter(i => i.jobId === selectedJob.id)
        const quotedTotal = linkedQuote?.grandTotal ?? selectedJob.value
        const totalInvoiced = jobInvoices.reduce((sum, i) => sum + i.grandTotal, 0)
        const totalPaid = jobInvoices.filter(i => i.status === 'Paid').reduce((sum, i) => sum + i.grandTotal, 0)
        const remaining = Math.max(0, quotedTotal - totalInvoiced)

        const tabBtnStyle = (active: boolean): CSSProperties => ({
          padding: '7px 14px',
          borderRadius: 20,
          border: 'none',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          background: active ? C.gold : 'transparent',
          color: active ? C.black : C.steel,
          transition: 'background .15s, color .15s',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          minHeight: 32,
        })

        const tabBadge = (text: string): CSSProperties => ({
          fontSize: 10,
          fontWeight: 700,
          padding: '1px 6px',
          borderRadius: 8,
          background: `${C.steel}33`,
          color: C.silver,
          marginLeft: 2,
        })

        return (
          <>
            <div style={s.overlay} onClick={() => setSelectedJob(null)} />
            <div style={s.panel}>
              <div style={s.panelHeader}>
                <span style={s.panelTitle}>{selectedJob.id}</span>
                <button style={s.closeBtn} onClick={() => setSelectedJob(null)}>
                  <X size={22} />
                </button>
              </div>

              {/* ── Tab Bar ── */}
              <div style={{ display: 'flex', gap: 4, background: C.black, borderRadius: 24, padding: 4, marginBottom: 20 }}>
                <button style={tabBtnStyle(panelTab === 'details')} onClick={() => setPanelTab('details')}>
                  Details
                </button>
                <button style={tabBtnStyle(panelTab === 'quote')} onClick={() => setPanelTab('quote')}>
                  Quote
                  {linkedQuote && <span style={tabBadge(linkedQuote.ref)}>{linkedQuote.ref}</span>}
                </button>
                <button style={tabBtnStyle(panelTab === 'payments')} onClick={() => setPanelTab('payments')}>
                  Payments
                  {jobInvoices.length > 0 && <span style={tabBadge(String(jobInvoices.length))}>{jobInvoices.length}</span>}
                </button>
              </div>

              {/* ════════════════════════════════════════════════ */}
              {/* ── DETAILS TAB ── */}
              {/* ════════════════════════════════════════════════ */}
              {panelTab === 'details' && (
                <div>
                  <span style={s.fieldLabel}>Customer</span>
                  <div style={s.fieldValue}>{selectedJob.customerName}</div>

                  <div style={s.detailRow}>
                    <div>
                      <span style={s.fieldLabel}>Job Type</span>
                      <div style={s.fieldValue}>{selectedJob.jobType}</div>
                    </div>
                    <div>
                      <span style={s.fieldLabel}>Value</span>
                      <div style={{ ...s.fieldValue, color: C.gold, fontSize: 20, fontWeight: 700 }}>{fmtCurrency(selectedJob.value)}</div>
                    </div>
                  </div>

                  <div style={s.detailRow}>
                    <div>
                      <span style={s.fieldLabel}>Date</span>
                      <div style={s.fieldValue}>{fmtDate(selectedJob.date)}</div>
                    </div>
                    <div>
                      <span style={s.fieldLabel}>Status</span>
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ position: 'relative' }}>
                          <select
                            value={selectedJob.status}
                            onChange={e => {
                              const newStatus = e.target.value as typeof selectedJob.status
                              moveJob(selectedJob.id, newStatus)
                              setSelectedJob({ ...selectedJob, status: newStatus })
                            }}
                            style={{
                              width: '100%', padding: '6px 28px 6px 10px', borderRadius: 8,
                              background: C.black, border: `1px solid ${statusColor[selectedJob.status]}44`,
                              color: statusColor[selectedJob.status], fontSize: 13, fontWeight: 600,
                              cursor: 'pointer', outline: 'none',
                              appearance: 'none', WebkitAppearance: 'none' as any,
                            }}
                          >
                            {[...columns, 'Paid' as JobStatus].map(col => (
                              <option key={col} value={col} style={{ color: '#fff', background: '#1A1C20' }}>{col}</option>
                            ))}
                          </select>
                          <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: C.steel }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={s.detailRow}>
                    <div>
                      <span style={s.fieldLabel}>Est. Hours</span>
                      <div style={s.fieldValue}>{selectedJob.estimatedHours}h</div>
                    </div>
                    <div style={{ minHeight: 1 }} />
                  </div>

                  {/* ── Actual Hours Tracking ── */}
                  {(['In Progress', 'Complete', 'Invoiced', 'Paid'] as JobStatus[]).includes(selectedJob.status) && (() => {
                    const variance = selectedJob.actualHours != null
                      ? selectedJob.actualHours - selectedJob.estimatedHours
                      : null
                    const varianceColor = variance != null
                      ? (variance <= 0 ? '#6ABF8A' : '#D46A6A')
                      : C.steel

                    return (
                      <div style={{ marginBottom: 16 }}>
                        <div style={s.detailRow}>
                          <div>
                            <span style={s.fieldLabel}>Actual Hours</span>
                            <input
                              type="number"
                              min={0}
                              step={0.5}
                              value={selectedJob.actualHours ?? ''}
                              placeholder="0"
                              onChange={e => {
                                const val = e.target.value === '' ? undefined : Number(e.target.value)
                                updateJob(selectedJob.id, { actualHours: val })
                                setSelectedJob({ ...selectedJob, actualHours: val })
                              }}
                              style={{
                                width: '100%', padding: '10px 12px', borderRadius: 10,
                                background: C.black, border: `1px solid ${C.steel}33`,
                                color: C.white, fontSize: 14, outline: 'none',
                                boxSizing: 'border-box' as const,
                              }}
                            />
                          </div>
                          <div>
                            <span style={s.fieldLabel}>Variance</span>
                            <div style={{
                              fontSize: 14, fontWeight: 600, color: varianceColor,
                              padding: '10px 0',
                            }}>
                              {variance != null
                                ? `${variance > 0 ? '+' : ''}${variance.toFixed(1)}h ${variance <= 0 ? 'under' : 'over'}`
                                : '-- not set --'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  {selectedJob.notes && (
                    <>
                      <span style={s.fieldLabel}>Notes</span>
                      <div style={{ ...s.fieldValue, fontStyle: 'italic', color: C.silver }}>{selectedJob.notes}</div>
                    </>
                  )}

                  {/* ── Schedule Job ── */}
                  {(selectedJob.status === 'Accepted' || selectedJob.status === 'Scheduled' || selectedJob.status === 'In Progress') && (() => {
                    const jobEvents = events.filter(e => e.jobId === selectedJob.id).sort((a, b) => a.date.localeCompare(b.date))
                    const slotLabels: Record<string, string> = { morning: 'Morning', afternoon: 'Afternoon', full: 'Full Day' }
                    const inputStyle: CSSProperties = {
                      width: '100%', padding: '10px 12px', borderRadius: 10,
                      background: C.black, border: `1px solid ${C.steel}33`,
                      color: C.white, fontSize: 14, outline: 'none',
                    }

                    return (
                      <div style={{ marginTop: 8, paddingTop: 16, borderTop: `1px solid ${C.steel}33` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          <CalendarDays size={16} color={C.gold} />
                          <span style={{ fontSize: 14, fontWeight: 600, color: C.white }}>Schedule</span>
                        </div>

                        {/* Existing scheduled days */}
                        {jobEvents.length > 0 && (
                          <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {jobEvents.map(ev => (
                              <div key={ev.id} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '8px 12px', background: C.black, borderRadius: 8,
                                borderLeft: `3px solid ${C.blue}`,
                              }}>
                                <div>
                                  <span style={{ fontSize: 13, fontWeight: 500, color: C.white }}>{fmtDate(ev.date)}</span>
                                  <span style={{ fontSize: 12, color: C.steel, marginLeft: 8 }}>{slotLabels[ev.slot]}</span>
                                </div>
                                <button
                                  onClick={() => { if (window.confirm('Remove this event from the calendar?')) deleteEvent(ev.id) }}
                                  style={{ background: 'transparent', border: 'none', color: C.steel, cursor: 'pointer', padding: 4, display: 'flex' }}
                                  onMouseEnter={e => { e.currentTarget.style.color = '#D46A6A' }}
                                  onMouseLeave={e => { e.currentTarget.style.color = C.steel }}
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add another day */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                          <input
                            type="date"
                            value={scheduleDate}
                            onChange={e => setScheduleDate(e.target.value)}
                            style={{ ...inputStyle, flex: 1, colorScheme: 'dark' }}
                          />
                          <div style={{ position: 'relative', flex: 1 }}>
                            <select
                              value={scheduleSlot}
                              onChange={e => setScheduleSlot(e.target.value as 'morning' | 'afternoon' | 'full')}
                              style={{ ...inputStyle, appearance: 'none', WebkitAppearance: 'none' as any }}
                            >
                              <option value="morning">Morning</option>
                              <option value="afternoon">Afternoon</option>
                              <option value="full">Full Day</option>
                            </select>
                            <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: C.steel }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            if (!scheduleDate) return
                            addEvent({
                              jobId: selectedJob.id,
                              customerId: selectedJob.customerId,
                              customerName: selectedJob.customerName,
                              jobType: selectedJob.jobType !== 'TBC' ? selectedJob.jobType : (selectedJob.quoteId ? quotes.find(q => q.id === selectedJob.quoteId)?.jobTypeName || '' : ''),
                              date: scheduleDate,
                              slot: scheduleSlot,
                              status: 'Scheduled',
                              notes: '',
                            })
                            // Update job date to the earliest scheduled date
                            const allDates = [...jobEvents.map(e => e.date), scheduleDate].sort()
                            updateJob(selectedJob.id, { date: allDates[0] })
                            if (selectedJob.status === 'Accepted') {
                              moveJob(selectedJob.id, 'Scheduled')
                              setSelectedJob({ ...selectedJob, status: 'Scheduled', date: allDates[0] })
                            }
                            setScheduleDate('')
                          }}
                          disabled={!scheduleDate}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500,
                            cursor: scheduleDate ? 'pointer' : 'not-allowed', minHeight: 42,
                            background: scheduleDate ? `${C.gold}15` : C.black,
                            border: `1px solid ${scheduleDate ? C.gold + '44' : C.steel + '33'}`,
                            color: scheduleDate ? C.gold : C.steel,
                            opacity: scheduleDate ? 1 : 0.5,
                          }}
                        >
                          <CalendarDays size={14} />
                          {jobEvents.length > 0 ? 'Add Day' : 'Schedule'}
                        </button>
                      </div>
                    )
                  })()}

                  {/* ── Certificates ── */}
                  {(() => {
                    const certTypes = ['consumer unit', 'ev charger', 'rewire', 'eicr', 'consumer', 'condition report']
                    const jt = selectedJob.jobType.toLowerCase()
                    const showCerts = certTypes.some(t => jt.includes(t))
                    if (!showCerts) return null
                    return (
                      <div style={{ marginTop: 8, paddingTop: 16, borderTop: `1px solid ${C.steel}33` }}>
                        <button
                          onClick={() => { setSelectedJob(null); navigate(`/certificates/${selectedJob.id}`) }}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                            cursor: 'pointer', minHeight: 42,
                            background: '#9B7ED815', border: '1px solid #9B7ED844', color: '#9B7ED8',
                          }}
                        >
                          <FileCheck size={14} /> Certificates
                        </button>
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* ════════════════════════════════════════════════ */}
              {/* ── QUOTE TAB ── */}
              {/* ════════════════════════════════════════════════ */}
              {panelTab === 'quote' && (
                <div>
                  {!linkedQuote ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                      <div style={{ fontSize: 14, color: C.steel, marginBottom: 16 }}>No quote linked -- create one from Quick Quote</div>
                      <button
                        onClick={() => { setSelectedJob(null); navigate(`/quote?jobId=${selectedJob.id}`) }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 8,
                          padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                          cursor: 'pointer', minHeight: 42,
                          background: `${C.gold}15`, border: `1px solid ${C.gold}44`, color: C.gold,
                        }}
                      >
                        <Plus size={14} /> Create Quote
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Quote Breakdown */}
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ marginBottom: 12 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: C.white }}>Quote {linkedQuote.ref}</span>
                        </div>

                        <div style={{ background: C.black, borderRadius: 10, padding: '14px 16px', fontSize: 13 }}>
                          {linkedQuote.description && (
                            <div style={{ color: C.silver, marginBottom: 10, fontStyle: 'italic' }}>{linkedQuote.description}</div>
                          )}
                          {[
                            { label: 'Materials', value: linkedQuote.materials },
                            { label: `Labour (${linkedQuote.estHours}h)`, value: linkedQuote.labour },
                            ...(linkedQuote.certificates > 0 ? [{ label: 'Certificates', value: linkedQuote.certificates }] : []),
                            ...(linkedQuote.waste > 0 ? [{ label: 'Waste', value: linkedQuote.waste }] : []),
                            ...(linkedQuote.adjustments > 0 ? [{ label: 'Adjustments', value: linkedQuote.adjustments }] : []),
                          ].map(row => (
                            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: C.silver }}>
                              <span>{row.label}</span>
                              <span style={{ color: C.white, fontWeight: 500 }}>{'\u00A3'}{row.value.toFixed(2)}</span>
                            </div>
                          ))}
                          <div style={{ borderTop: `1px solid ${C.steel}33`, marginTop: 8, paddingTop: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: C.silver }}>
                              <span>Net Total</span><span style={{ color: C.white, fontWeight: 600 }}>{'\u00A3'}{linkedQuote.netTotal.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: C.silver }}>
                              <span>VAT (20%)</span><span style={{ color: C.white }}>{'\u00A3'}{linkedQuote.vat.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 16, fontWeight: 700, color: C.gold, borderTop: `2px solid ${C.gold}44`, marginTop: 4 }}>
                              <span>Total</span><span>{'\u00A3'}{linkedQuote.grandTotal.toFixed(2)}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 0', color: C.steel, fontSize: 12 }}>
                            <span>Margin: {Math.round(linkedQuote.margin)}%</span>
                            <span>Status: {linkedQuote.status}</span>
                          </div>
                        </div>
                      </div>

                      {/* ── Materials Breakdown ── */}
                      {(() => {
                        const breakdown = linkedQuote.materialsBreakdown ?? []
                        const materialsTotal = breakdown.reduce((sum, m) => sum + m.quantity * m.unitPrice, 0)

                        // Initialise materialLines from quote data when entering edit mode
                        if (materialsEditMode && materialsInitialised !== linkedQuote.id) {
                          setMaterialLines(breakdown.length > 0 ? breakdown.map(m => ({ ...m })) : [{ description: '', quantity: 1, unitPrice: 0 }])
                          setMaterialsInitialised(linkedQuote.id)
                        }

                        const editTotal = materialLines.reduce((sum, m) => sum + m.quantity * m.unitPrice, 0)
                        // Check if materials have changed vs the quote's current materials value
                        const materialsChanged = !materialsEditMode && breakdown.length > 0 && Math.abs(materialsTotal - linkedQuote.materials) > 0.01
                        const materialsDiff = materialsTotal - linkedQuote.materials
                        // Compute what the new quote totals would be if we update
                        const newNetTotal = materialsTotal + linkedQuote.labour + linkedQuote.certificates + linkedQuote.waste + linkedQuote.adjustments
                        const newVat = newNetTotal * 0.2
                        const newGrandTotal = newNetTotal + newVat

                        return (
                          <div style={{ marginBottom: 16, paddingTop: 16, borderTop: `1px solid ${C.steel}33` }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Package size={16} color={C.gold} />
                                <span style={{ fontSize: 14, fontWeight: 600, color: C.white }}>Materials</span>
                              </div>
                              <button
                                onClick={() => {
                                  if (materialsEditMode) {
                                    setMaterialsEditMode(false)
                                    setMaterialsInitialised(null)
                                  } else {
                                    setMaterialsEditMode(true)
                                  }
                                }}
                                style={{
                                  background: 'transparent', border: `1px solid ${C.steel}33`, borderRadius: 8,
                                  color: materialsEditMode ? C.red : C.gold, cursor: 'pointer', padding: '4px 10px',
                                  fontSize: 12, fontWeight: 500, minHeight: 30,
                                }}
                              >
                                {materialsEditMode ? 'Cancel' : (breakdown.length > 0 ? 'Edit' : 'Add Breakdown')}
                              </button>
                            </div>

                            {!materialsEditMode ? (
                              <div style={{ background: C.black, borderRadius: 10, padding: '14px 16px', fontSize: 13 }}>
                                {breakdown.length === 0 ? (
                                  <div style={{ color: C.steel, fontStyle: 'italic' }}>
                                    Estimated total: {'\u00A3'}{linkedQuote.materials.toFixed(2)} (from quote)
                                  </div>
                                ) : (
                                  <>
                                    {breakdown.map((m, i) => (
                                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: C.silver }}>
                                        <span>{m.description || 'Item'} {m.quantity > 1 ? `x${m.quantity}` : ''}</span>
                                        <span style={{ color: C.white, fontWeight: 500 }}>{'\u00A3'}{(m.quantity * m.unitPrice).toFixed(2)}</span>
                                      </div>
                                    ))}
                                    <div style={{ borderTop: `1px solid ${C.steel}33`, marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                                      <span style={{ color: C.silver }}>Total</span>
                                      <span style={{ color: C.gold }}>{'\u00A3'}{materialsTotal.toFixed(2)}</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            ) : (
                              <div style={{ background: C.black, borderRadius: 10, padding: '14px 16px', fontSize: 13 }}>
                                {materialLines.map((line, i) => (
                                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                                    <input
                                      type="text"
                                      placeholder="Description"
                                      value={line.description}
                                      onChange={e => {
                                        const updated = [...materialLines]
                                        updated[i] = { ...updated[i], description: e.target.value }
                                        setMaterialLines(updated)
                                      }}
                                      style={{
                                        flex: 3, padding: '8px 10px', borderRadius: 8,
                                        background: C.charcoal, border: `1px solid ${C.steel}33`,
                                        color: C.white, fontSize: 13, outline: 'none',
                                      }}
                                    />
                                    <input
                                      type="number"
                                      placeholder="Qty"
                                      min={1}
                                      value={line.quantity}
                                      onChange={e => {
                                        const updated = [...materialLines]
                                        updated[i] = { ...updated[i], quantity: Math.max(1, Number(e.target.value) || 1) }
                                        setMaterialLines(updated)
                                      }}
                                      style={{
                                        flex: 1, padding: '8px 6px', borderRadius: 8, textAlign: 'center',
                                        background: C.charcoal, border: `1px solid ${C.steel}33`,
                                        color: C.white, fontSize: 13, outline: 'none', minWidth: 40,
                                      }}
                                    />
                                    <input
                                      type="number"
                                      placeholder="Price"
                                      min={0}
                                      step={0.01}
                                      value={line.unitPrice || ''}
                                      onChange={e => {
                                        const updated = [...materialLines]
                                        updated[i] = { ...updated[i], unitPrice: Number(e.target.value) || 0 }
                                        setMaterialLines(updated)
                                      }}
                                      style={{
                                        flex: 1.5, padding: '8px 6px', borderRadius: 8,
                                        background: C.charcoal, border: `1px solid ${C.steel}33`,
                                        color: C.white, fontSize: 13, outline: 'none', minWidth: 60,
                                      }}
                                    />
                                    <span style={{ flex: 1, textAlign: 'right', color: C.silver, fontWeight: 500, fontSize: 12, minWidth: 50 }}>
                                      {'\u00A3'}{(line.quantity * line.unitPrice).toFixed(2)}
                                    </span>
                                    <button
                                      onClick={() => setMaterialLines(materialLines.filter((_, j) => j !== i))}
                                      style={{
                                        background: 'transparent', border: 'none', color: C.steel,
                                        cursor: 'pointer', padding: 4, display: 'flex',
                                      }}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                ))}

                                <button
                                  onClick={() => setMaterialLines([...materialLines, { description: '', quantity: 1, unitPrice: 0 }])}
                                  style={{
                                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                    padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                                    cursor: 'pointer', background: 'transparent',
                                    border: `1px dashed ${C.steel}44`, color: C.steel,
                                    marginBottom: 10,
                                  }}
                                >
                                  <Plus size={14} /> Add Item
                                </button>

                                <div style={{ borderTop: `1px solid ${C.steel}33`, paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                  <span style={{ color: C.silver, fontWeight: 600 }}>Total</span>
                                  <span style={{ color: C.gold, fontWeight: 700, fontSize: 15 }}>{'\u00A3'}{editTotal.toFixed(2)}</span>
                                </div>

                                <button
                                  onClick={() => {
                                    const validLines = materialLines.filter(m => m.description.trim() || m.unitPrice > 0)
                                    updateQuote(linkedQuote.id, {
                                      materialsBreakdown: validLines,
                                      materials: editTotal,
                                    })
                                    setMaterialsEditMode(false)
                                    setMaterialsInitialised(null)
                                  }}
                                  style={{
                                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                                    cursor: 'pointer', minHeight: 42,
                                    background: `${C.gold}15`, border: `1px solid ${C.gold}44`, color: C.gold,
                                  }}
                                >
                                  Save Materials
                                </button>
                              </div>
                            )}

                            {/* ── Requote Flow ── */}
                            {materialsChanged && (
                              <div style={{ background: `${C.gold}08`, border: `1px solid ${C.gold}33`, borderRadius: 10, padding: '14px 16px', marginTop: 12 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: C.silver, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                                  Materials Updated
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                  <span style={{ fontSize: 13, color: C.silver }}>Old Total</span>
                                  <span style={{ fontSize: 14, color: C.steel, textDecoration: 'line-through' }}>{'\u00A3'}{linkedQuote.grandTotal.toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                  <span style={{ fontSize: 13, color: C.silver }}>New Total</span>
                                  <span style={{ fontSize: 16, fontWeight: 700, color: C.gold }}>{'\u00A3'}{newGrandTotal.toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                                  <span style={{
                                    fontSize: 13, fontWeight: 700,
                                    color: materialsDiff > 0 ? C.red : C.green,
                                  }}>
                                    {materialsDiff > 0 ? '+' : ''}{'\u00A3'}{materialsDiff.toFixed(2)}
                                  </span>
                                </div>

                                {requoteSuccess ? (
                                  <div style={{
                                    width: '100%', textAlign: 'center', padding: '10px 16px',
                                    borderRadius: 10, fontSize: 13, fontWeight: 600,
                                    background: '#4CAF5015', border: '1px solid #4CAF5044', color: '#4CAF50',
                                  }}>
                                    Quote updated successfully
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      updateQuote(linkedQuote.id, {
                                        materials: materialsTotal,
                                        netTotal: newNetTotal,
                                        vat: newVat,
                                        grandTotal: newGrandTotal,
                                      })
                                      updateJob(selectedJob.id, { value: newGrandTotal })
                                      setSelectedJob({ ...selectedJob, value: newGrandTotal })
                                      setRequoteSuccess(true)
                                      setTimeout(() => setRequoteSuccess(false), 2500)
                                    }}
                                    style={{
                                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                      padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                                      cursor: 'pointer', minHeight: 42,
                                      background: `${C.gold}15`, border: `1px solid ${C.gold}44`, color: C.gold,
                                    }}
                                  >
                                    Update Quote
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {/* ── Quote Actions ── */}
                      {(() => {
                        const btnStyle: CSSProperties = {
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500,
                          cursor: 'pointer', minHeight: 42, transition: 'opacity .15s',
                          background: C.black, border: `1px solid ${C.steel}33`, color: C.silver,
                          flex: 1,
                        }

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 16, borderTop: `1px solid ${C.steel}33` }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button style={btnStyle} onClick={() => { setSelectedJob(null); navigate(`/quote?quoteId=${linkedQuote.id}&jobId=${selectedJob.id}`) }}>
                                <Pencil size={14} /> Edit
                              </button>
                              <button style={btnStyle} onClick={() => { setSelectedJob(null); navigate(`/quote?duplicateFrom=${linkedQuote.id}`) }}>
                                <Copy size={14} /> Duplicate
                              </button>
                              <button style={btnStyle} onClick={() => generateQuotePDF(linkedQuote, settingsToBusinessInfo(settings))}>
                                <FileDown size={14} /> PDF
                              </button>
                              <button style={btnStyle} onClick={() => {
                                const url = `${window.location.origin}/q/${linkedQuote.id}`
                                navigator.clipboard.writeText(url)
                                alert(`Quote link copied:\n${url}`)
                              }}>
                                <Link2 size={14} /> Link
                              </button>
                            </div>
                            <button
                              style={{ ...btnStyle, color: C.gold, borderColor: `${C.gold}33` }}
                              onClick={() => {
                                const url = `${window.location.origin}/q/${linkedQuote.id}`
                                navigator.clipboard.writeText(url)
                                if (linkedQuote.status === 'Draft') {
                                  updateQuote(linkedQuote.id, { status: 'Sent', sentAt: new Date().toISOString().split('T')[0] })
                                  if (selectedJob.status === 'Lead') {
                                    moveJob(selectedJob.id, 'Quoted')
                                    setSelectedJob({ ...selectedJob, status: 'Quoted' })
                                  }
                                  addComm({
                                    customerId: selectedJob.customerId, customerName: selectedJob.customerName,
                                    templateName: 'Send Quote', channel: 'email', status: 'Sent',
                                    date: new Date().toISOString(), body: url,
                                  })
                                }
                                alert(`Quote link copied — send to ${selectedJob.customerName}:\n\n${url}`)
                              }}
                            >
                              <Send size={14} /> {linkedQuote.status === 'Draft' ? 'Send Quote' : 'Resend Quote'}
                            </button>
                          </div>
                        )
                      })()}
                    </>
                  )}
                </div>
              )}

              {/* ════════════════════════════════════════════════ */}
              {/* ── PAYMENTS TAB ── */}
              {/* ════════════════════════════════════════════════ */}
              {panelTab === 'payments' && (
                <div>
                  {/* Quoted total */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: C.silver }}>
                    <span>Quoted Total</span>
                    <span style={{ color: C.white, fontWeight: 600 }}>{fmtCurrencyDecimals(quotedTotal)}</span>
                  </div>

                  {/* Progress bar */}
                  {jobInvoices.length > 0 && (() => {
                    const barTotal = Math.max(quotedTotal, totalInvoiced)
                    if (barTotal === 0) return null
                    const paidPct = Math.min((totalPaid / barTotal) * 100, 100)
                    const unpaidInvoicedPct = Math.min(((totalInvoiced - totalPaid) / barTotal) * 100, 100 - paidPct)
                    return (
                      <div style={{ margin: '8px 0 12px', height: 8, borderRadius: 4, background: `${C.steel}33`, overflow: 'hidden', display: 'flex' }}>
                        {paidPct > 0 && <div style={{ width: `${paidPct}%`, background: '#4CAF50', height: '100%', transition: 'width .3s' }} />}
                        {unpaidInvoicedPct > 0 && <div style={{ width: `${unpaidInvoicedPct}%`, background: C.gold, height: '100%', transition: 'width .3s' }} />}
                      </div>
                    )
                  })()}

                  {/* Invoice list */}
                  {jobInvoices.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                      {jobInvoices.map(inv => {
                        const invTypeColor = inv.type ? invoiceTypeColors[inv.type] : C.steel
                        const invStatusColor = invoiceStatusColors[inv.status] ?? C.steel
                        return (
                          <div key={inv.id} style={{
                            background: C.black, borderRadius: 10, padding: '10px 14px',
                            borderLeft: `3px solid ${invTypeColor}`,
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {inv.type && (
                                  <span style={{
                                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                                    color: invTypeColor, background: invTypeColor + '1A',
                                    textTransform: 'uppercase', letterSpacing: 0.5,
                                  }}>
                                    {inv.type}
                                  </span>
                                )}
                                <span style={{ fontSize: 13, fontWeight: 600, color: C.white }}>{inv.ref}</span>
                              </div>
                              <span style={{
                                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                                color: invStatusColor, background: invStatusColor + '1A',
                                textTransform: 'uppercase', letterSpacing: 0.5,
                              }}>
                                {inv.status}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 15, fontWeight: 700, color: C.gold }}>{fmtCurrencyDecimals(inv.grandTotal)}</span>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button
                                  onClick={() => {
                                    if (linkedQuote) generateInvoicePDF(linkedQuote, inv.ref, settingsToBusinessInfo(settings))
                                  }}
                                  style={{
                                    background: 'transparent', border: `1px solid ${C.steel}33`, borderRadius: 6,
                                    color: C.silver, cursor: 'pointer', padding: '4px 8px', fontSize: 11,
                                    display: 'flex', alignItems: 'center', gap: 4, minHeight: 30,
                                  }}
                                >
                                  <FileDown size={12} /> PDF
                                </button>
                                {inv.status !== 'Paid' && (
                                  <button
                                    onClick={() => {
                                      updateInvoice(inv.id, { status: 'Sent', sentAt: new Date().toISOString().split('T')[0] })
                                      const url = `${window.location.origin}/inv/${inv.id}`
                                      navigator.clipboard.writeText(url)
                                      addComm({
                                        customerId: selectedJob.customerId, customerName: selectedJob.customerName,
                                        templateName: 'Send Invoice', channel: 'email', status: 'Sent',
                                        date: new Date().toISOString(), body: url,
                                      })
                                      alert(`Invoice link copied — send to ${selectedJob.customerName}:\n\n${url}`)
                                    }}
                                    style={{
                                      background: 'transparent', border: `1px solid ${C.gold}33`, borderRadius: 6,
                                      color: C.gold, cursor: 'pointer', padding: '4px 8px', fontSize: 11,
                                      display: 'flex', alignItems: 'center', gap: 4, minHeight: 30,
                                    }}
                                  >
                                    <Send size={12} /> Send
                                  </button>
                                )}
                                {inv.status !== 'Paid' && (
                                  <button
                                    onClick={() => {
                                      updateInvoice(inv.id, { status: 'Paid', paidAt: new Date().toISOString().split('T')[0] })
                                      const updatedPaid = totalPaid + inv.grandTotal
                                      const allPaidAfter = jobInvoices.every(i => i.id === inv.id || i.status === 'Paid')
                                      if (allPaidAfter && updatedPaid >= quotedTotal) {
                                        moveJob(selectedJob.id, 'Paid')
                                        setSelectedJob({ ...selectedJob, status: 'Paid' })
                                      }
                                    }}
                                    style={{
                                      background: '#4CAF5010', border: '1px solid #4CAF5033', borderRadius: 6,
                                      color: '#4CAF50', cursor: 'pointer', padding: '4px 8px', fontSize: 11,
                                      display: 'flex', alignItems: 'center', gap: 4, minHeight: 30,
                                    }}
                                  >
                                    <Receipt size={12} /> Paid
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Totals */}
                  {jobInvoices.length > 0 && (
                    <div style={{ background: C.black, borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: C.silver }}>
                        <span>Total Invoiced</span>
                        <span style={{ color: C.white, fontWeight: 600 }}>{fmtCurrencyDecimals(totalInvoiced)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#4CAF50' }}>
                        <span>Total Paid</span>
                        <span style={{ fontWeight: 600 }}>{fmtCurrencyDecimals(totalPaid)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: remaining > 0 ? C.gold : C.steel }}>
                        <span>Remaining</span>
                        <span style={{ fontWeight: 600 }}>{fmtCurrencyDecimals(remaining)}</span>
                      </div>
                    </div>
                  )}

                  {/* Add Invoice button / form */}
                  {selectedJob.status !== 'Paid' && !showAddInvoice && (
                    <button
                      onClick={() => {
                        setShowAddInvoice(true)
                        const existingTypes = jobInvoices.map(i => i.type)
                        let defaultType: InvoiceType = 'Deposit'
                        if (existingTypes.includes('Deposit') && !existingTypes.includes('Final')) {
                          defaultType = jobInvoices.length === 0 ? 'Deposit' : 'Progress'
                        }
                        if (existingTypes.includes('Progress') || (existingTypes.includes('Deposit') && jobInvoices.length >= 2)) {
                          defaultType = 'Final'
                        }
                        if (jobInvoices.length === 0) defaultType = 'Deposit'
                        setNewInvType(defaultType)
                        setNewInvAmount(remaining > 0 ? remaining.toFixed(2) : '')
                        const jobTypeName = selectedJob.jobType !== 'TBC' ? selectedJob.jobType : (linkedQuote?.jobTypeName || 'Works')
                        const descMap: Record<InvoiceType, string> = {
                          Deposit: `Deposit — ${jobTypeName}`,
                          Progress: `Progress payment — ${jobTypeName}`,
                          Final: `Final payment — ${jobTypeName}`,
                          Custom: `${jobTypeName}`,
                        }
                        setNewInvDesc(descMap[defaultType])
                      }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500,
                        cursor: 'pointer', minHeight: 42,
                        background: `${C.gold}10`, border: `1px solid ${C.gold}33`, color: C.gold,
                      }}
                    >
                      <Plus size={14} /> Add Invoice
                    </button>
                  )}

                  {showAddInvoice && selectedJob.status !== 'Paid' && (() => {
                    const inputStyle: CSSProperties = {
                      width: '100%', padding: '10px 12px', borderRadius: 10,
                      background: C.black, border: `1px solid ${C.steel}33`,
                      color: C.white, fontSize: 14, outline: 'none',
                      boxSizing: 'border-box' as const,
                    }
                    const jobTypeName = selectedJob.jobType !== 'TBC' ? selectedJob.jobType : (linkedQuote?.jobTypeName || 'Works')

                    return (
                      <div style={{ background: C.black, borderRadius: 12, padding: 16, marginTop: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: C.white }}>New Invoice</span>
                          <button onClick={() => setShowAddInvoice(false)} style={{ background: 'transparent', border: 'none', color: C.steel, cursor: 'pointer', padding: 4, display: 'flex' }}>
                            <X size={16} />
                          </button>
                        </div>

                        {/* Type selector */}
                        <span style={{ ...s.fieldLabel, fontSize: 11 }}>Type</span>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                          {(['Deposit', 'Progress', 'Final', 'Custom'] as InvoiceType[]).map(t => (
                            <button
                              key={t}
                              onClick={() => {
                                setNewInvType(t)
                                const descMap: Record<InvoiceType, string> = {
                                  Deposit: `Deposit — ${jobTypeName}`,
                                  Progress: `Progress payment — ${jobTypeName}`,
                                  Final: `Final payment — ${jobTypeName}`,
                                  Custom: `${jobTypeName}`,
                                }
                                setNewInvDesc(descMap[t])
                                if (t === 'Final') setNewInvAmount(remaining.toFixed(2))
                              }}
                              style={{
                                flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                                cursor: 'pointer', border: `1px solid ${newInvType === t ? invoiceTypeColors[t] + '66' : C.steel + '33'}`,
                                background: newInvType === t ? invoiceTypeColors[t] + '15' : 'transparent',
                                color: newInvType === t ? invoiceTypeColors[t] : C.steel,
                              }}
                            >
                              {t}
                            </button>
                          ))}
                        </div>

                        {/* Amount */}
                        <span style={{ ...s.fieldLabel, fontSize: 11 }}>Amount (inc. VAT)</span>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={newInvAmount}
                          onChange={e => setNewInvAmount(e.target.value)}
                          placeholder="0.00"
                          style={{ ...inputStyle, marginBottom: 8 }}
                        />

                        {/* Percentage shortcuts */}
                        {quotedTotal > 0 && (
                          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                            {[25, 33, 50, 100].map(pct => (
                              <button
                                key={pct}
                                onClick={() => {
                                  const amt = (quotedTotal * pct) / 100
                                  const adjusted = Math.min(amt, remaining > 0 ? remaining : amt)
                                  setNewInvAmount(adjusted.toFixed(2))
                                }}
                                style={{
                                  flex: 1, padding: '6px 4px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                                  cursor: 'pointer', border: `1px solid ${C.steel}33`,
                                  background: 'transparent', color: C.silver,
                                }}
                              >
                                {pct}%
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Description */}
                        <span style={{ ...s.fieldLabel, fontSize: 11 }}>Description</span>
                        <input
                          type="text"
                          value={newInvDesc}
                          onChange={e => setNewInvDesc(e.target.value)}
                          style={{ ...inputStyle, marginBottom: 14 }}
                        />

                        {/* Create */}
                        <button
                          disabled={!newInvAmount || Number(newInvAmount) <= 0}
                          onClick={() => {
                            const amount = Number(newInvAmount)
                            if (!amount || amount <= 0) return
                            const vatRate = 0.20
                            const net = amount / (1 + vatRate)
                            const vat = amount - net
                            const dueDate = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]

                            addInvoice({
                              jobId: selectedJob.id,
                              quoteId: linkedQuote?.id,
                              customerId: selectedJob.customerId,
                              customerName: selectedJob.customerName,
                              jobTypeName: selectedJob.jobType,
                              description: newInvDesc,
                              type: newInvType,
                              netTotal: Math.round(net * 100) / 100,
                              vat: Math.round(vat * 100) / 100,
                              grandTotal: Math.round(amount * 100) / 100,
                              status: 'Draft',
                              dueDate,
                            })

                            const newTotalInvoiced = totalInvoiced + amount
                            if (selectedJob.status === 'Complete' && newTotalInvoiced >= quotedTotal) {
                              moveJob(selectedJob.id, 'Invoiced')
                              setSelectedJob({ ...selectedJob, status: 'Invoiced' })
                            }

                            setShowAddInvoice(false)
                            setNewInvAmount('')
                            setNewInvDesc('')
                          }}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                            cursor: newInvAmount && Number(newInvAmount) > 0 ? 'pointer' : 'not-allowed',
                            minHeight: 42, background: '#4CAF5015', border: '1px solid #4CAF5044', color: '#4CAF50',
                            opacity: newInvAmount && Number(newInvAmount) > 0 ? 1 : 0.5,
                          }}
                        >
                          <Receipt size={14} /> Create Invoice
                        </button>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          </>
        )
      })()}

      {/* FAB */}
      <button
        style={s.fab}
        title="New Quote"
        onClick={() => navigate('/quote')}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.08)'
          e.currentTarget.style.boxShadow = '0 6px 28px rgba(0,0,0,.5)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,.4)'
        }}
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>
    </div>
  )
}
