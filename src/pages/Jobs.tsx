import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, LayoutGrid, Table, X, FileDown, Send, Link2, Receipt, Pencil, CalendarDays, AlertCircle, Clock, Search, Filter, ChevronRight, Copy, Trash2, Package, FileCheck, Paperclip, FileText, Upload, RefreshCw, CheckCircle } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useTheme } from '../theme/ThemeContext'
import { useData, isEventConfirmed, type JobStatus, type Job, type InvoiceType } from '../data/DataContext'
import { useAuth } from '../auth/AuthContext'
import { generateQuotePDF, generateInvoicePDF, settingsToBusinessInfo } from '../lib/pdf-generator'
import { uploadJobFile, deleteJobFile, getJobAttachments, formatFileSize, type Attachment } from '../lib/file-upload'
import { sendEmail, buildFromName } from '../lib/send-email'
import { buildQuoteEmail, buildInvoiceEmail, buildBookingConfirmationEmail } from '../lib/email-templates'
import { generateICSCalendar } from '../lib/calendar-export'
import { useSubscription } from '../subscription/SubscriptionContext'
import { useUndo } from '../hooks/useUndo'
import { LimitWarning } from '../components/FeatureGate'
import { SkeletonKanban } from '../components/Skeleton'
import ConflictResolverModal from '../components/ConflictResolverModal'
import { useIsMobile } from '../hooks/useIsMobile'

/* ── helpers ── */

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]}`
}

/* ── time helpers (HH:MM ↔ minutes) ── */

const SLOT_DEFAULTS: Record<string, { start: string; end: string }> = {
  morning:   { start: '08:00', end: '12:00' },
  afternoon: { start: '12:00', end: '17:00' },
  full:      { start: '08:00', end: '17:00' },
  quick:     { start: '08:00', end: '09:00' },
}

function parseHHMM(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function formatHHMM(mins: number): string {
  const h = Math.floor(mins / 60) % 24
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Resolve an event's effective start/end times, falling back to slot defaults. */
function eventTimeRange(ev: { slot: string; startTime?: string | null; endTime?: string | null }): { start: number; end: number } {
  const def = SLOT_DEFAULTS[ev.slot] ?? SLOT_DEFAULTS.morning
  return {
    start: parseHHMM(ev.startTime || def.start),
    end:   parseHHMM(ev.endTime   || def.end),
  }
}

function fmtTimeRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return ''
  return `${start}–${end}`
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
  Voided: '#8A8F96',
}

export default function Jobs() {
  const { C } = useTheme()
  const { jobs, quotes, customers, invoices, events, settings, moveJob, updateQuote, updateJob, addJob, addInvoice, updateInvoice, deleteInvoice, getInvoicesForJob, addEvent, updateEvent, deleteEvent, addComm, softDeleteJob, restoreJob, awaitRealId, isDataLoading } = useData()
  const { user } = useAuth()
  const { features, plan } = useSubscription()
  const { showUndo } = useUndo()
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
  // Mobile users default straight into the table (card-list) view —
  // kanban is impractical on a phone screen and the table is the
  // workflow view for managing the day on the go.
  const isMobile = useIsMobile()
  const [view, setView] = useState<'kanban' | 'table' | 'history'>(isMobile ? 'table' : 'kanban')
  // If a desktop user resizes to mobile (or rotates an iPad to portrait
  // and ends up under the breakpoint) while still on kanban, switch them
  // over. Don't auto-switch back when going the other way — let them keep
  // table view if they preferred it.
  useEffect(() => {
    if (isMobile && view === 'kanban') setView('table')
  }, [isMobile, view])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [dragOverCol, setDragOverCol] = useState<JobStatus | null>(null)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleSlot, setScheduleSlot] = useState<'morning' | 'afternoon' | 'full' | 'quick'>('morning')
  // Picked start time for the Quick fit-in slot (HH:MM). Quick events
  // default to a 1-hour duration starting from this value.
  const [quickStartTime, setQuickStartTime] = useState<string>('08:00')
  // Week-strip picker — anchor day of the 7-day window currently shown
  const [scheduleWeekStart, setScheduleWeekStart] = useState<string>(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    const dow = d.getDay() // 0 = Sun ... 6 = Sat
    const offsetToMon = dow === 0 ? -6 : 1 - dow
    d.setDate(d.getDate() + offsetToMon)
    return d.toISOString().split('T')[0]
  })
  // Send-confirmation modal state — mirrors the QuickQuote send flow
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmVia, setConfirmVia] = useState<{ email: boolean; whatsapp: boolean }>({ email: true, whatsapp: false })
  const [confirmSending, setConfirmSending] = useState(false)
  const [confirmSentMsg, setConfirmSentMsg] = useState('')
  // 'initial' = only dispatch events that haven't been sent yet (default).
  // 'resend' = re-dispatch every day on the job, used when the customer can't
  // find the original email.
  const [confirmMode, setConfirmMode] = useState<'initial' | 'resend'>('initial')

  // Add-invoice form state
  const [showAddInvoice, setShowAddInvoice] = useState(false)
  const [newInvType, setNewInvType] = useState<InvoiceType>('Deposit')
  const [newInvAmount, setNewInvAmount] = useState('')
  const [newInvDesc, setNewInvDesc] = useState('')
  const [newInvDueDate, setNewInvDueDate] = useState('')

  // Panel tab state
  const [panelTab, setPanelTab] = useState<'details' | 'quote' | 'payments'>('details')
  const [requoteSuccess, setRequoteSuccess] = useState(false)

  // Materials override — a single actual-cost field that replaces the
  // estimated materials figure on the quote. Detailed breakdown will come
  // from expenses tagged to the job, not from a manual line-item editor.
  const [actualMaterials, setActualMaterials] = useState<string>('')
  const [materialsLoadedFor, setMaterialsLoadedFor] = useState<string | null>(null)
  // Ref to the schedule section so the panel-header warning banner can
  // scroll the user straight to it when they click "Open Schedule".
  const scheduleSectionRef = useRef<HTMLDivElement>(null)
  // Whether the focused conflict-resolver modal is currently open. Lets
  // the user fix calendar clashes without leaving the job panel.
  const [showConflictResolver, setShowConflictResolver] = useState(false)

  // Attachments state
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [attachmentsLoading, setAttachmentsLoading] = useState(false)
  const [uploadCategory, setUploadCategory] = useState('general')
  const [uploadError, setUploadError] = useState('')
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null)

  /* ── select job handler (resets panel tab) ── */
  function selectJob(job: Job) {
    setSelectedJob(job)
    setPanelTab('details')
    setActualMaterials('')
    setMaterialsLoadedFor(null)
    setShowAddInvoice(false)
    setRequoteSuccess(false)
    setUploadError('')
    setPreviewAttachment(null)
    setShowConfirmModal(false)
    setConfirmVia({ email: true, whatsapp: false })
    setConfirmSending(false)
    setConfirmSentMsg('')
    setConfirmMode('initial')
    setScheduleDate('')
    setQuickStartTime('08:00')
    setScheduleSlot('morning')
    setShowConflictResolver(false)
    // Load attachments for this job
    setAttachmentsLoading(true)
    getJobAttachments(job.id)
      .then(a => setAttachments(a))
      .catch(() => setAttachments([]))
      .finally(() => setAttachmentsLoading(false))
  }

  /* ── attachment helpers ── */
  async function handleFileUpload(files: FileList | null) {
    if (!files || !selectedJob || !user) return
    setUploadError('')
    const file = files[0]
    if (!file) return
    try {
      setAttachmentsLoading(true)
      const attachment = await uploadJobFile(user.orgId, selectedJob.id, file, uploadCategory)
      setAttachments(prev => [...prev, attachment])
      setUploadCategory('general')
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed')
    } finally {
      setAttachmentsLoading(false)
    }
  }

  async function handleDeleteAttachment(att: Attachment) {
    if (!window.confirm(`Delete "${att.fileName}"?`)) return
    try {
      await deleteJobFile(att.id, att.filePath)
      setAttachments(prev => prev.filter(a => a.id !== att.id))
    } catch (err: any) {
      setUploadError(err.message || 'Delete failed')
    }
  }

  function isImageFile(fileType: string): boolean {
    return fileType.startsWith('image/')
  }

  /* ── missing info check ── */
  function getJobWarning(job: Job): string | null {
    const hasQuote = !!job.quoteId
    const jobInvoices = getInvoicesForJob(job.id)
    const hasInvoice = jobInvoices.length > 0

    // Quote has been edited (e.g. materials override) since it was last sent —
    // surfaces in the kanban card and the panel header until the user resends.
    if (hasQuote) {
      const linkedQuote = quotes.find(q => q.id === job.quoteId)
      if (linkedQuote?.needsResend) return 'Quote updated — needs resending'
    }

    // One or more scheduled events on this job have been added or modified
    // since the customer was last notified. Triggered for any job status —
    // including Scheduled / In Progress — because a time change after the
    // customer accepted the original schedule needs an updated confirmation.
    const jobEvents = events.filter(e => e.jobId === job.id)
    if (jobEvents.length > 0 && jobEvents.some(e => !isEventConfirmed(e))) {
      return 'Schedule changed — customer needs new confirmation'
    }

    // Unpaid invoices (Deposit, Progress, Custom) on jobs approaching
    // their start date. Any pre-work payment should be collected before
    // the tradesperson turns up — warn 5 days out to give chase time.
    const todayStr = new Date().toISOString().split('T')[0]
    if (['Accepted', 'Scheduled'].includes(job.status)) {
      const unpaidInvoice = jobInvoices.find(i => i.status !== 'Paid')
      if (unpaidInvoice && job.date) {
        const msPerDay = 86400000
        const daysUntilStart = Math.floor(
          (new Date(job.date).getTime() - new Date(todayStr).getTime()) / msPerDay
        )
        const typeLabel = unpaidInvoice.type === 'Deposit' ? 'Deposit'
          : unpaidInvoice.type === 'Progress' ? 'Progress payment'
          : `Invoice ${unpaidInvoice.ref}`
        if (daysUntilStart <= 0) {
          return `${typeLabel} NOT PAID — job starts today`
        } else if (daysUntilStart <= 3) {
          return `${typeLabel} unpaid — job starts in ${daysUntilStart} day${daysUntilStart === 1 ? '' : 's'}`
        } else if (daysUntilStart <= 5) {
          return `Chase ${typeLabel.toLowerCase()} — job starts in ${daysUntilStart} days`
        }
      }
    }

    // Backstop: a job that was scheduled for a date in the past but is
    // still sitting in Scheduled probably needs its status updated. The
    // user might have done the work and forgotten, or it might have been
    // cancelled. Either way, the kanban shouldn't lie about it.
    if (job.status === 'Scheduled' && job.date && job.date < todayStr) {
      return 'Was this job done? Update its status'
    }

    switch (job.status) {
      case 'Quoted':
      case 'Accepted':
        return !hasQuote ? 'No quote linked' : null
      case 'Scheduled':
      case 'In Progress':
        return !job.date ? 'No date set' : null
      case 'Complete':
        return !hasQuote ? 'No quote — cannot invoice' : null
      case 'Invoiced': {
        if (!hasInvoice) return 'No invoice created'
        // Check for overdue invoices
        const overdue = jobInvoices.find(i => i.status !== 'Paid' && i.dueDate && i.dueDate < todayStr)
        if (overdue) return `Invoice ${overdue.ref} is overdue — chase payment`
        return null
      }
      default:
        return null
    }
  }

  /* ── styles ── */
  const s: Record<string, CSSProperties> = {
    page: {
      padding: 'clamp(16px, 4vw, 32px)',
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
      flexWrap: 'wrap' as const,
      gap: 12,
    },
    heading: {
      fontSize: 'clamp(22px, 5vw, 28px)' as any,
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
      gridTemplateColumns: 'repeat(7, minmax(140px, 1fr))',
      gap: 12,
      overflowX: 'auto' as const,
      // Allow horizontal swipe-scrolling on touch devices
      WebkitOverflowScrolling: 'touch' as any,
      scrollSnapType: 'x mandatory' as const,
      paddingBottom: 8,
    },
    column: {
      background: C.black,
      borderRadius: 12,
      padding: 12,
      scrollSnapAlign: 'start' as const,
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
      width: 'min(440px, 100vw)',
      maxWidth: '100vw',
      background: C.charcoal,
      borderLeft: `1px solid ${C.steel}44`,
      zIndex: 100,
      overflowY: 'auto' as const,
      padding: 'clamp(16px, 4vw, 28px)',
      boxShadow: '-8px 0 32px rgba(0,0,0,.5)',
    },
    panelHeader: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 20,
    },
    panelTitle: {
      fontSize: 20,
      fontWeight: 600,
      color: C.white,
      lineHeight: 1.2,
      wordBreak: 'break-word' as const,
    },
    panelSubtitle: {
      fontSize: 13,
      color: C.silver,
      marginTop: 4,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap' as const,
    },
    panelRef: {
      fontSize: 11,
      fontWeight: 600,
      color: C.steel,
      background: `${C.steel}22`,
      padding: '2px 8px',
      borderRadius: 10,
      letterSpacing: 0.5,
      fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
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
        <SkeletonKanban />
      </div>
    )
  }

  return (
    <div style={s.page}>
      {/* header */}
      <div style={s.header}>
        <h1 style={s.heading}>Jobs</h1>
        <div style={s.toggleWrap}>
          {!isMobile && (
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
          )}
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
                    {/* Contextual next-action hint */}
                    {job.status === 'Lead' && (
                      <div
                        style={{ fontSize: 11, color: C.steel, marginTop: 6, cursor: 'pointer' }}
                        onClick={(e) => { e.stopPropagation(); navigate(job.quoteId ? `/quote?quoteId=${job.quoteId}` : '/quote') }}
                      >
                        Quote this job →
                      </div>
                    )}
                    {job.status === 'Quoted' && (
                      <div style={{ fontSize: 11, color: C.steel, marginTop: 6 }}>
                        Waiting for response
                      </div>
                    )}
                    {job.status === 'Accepted' && (
                      <div
                        style={{ fontSize: 11, color: C.steel, marginTop: 6, cursor: 'pointer' }}
                        onClick={(e) => { e.stopPropagation(); selectJob(job) }}
                      >
                        Schedule this job
                      </div>
                    )}
                    {job.status === 'Complete' && (
                      <div
                        style={{ fontSize: 11, color: C.steel, marginTop: 6, cursor: 'pointer' }}
                        onClick={(e) => { e.stopPropagation(); selectJob(job); setPanelTab('payments') }}
                      >
                        Create invoice
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* table view */}
      {view === 'table' && !isMobile && (
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
                  <td style={{ ...s.td, color: C.gold, fontWeight: 600 }}>#{job.id.slice(-6).toUpperCase()}</td>
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

      {/* Mobile table view — card list. Each row is a tappable card
          showing customer + status on top, type + date + short ref in
          the middle, and value + warning on the bottom. Job # references
          collapse to a 6-char tail (#3EAB67) so they don't dominate. */}
      {view === 'table' && isMobile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {jobs.filter(j => j.status !== 'Paid').length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: C.steel, fontSize: 13 }}>
              No active jobs.
            </div>
          )}
          {jobs.filter(j => j.status !== 'Paid').map((job) => {
            const warning = getJobWarning(job)
            const shortRef = `#${job.id.slice(-6).toUpperCase()}`
            return (
              <div
                key={job.id}
                onClick={() => selectJob(job)}
                style={{
                  background: C.charcoalLight,
                  borderLeft: `3px solid ${statusColor[job.status]}`,
                  borderRadius: 10,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                {/* Top line: customer name + status */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 8,
                }}>
                  <div style={{
                    fontSize: 15, fontWeight: 700, color: C.white,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1,
                  }}>
                    {warning && (
                      <AlertCircle size={14} color="#D46A6A" style={{ flexShrink: 0 }} />
                    )}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{job.customerName}</span>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 10,
                    color: statusColor[job.status],
                    background: statusColor[job.status] + '1A',
                    textTransform: 'uppercase', letterSpacing: 0.5,
                    flexShrink: 0, whiteSpace: 'nowrap',
                  }}>
                    {job.status}
                  </span>
                </div>

                {/* Middle line: type + date + short ref */}
                <div style={{
                  fontSize: 12, color: C.silver,
                  display: 'flex', alignItems: 'center', gap: 8,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {job.jobType !== 'TBC' ? job.jobType : (() => {
                      const q = job.quoteId ? quotes.find(qq => qq.id === job.quoteId) : undefined
                      return q?.jobTypeName || 'TBC'
                    })()}
                  </span>
                  <span style={{ color: C.steel }}>·</span>
                  <span>{fmtDate(job.date)}</span>
                  <span style={{ color: C.steel }}>·</span>
                  <span style={{
                    fontSize: 10, color: C.steel, fontFamily: 'ui-monospace, monospace',
                  }}>{shortRef}</span>
                </div>

                {/* Bottom line: value + warning text */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 8,
                }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.gold }}>
                    {fmtCurrency(job.value > 0 ? job.value : (() => {
                      const q = job.quoteId ? quotes.find(qq => qq.id === job.quoteId) : undefined
                      return q?.netTotal || 0
                    })())}
                  </span>
                  {warning && (
                    <span style={{
                      fontSize: 10, color: '#D46A6A', fontWeight: 600,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      maxWidth: '60%',
                    }}>
                      {warning}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
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
          ) : isMobile ? (
            /* Mobile: card list — same pattern as the active jobs mobile view */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filteredHistory.map(job => {
                const jobType = job.jobType !== 'TBC' ? job.jobType : (() => { const q = job.quoteId ? quotes.find(qq => qq.id === job.quoteId) : undefined; return q?.jobTypeName || 'TBC' })()
                const value = job.value > 0 ? job.value : (() => { const q = job.quoteId ? quotes.find(qq => qq.id === job.quoteId) : undefined; return q?.netTotal || 0 })()
                const lastPaidInv = invoices.filter(i => i.jobId === job.id && i.status === 'Paid' && i.paidAt).sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''))[0]
                return (
                  <div
                    key={job.id}
                    onClick={() => selectJob(job)}
                    style={{
                      background: C.charcoalLight, borderRadius: 10,
                      borderLeft: `3px solid #4CAF50`,
                      padding: '10px 12px', cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.white }}>{job.customerName}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.gold }}>{fmtCurrency(value)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.silver, marginTop: 3 }}>
                      {jobType} · <span style={{ fontFamily: 'ui-monospace, monospace', color: C.steel }}>#{job.id.slice(-6).toUpperCase()}</span>
                    </div>
                    <div style={{ fontSize: 10, color: C.steel, marginTop: 2, display: 'flex', gap: 12 }}>
                      <span>Work: {fmtDate(job.date)}</span>
                      {lastPaidInv?.paidAt && <span>Paid: {fmtDate(lastPaidInv.paidAt)}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* Desktop: clean table with short refs */
            <div style={{ borderRadius: 12, overflow: 'hidden' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Ref</th>
                    <th style={s.th}>Customer</th>
                    <th style={s.th}>Type</th>
                    <th style={s.th}>Value</th>
                    <th style={s.th}>Work Date</th>
                    <th style={s.th}>Paid</th>
                    <th style={{ ...s.th, width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map(job => {
                    const lastPaidInv = invoices.filter(i => i.jobId === job.id && i.status === 'Paid' && i.paidAt).sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''))[0]
                    return (
                    <tr
                      key={job.id}
                      style={s.tableRow}
                      onClick={() => selectJob(job)}
                      onMouseEnter={e => { e.currentTarget.style.background = C.steel + '22' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <td style={{ ...s.td, fontFamily: 'ui-monospace, monospace', fontSize: 12, color: C.steel }}>#{job.id.slice(-6).toUpperCase()}</td>
                      <td style={{ ...s.td, fontWeight: 500 }}>
                        {job.customerName}
                        {(() => { const cust = customers.find(c => c.id === job.customerId); return cust?.postcode ? <span style={{ color: C.steel, fontWeight: 400, marginLeft: 6, fontSize: 12 }}>{cust.postcode}</span> : null })()}
                      </td>
                      <td style={s.td}>{job.jobType !== 'TBC' ? job.jobType : (() => { const q = job.quoteId ? quotes.find(qq => qq.id === job.quoteId) : undefined; return q?.jobTypeName || 'TBC' })()}</td>
                      <td style={{ ...s.td, fontWeight: 600, color: C.gold }}>{fmtCurrency(job.value > 0 ? job.value : (() => { const q = job.quoteId ? quotes.find(qq => qq.id === job.quoteId) : undefined; return q?.netTotal || 0 })())}</td>
                      <td style={{ ...s.td, color: C.silver }}>{fmtDate(job.date)}</td>
                      <td style={{ ...s.td, color: '#4CAF50', fontSize: 12 }}>{lastPaidInv?.paidAt ? fmtDate(lastPaidInv.paidAt) : '—'}</td>
                      <td style={s.td}><ChevronRight size={14} color={C.steel} /></td>
                    </tr>
                    )
                  })}
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
        const activeInvoices = jobInvoices.filter(i => i.status !== 'Voided')
        const voidedPaidInvoices = jobInvoices.filter(i => i.status === 'Voided' && i.paidAt)
        const quotedTotal = linkedQuote?.grandTotal ?? selectedJob.value
        // Active totals — voided invoices don't count toward invoiced/paid
        const totalInvoiced = activeInvoices.reduce((sum, i) => sum + i.grandTotal, 0)
        const totalPaid = activeInvoices.filter(i => i.status === 'Paid').reduce((sum, i) => sum + i.grandTotal, 0)
        // Customer credit from voided invoices that were already paid —
        // this money is in the bank and needs to be offset against the next
        // invoice or refunded.
        const customerCredit = voidedPaidInvoices.reduce((sum, i) => sum + i.grandTotal, 0)
        const remaining = Math.max(0, quotedTotal - totalInvoiced - customerCredit)

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
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={s.panelTitle}>{selectedJob.customerName}</div>
                  <div style={s.panelSubtitle}>
                    <span>{selectedJob.jobType}</span>
                    <span style={s.panelRef}>#{selectedJob.id.slice(-6).toUpperCase()}</span>
                  </div>
                </div>
                <button style={s.closeBtn} onClick={() => setSelectedJob(null)}>
                  <X size={22} />
                </button>
              </div>

              {/* ── Job Paid celebration — replaces the normal panel
                  content when the job reaches its final state so the
                  transition feels like a milestone, not a disappearance. ── */}
              {selectedJob.status === 'Paid' && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '40px 20px 32px', textAlign: 'center',
                }}>
                  {/* Animated checkmark ring */}
                  <div style={{
                    width: 80, height: 80, borderRadius: '50%',
                    background: '#4CAF5015',
                    border: '3px solid #4CAF50',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 20,
                    animation: 'paidPulse 1.5s ease-in-out',
                  }}>
                    <CheckCircle size={40} color="#4CAF50" />
                  </div>
                  <style>{`
                    @keyframes paidPulse {
                      0% { transform: scale(0.5); opacity: 0; }
                      50% { transform: scale(1.1); }
                      100% { transform: scale(1); opacity: 1; }
                    }
                    @keyframes paidFadeIn {
                      0% { opacity: 0; transform: translateY(8px); }
                      100% { opacity: 1; transform: translateY(0); }
                    }
                  `}</style>

                  <div style={{
                    fontSize: 22, fontWeight: 700, color: '#4CAF50', marginBottom: 6,
                    animation: 'paidFadeIn .5s ease .3s both',
                  }}>
                    Job Paid
                  </div>
                  <div style={{
                    fontSize: 14, color: C.silver, marginBottom: 24,
                    animation: 'paidFadeIn .5s ease .5s both',
                  }}>
                    {selectedJob.customerName} — {selectedJob.jobType}
                  </div>

                  {/* Summary stats */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
                    width: '100%', maxWidth: 280, marginBottom: 28,
                    animation: 'paidFadeIn .5s ease .6s both',
                  }}>
                    <div style={{
                      background: C.black, borderRadius: 10, padding: '14px 12px', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: C.gold }}>
                        {fmtCurrency(selectedJob.value)}
                      </div>
                      <div style={{ fontSize: 11, color: C.steel }}>Total Value</div>
                    </div>
                    <div style={{
                      background: C.black, borderRadius: 10, padding: '14px 12px', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: C.gold }}>
                        {selectedJob.estimatedHours}h
                      </div>
                      <div style={{ fontSize: 11, color: C.steel }}>
                        {selectedJob.actualHours != null ? `Actual: ${selectedJob.actualHours}h` : 'Est. Hours'}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    fontSize: 13, color: C.steel, marginBottom: 24,
                    animation: 'paidFadeIn .5s ease .7s both',
                  }}>
                    This job has moved to History. You can find it under the History tab or in the customer's profile.
                  </div>

                  <div style={{
                    display: 'flex', gap: 10, width: '100%', maxWidth: 300,
                    animation: 'paidFadeIn .5s ease .8s both',
                  }}>
                    <button
                      onClick={() => { setSelectedJob(null); setView('history') }}
                      style={{
                        flex: 1, padding: '12px', borderRadius: 10,
                        background: 'transparent', border: `1px solid ${C.steel}66`,
                        color: C.silver, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        minHeight: 44,
                      }}
                    >
                      View History
                    </button>
                    <button
                      onClick={() => { setSelectedJob(null); navigate('/quote') }}
                      style={{
                        flex: 1, padding: '12px', borderRadius: 10,
                        background: `${C.gold}15`, border: `1px solid ${C.gold}66`,
                        color: C.gold, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        minHeight: 44,
                      }}
                    >
                      New Quote
                    </button>
                  </div>
                </div>
              )}

              {/* ── Normal panel content (hidden when Paid) ── */}
              {selectedJob.status !== 'Paid' && <>

              {/* Actionable warning banner — names the issue and jumps to the
                  relevant tab so the user knows exactly what to do next. The
                  whole banner is the click target when an action is available. */}
              {(() => {
                const warning = getJobWarning(selectedJob)
                if (!warning) return null
                let cta: { label: string; action: () => void } | null = null
                if (warning.includes('Quote') || warning.includes('quote')) {
                  cta = { label: 'Open Quote', action: () => setPanelTab('quote') }
                } else if (warning.includes('Schedule') || warning.includes('schedule') || warning.includes('date') || warning.includes('Date')) {
                  cta = {
                    label: 'Open Schedule',
                    action: () => {
                      setPanelTab('details')
                      // Wait a tick for the tab switch to render before scrolling.
                      setTimeout(() => {
                        scheduleSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }, 0)
                    },
                  }
                } else if (warning.includes('invoice')) {
                  cta = { label: 'Open Payments', action: () => setPanelTab('payments') }
                }
                return (
                  <div
                    role={cta ? 'button' : undefined}
                    tabIndex={cta ? 0 : undefined}
                    onClick={cta?.action}
                    onKeyDown={cta ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cta!.action() } } : undefined}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', borderRadius: 10, marginBottom: 16,
                      background: '#D46A6A12', border: '1px solid #D46A6A44',
                      cursor: cta ? 'pointer' : 'default',
                    }}
                    onMouseEnter={cta ? (e) => { e.currentTarget.style.background = '#D46A6A1F' } : undefined}
                    onMouseLeave={cta ? (e) => { e.currentTarget.style.background = '#D46A6A12' } : undefined}
                  >
                    <AlertCircle size={16} color="#D46A6A" style={{ flexShrink: 0 }} />
                    <div style={{ fontSize: 12, color: C.silver, flex: 1, lineHeight: 1.4 }}>
                      {warning}
                      {cta && (
                        <span style={{ color: '#D46A6A', fontWeight: 600, marginLeft: 8 }}>
                          {cta.label} →
                        </span>
                      )}
                    </div>
                  </div>
                )
              })()}

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
                  <div style={s.detailRow}>
                    <div>
                      <span style={s.fieldLabel}>Value</span>
                      <div style={{ ...s.fieldValue, color: C.gold, fontSize: 20, fontWeight: 700 }}>{fmtCurrency(selectedJob.value)}</div>
                    </div>
                    <div>
                      <span style={s.fieldLabel}>Date</span>
                      <div style={s.fieldValue}>{fmtDate(selectedJob.date)}</div>
                    </div>
                  </div>

                  <div style={s.detailRow}>
                    <div>
                      <span style={s.fieldLabel}>Status</span>
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ position: 'relative' }}>
                          <select
                            value={selectedJob.status}
                            onChange={e => {
                              let newStatus = e.target.value as JobStatus

                              // Auto-advance: if moving to Invoiced (or Complete)
                              // and all active invoices are already Paid, advance
                              // to the next logical state so the job doesn't get
                              // stuck. Only fires for billing-phase statuses —
                              // pre-work statuses never auto-advance because
                              // "paid" doesn't mean "work done".
                              if (newStatus === 'Invoiced' && activeInvoices.length > 0) {
                                const allPaid = activeInvoices.every(i => i.status === 'Paid')
                                if (allPaid) newStatus = 'Paid'
                              }
                              if (newStatus === 'Complete' && activeInvoices.length > 0) {
                                const allPaid = activeInvoices.every(i => i.status === 'Paid')
                                const totalInv = activeInvoices.reduce((s, i) => s + i.grandTotal, 0)
                                if (allPaid && totalInv >= quotedTotal) newStatus = 'Paid'
                              }

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
                              <option key={col} value={col} style={{ color: C.white, background: C.black }}>{col}</option>
                            ))}
                          </select>
                          <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: C.steel }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <span style={s.fieldLabel}>Est. Hours</span>
                      <div style={s.fieldValue}>{selectedJob.estimatedHours}h</div>
                    </div>
                  </div>

                  {/* ── Workflow actions — guided forward/revert buttons ──
                      These are the one-tap pipeline controls. The forward
                      button is the primary "next step" action; the revert
                      link goes one step back. The status dropdown above
                      stays as a power-user escape hatch for jumping
                      multiple steps or fixing data. */}
                  {(() => {
                    const todayStr = new Date().toISOString().split('T')[0]
                    const st = selectedJob.status

                    // ── Forward action for each status ──
                    type FwdAction = { label: string; icon: string; action: () => void; gated?: boolean } | null
                    let forward: FwdAction = null
                    if (st === 'Lead') {
                      forward = {
                        label: 'Create Quote',
                        icon: '📝',
                        action: () => { setSelectedJob(null); navigate(selectedJob.quoteId ? `/quote?quoteId=${selectedJob.quoteId}` : '/quote') },
                      }
                    } else if (st === 'Scheduled' && selectedJob.date <= todayStr) {
                      const unpaidPre = getInvoicesForJob(selectedJob.id).find(i => i.status !== 'Paid')
                      forward = {
                        label: unpaidPre
                          ? `Start (${unpaidPre.type === 'Deposit' ? 'deposit' : 'invoice'} unpaid)`
                          : 'Start this job now',
                        icon: unpaidPre ? '⚠' : '▶',
                        action: () => {
                          if (unpaidPre) {
                            const ok = window.confirm(
                              `${unpaidPre.type === 'Deposit' ? 'Deposit' : `Invoice ${unpaidPre.ref}`} hasn't been paid yet.\n\nStart the job anyway?`
                            )
                            if (!ok) return
                          }
                          const ts = new Date().toISOString()
                          updateJob(selectedJob.id, { startedAt: ts })
                          moveJob(selectedJob.id, 'In Progress')
                          setSelectedJob({ ...selectedJob, status: 'In Progress', startedAt: ts })
                        },
                      }
                    } else if (st === 'In Progress') {
                      forward = {
                        label: 'Mark as complete',
                        icon: '✓',
                        action: () => {
                          moveJob(selectedJob.id, 'Complete')
                          setSelectedJob({ ...selectedJob, status: 'Complete' })
                        },
                      }
                    } else if (st === 'Complete') {
                      forward = {
                        label: 'Create invoice',
                        icon: '📄',
                        action: () => setPanelTab('payments'),
                      }
                    }

                    // ── Revert — one step back ──
                    const revertMap: Partial<Record<JobStatus, { label: string; target: JobStatus }>> = {
                      Quoted:        { label: 'Back to Lead',        target: 'Lead' },
                      Accepted:      { label: 'Back to Quoted',      target: 'Quoted' },
                      Scheduled:     { label: 'Back to Accepted',    target: 'Accepted' },
                      'In Progress': { label: 'Back to Scheduled',   target: 'Scheduled' },
                      Complete:      { label: 'Back to In Progress', target: 'In Progress' },
                      Invoiced:      { label: 'Back to Complete',    target: 'Complete' },
                      Paid:          { label: 'Back to Invoiced',    target: 'Invoiced' },
                    }
                    const revert = revertMap[st]

                    if (!forward && !revert) return null

                    return (
                      <div style={{ marginBottom: 16 }}>
                        {forward && (
                          <button
                            onClick={forward.action}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                              padding: '12px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                              cursor: 'pointer', minHeight: 44,
                              background: `${C.gold}15`, border: `1px solid ${C.gold}66`, color: C.gold,
                            }}
                          >
                            {forward.icon} {forward.label}
                          </button>
                        )}
                        {revert && (
                          <button
                            onClick={() => {
                              moveJob(selectedJob.id, revert.target)
                              setSelectedJob({ ...selectedJob, status: revert.target })
                            }}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                              padding: '6px', borderRadius: 8, marginTop: forward ? 6 : 0,
                              background: 'transparent', border: 'none',
                              color: C.steel, cursor: 'pointer', fontSize: 11, fontWeight: 500,
                            }}
                            onMouseEnter={e => { e.currentTarget.style.color = C.silver }}
                            onMouseLeave={e => { e.currentTarget.style.color = C.steel }}
                          >
                            ← {revert.label}
                          </button>
                        )}
                      </div>
                    )
                  })()}

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

                  {/* ── Recurring Job ── */}
                  {(['Complete', 'Paid'] as JobStatus[]).includes(selectedJob.status) && (() => {
                    const isRecurring = selectedJob.isRecurring ?? false
                    const rule = selectedJob.recurrenceRule || 'annual'
                    const customMonths = selectedJob.recurrenceIntervalMonths || 12

                    function computeNextDate(baseDate: string, ruleVal: string, months: number): string {
                      const d = new Date(baseDate)
                      const intervalMonths = ruleVal === 'annual' ? 12 : ruleVal === 'quarterly' ? 3 : ruleVal === 'monthly' ? 1 : months
                      d.setMonth(d.getMonth() + intervalMonths)
                      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                    }

                    const nextDate = selectedJob.nextRecurrenceDate || (isRecurring ? computeNextDate(selectedJob.date, rule, customMonths) : '')

                    return (
                      <div style={{ marginTop: 8, paddingTop: 16, borderTop: `1px solid ${C.steel}33` }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <RefreshCw size={16} color={C.gold} />
                            <span style={{ fontSize: 14, fontWeight: 600, color: C.white }}>Recurring</span>
                          </div>
                          <button
                            onClick={() => {
                              const newRecurring = !isRecurring
                              const updates: Partial<Job> = { isRecurring: newRecurring }
                              if (newRecurring) {
                                updates.recurrenceRule = rule
                                const interval = rule === 'annual' ? 12 : rule === 'quarterly' ? 3 : rule === 'monthly' ? 1 : customMonths
                                updates.recurrenceIntervalMonths = interval
                                updates.nextRecurrenceDate = computeNextDate(selectedJob.date, rule, customMonths)
                              } else {
                                updates.recurrenceRule = undefined
                                updates.recurrenceIntervalMonths = undefined
                                updates.nextRecurrenceDate = undefined
                              }
                              updateJob(selectedJob.id, updates)
                              setSelectedJob({ ...selectedJob, ...updates })
                            }}
                            style={{
                              width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                              background: isRecurring ? C.gold : `${C.steel}44`,
                              position: 'relative', transition: 'background .2s',
                            }}
                          >
                            <div style={{
                              width: 18, height: 18, borderRadius: 9, background: '#fff',
                              position: 'absolute', top: 3,
                              left: isRecurring ? 23 : 3,
                              transition: 'left .2s',
                            }} />
                          </button>
                        </div>

                        {isRecurring && (
                          <div style={{ background: C.black, borderRadius: 10, padding: '14px 16px' }}>
                            <span style={{ ...s.fieldLabel, fontSize: 11 }}>Frequency</span>
                            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                              {(['annual', 'quarterly', 'monthly', 'custom'] as const).map(opt => (
                                <button
                                  key={opt}
                                  onClick={() => {
                                    const interval = opt === 'annual' ? 12 : opt === 'quarterly' ? 3 : opt === 'monthly' ? 1 : customMonths
                                    const nd = computeNextDate(selectedJob.date, opt, interval)
                                    updateJob(selectedJob.id, { recurrenceRule: opt, recurrenceIntervalMonths: interval, nextRecurrenceDate: nd })
                                    setSelectedJob({ ...selectedJob, recurrenceRule: opt, recurrenceIntervalMonths: interval, nextRecurrenceDate: nd })
                                  }}
                                  style={{
                                    flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                                    cursor: 'pointer',
                                    border: `1px solid ${rule === opt ? C.gold + '66' : C.steel + '33'}`,
                                    background: rule === opt ? `${C.gold}15` : 'transparent',
                                    color: rule === opt ? C.gold : C.steel,
                                    textTransform: 'capitalize',
                                  }}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>

                            {rule === 'custom' && (
                              <div style={{ marginBottom: 12 }}>
                                <span style={{ ...s.fieldLabel, fontSize: 11 }}>Months between recurrences</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={60}
                                  value={customMonths}
                                  onChange={e => {
                                    const months = Math.max(1, Number(e.target.value) || 1)
                                    const nd = computeNextDate(selectedJob.date, 'custom', months)
                                    updateJob(selectedJob.id, { recurrenceIntervalMonths: months, nextRecurrenceDate: nd })
                                    setSelectedJob({ ...selectedJob, recurrenceIntervalMonths: months, nextRecurrenceDate: nd })
                                  }}
                                  style={{
                                    width: '100%', padding: '10px 12px', borderRadius: 10,
                                    background: C.charcoal, border: `1px solid ${C.steel}33`,
                                    color: C.white, fontSize: 14, outline: 'none',
                                    boxSizing: 'border-box' as const,
                                  }}
                                />
                              </div>
                            )}

                            {nextDate && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', marginBottom: 8 }}>
                                <span style={{ fontSize: 13, color: C.silver }}>Next:</span>
                                <span style={{ fontSize: 14, fontWeight: 600, color: C.gold }}>{fmtDate(nextDate)}</span>
                              </div>
                            )}

                            <button
                              onClick={() => {
                                const newJob = addJob({
                                  customerId: selectedJob.customerId,
                                  customerName: selectedJob.customerName,
                                  quoteId: selectedJob.quoteId,
                                  jobType: selectedJob.jobType,
                                  value: selectedJob.value,
                                  estimatedHours: selectedJob.estimatedHours,
                                  status: 'Lead',
                                  date: nextDate,
                                  notes: selectedJob.notes,
                                  parentJobId: selectedJob.id,
                                  isRecurring: true,
                                  recurrenceRule: rule,
                                  recurrenceIntervalMonths: rule === 'annual' ? 12 : rule === 'quarterly' ? 3 : rule === 'monthly' ? 1 : customMonths,
                                })
                                // Update next recurrence date on current job
                                const interval = rule === 'annual' ? 12 : rule === 'quarterly' ? 3 : rule === 'monthly' ? 1 : customMonths
                                const newNextDate = computeNextDate(nextDate, rule, interval)
                                updateJob(selectedJob.id, { nextRecurrenceDate: newNextDate })
                                setSelectedJob({ ...selectedJob, nextRecurrenceDate: newNextDate })
                                alert(`Next occurrence created for ${fmtDate(nextDate)} — check the Jobs board.`)
                              }}
                              style={{
                                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                                cursor: 'pointer', minHeight: 42,
                                background: `${C.gold}15`, border: `1px solid ${C.gold}44`, color: C.gold,
                              }}
                            >
                              <RefreshCw size={14} /> Create Next Occurrence
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* ── Schedule Job ── */}
                  {(selectedJob.status === 'Accepted' || selectedJob.status === 'Scheduled' || selectedJob.status === 'In Progress') && (() => {
                    const jobEvents = events.filter(e => e.jobId === selectedJob.id).sort((a, b) => a.date.localeCompare(b.date))
                    const unconfirmedEvents = jobEvents.filter(e => !isEventConfirmed(e))
                    const slotLabels: Record<string, string> = { morning: 'Morning', afternoon: 'Afternoon', full: 'Full Day', quick: 'Quick (<1h)' }
                    const customer = customers.find(c => c.id === selectedJob.customerId)

                    // Build the 7-day strip from scheduleWeekStart
                    const weekDays: string[] = Array.from({ length: 7 }, (_, i) => {
                      const d = new Date(scheduleWeekStart)
                      d.setDate(d.getDate() + i)
                      return d.toISOString().split('T')[0]
                    })
                    const todayStr = new Date().toISOString().split('T')[0]
                    const weekEndStr = weekDays[6]
                    const weekRangeLabel = (() => {
                      const a = new Date(weekDays[0])
                      const b = new Date(weekDays[6])
                      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                      return `${a.getDate()} ${months[a.getMonth()]} – ${b.getDate()} ${months[b.getMonth()]}`
                    })()
                    const dayHeaders = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
                    // For each day in the visible week, work out which slots are taken.
                    // AM and PM are the half-day blocks (rendered as pips). 'quick' events
                    // are sub-1hr fit-ins that don't reserve a half-day, so they get their
                    // own count rendered as a small "+N" badge alongside the pips.
                    const slotsPerDay: Record<string, { am: boolean; pm: boolean; quick: number }> = {}
                    for (const ev of events) {
                      if (ev.date >= weekDays[0] && ev.date <= weekEndStr) {
                        const cur = slotsPerDay[ev.date] ?? { am: false, pm: false, quick: 0 }
                        if (ev.slot === 'morning' || ev.slot === 'full') cur.am = true
                        if (ev.slot === 'afternoon' || ev.slot === 'full') cur.pm = true
                        if (ev.slot === 'quick') cur.quick += 1
                        slotsPerDay[ev.date] = cur
                      }
                    }
                    const selectedDayContext = scheduleDate ? events.filter(e => e.date === scheduleDate && e.jobId !== selectedJob.id && !e.category) : []
                    // Which half-day slots are already taken on the picked day
                    // by other CUSTOMER jobs. Drives the slot disable logic so
                    // the user can't double-book a customer slot. Internal
                    // events (travel/admin/etc) don't block customer scheduling
                    // — customer work takes precedence over the user's own
                    // time blocks, and any overlap is surfaced as a soft
                    // conflict warning instead.
                    const eventsOnPickedDay = scheduleDate ? events.filter(e => e.date === scheduleDate && !e.category) : []
                    const morningTaken = eventsOnPickedDay.some(e => e.slot === 'morning' || e.slot === 'full')
                    const afternoonTaken = eventsOnPickedDay.some(e => e.slot === 'afternoon' || e.slot === 'full')
                    const fullTaken = eventsOnPickedDay.some(e => e.slot === 'morning' || e.slot === 'afternoon' || e.slot === 'full')

                    // Internal events (travel/admin/etc) that overlap any of
                    // this job's scheduled events. Surfaced as a soft conflict
                    // warning — the user can still send the confirmation but
                    // is nagged to review the overlap first.
                    const SLOT_DEFAULT_TIMES: Record<string, { start: string; end: string }> = {
                      morning:   { start: '08:00', end: '12:00' },
                      afternoon: { start: '12:00', end: '17:00' },
                      full:      { start: '08:00', end: '17:00' },
                      quick:     { start: '08:00', end: '09:00' },
                    }
                    const eventMinutes = (ev: typeof jobEvents[number]) => {
                      const def = SLOT_DEFAULT_TIMES[ev.slot] ?? SLOT_DEFAULT_TIMES.morning
                      const parse = (s: string) => {
                        const [h, m] = s.split(':').map(Number)
                        return (h || 0) * 60 + (m || 0)
                      }
                      return {
                        startMin: parse(ev.startTime || def.start),
                        endMin: parse(ev.endTime || def.end),
                      }
                    }
                    const internalConflicts: Array<{ jobEvent: typeof jobEvents[number]; internal: typeof jobEvents[number] }> = []
                    for (const je of jobEvents) {
                      const jeRange = eventMinutes(je)
                      const overlapping = events.filter(other =>
                        !!other.category
                        && other.date === je.date
                        && (() => {
                          const r = eventMinutes(other)
                          return r.startMin < jeRange.endMin && r.endMin > jeRange.startMin
                        })()
                      )
                      for (const o of overlapping) internalConflicts.push({ jobEvent: je, internal: o })
                    }

                    const shiftWeek = (delta: number) => {
                      const d = new Date(scheduleWeekStart)
                      d.setDate(d.getDate() + delta)
                      setScheduleWeekStart(d.toISOString().split('T')[0])
                    }
                    const goToToday = () => {
                      const d = new Date()
                      d.setHours(0,0,0,0)
                      const dow = d.getDay()
                      const offsetToMon = dow === 0 ? -6 : 1 - dow
                      d.setDate(d.getDate() + offsetToMon)
                      setScheduleWeekStart(d.toISOString().split('T')[0])
                      setScheduleDate(todayStr)
                    }

                    const dayBtnStyle = (date: string): CSSProperties => {
                      const isPast = date < todayStr
                      const isToday = date === todayStr
                      const isSelected = date === scheduleDate
                      const slots = slotsPerDay[date]
                      const hasAny = slots && (slots.am || slots.pm || slots.quick > 0)
                      return {
                        flex: 1, minWidth: 0,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                        padding: '8px 4px', borderRadius: 10,
                        background: isSelected ? C.gold : (hasAny ? `${C.gold}10` : C.black),
                        border: isSelected
                          ? `1px solid ${C.gold}`
                          : (isToday ? `1px solid ${C.gold}66` : `1px solid ${C.steel}22`),
                        color: isSelected ? C.charcoal : (isPast ? C.steel : C.white),
                        cursor: isPast ? 'not-allowed' : 'pointer',
                        opacity: isPast ? 0.4 : 1,
                        transition: 'background .15s, transform .1s',
                      }
                    }

                    // Adding a day is now a purely local action — no email, no
                    // column move. The user batches up days and only triggers the
                    // customer email via the explicit "Send confirmation" modal.
                    const handleAddDay = () => {
                      if (!scheduleDate) return

                      // Belt-and-braces: refuse to add a half-day slot that's
                      // already taken on this day. The slot button is also
                      // disabled in the UI but defend at the call site too.
                      if (scheduleSlot === 'morning' && morningTaken) return
                      if (scheduleSlot === 'afternoon' && afternoonTaken) return
                      if (scheduleSlot === 'full' && fullTaken) return

                      const jobType = selectedJob.jobType !== 'TBC'
                        ? selectedJob.jobType
                        : (selectedJob.quoteId ? quotes.find(q => q.id === selectedJob.quoteId)?.jobTypeName || '' : '')

                      // For Quick slots, work out the start/end times and shrink
                      // any conflicting half-day events on the same day to make
                      // room. For half-day slots, the times stay null and the
                      // .ics generator falls back to the slot defaults.
                      let startTime: string | null = null
                      let endTime: string | null = null

                      if (scheduleSlot === 'quick') {
                        const startMins = parseHHMM(quickStartTime)
                        const endMins = startMins + 60 // 1-hour default duration
                        startTime = formatHHMM(startMins)
                        endTime = formatHHMM(endMins)

                        // Auto-shrink any conflicting half-day events on the same day.
                        // Quicks can stack with each other (each is independent), so
                        // we only shrink morning/afternoon/full.
                        for (const ev of eventsOnPickedDay) {
                          if (ev.slot === 'quick') continue
                          const range = eventTimeRange(ev)
                          // No overlap → skip
                          if (endMins <= range.start || startMins >= range.end) continue

                          // Quick fully covers the existing event — would obliterate
                          // it. Refuse and bail. Slot disable logic should usually
                          // prevent this from being reachable in the first place.
                          if (startMins <= range.start && endMins >= range.end) {
                            alert(`Can't add a quick fit-in here — it would replace the entire ${slotLabels[ev.slot]} block. Remove that slot first if you want to free the time.`)
                            return
                          }

                          // Trim toward the closest side. For a quick at the start
                          // of an existing block, push the existing's start to the
                          // quick's end. Otherwise (end or middle), shrink the
                          // existing's end to the quick's start.
                          if (startMins <= range.start) {
                            updateEvent(ev.id, { startTime: formatHHMM(endMins), endTime: formatHHMM(range.end) })
                          } else {
                            updateEvent(ev.id, { startTime: formatHHMM(range.start), endTime: formatHHMM(startMins) })
                          }
                        }
                      }

                      addEvent({
                        jobId: selectedJob.id,
                        customerId: selectedJob.customerId,
                        customerName: selectedJob.customerName,
                        jobType,
                        date: scheduleDate,
                        slot: scheduleSlot,
                        status: 'Scheduled',
                        notes: '',
                        startTime,
                        endTime,
                      })

                      // Update job's anchor date to the earliest scheduled date so
                      // the kanban card shows the right day. We do NOT move the job
                      // to the Scheduled column — that only happens once the
                      // customer accepts (via Mark as confirmed or kanban drag).
                      const allDates = [...jobEvents.map(e => e.date), scheduleDate].sort()
                      updateJob(selectedJob.id, { date: allDates[0] })
                      setSelectedJob({ ...selectedJob, date: allDates[0] })
                      setScheduleDate('')
                    }

                    // Build the multi-event ICS payload + customer message body.
                    // Used by both the Email and WhatsApp send paths.
                    const buildScheduleSummary = () => {
                      const lines = unconfirmedEvents.map(ev => `• ${fmtDate(ev.date)} — ${slotLabels[ev.slot]}`).join('\n')
                      return lines
                    }

                    // Resolve which events the modal will dispatch — either
                    // just the unsent ones (initial send) or every day on the
                    // job (resend, used when the customer's lost the original).
                    const eventsForSend = confirmMode === 'resend' ? jobEvents : unconfirmedEvents

                    const handleSendConfirmation = async () => {
                      if (eventsForSend.length === 0) return
                      if (!confirmVia.email && !confirmVia.whatsapp) return
                      setConfirmSending(true)

                      const biz = settings.business
                      const jobType = selectedJob.jobType !== 'TBC'
                        ? selectedJob.jobType
                        : (selectedJob.quoteId ? quotes.find(q => q.id === selectedJob.quoteId)?.jobTypeName || '' : '')
                      const sendSummary = eventsForSend
                        .map(ev => `• ${fmtDate(ev.date)} — ${slotLabels[ev.slot]}`)
                        .join('\n')
                      const subjectPrefix = confirmMode === 'resend' ? 'Reminder: ' : ''

                      // ── Email path ──
                      if (confirmVia.email && customer?.email && user?.orgId) {
                        try {
                          // One .ics file containing every event being dispatched
                          const ics = generateICSCalendar(eventsForSend, customers)
                          const firstEv = eventsForSend[0]
                          const emailData = buildBookingConfirmationEmail({
                            customerName: customer.name,
                            businessName: biz.businessName,
                            jobTitle: eventsForSend.length > 1 ? `${jobType} (${eventsForSend.length} days)` : jobType,
                            date: firstEv.date,
                            time: eventsForSend.length > 1
                              ? `${eventsForSend.length} days — see attached calendar`
                              : (slotLabels[firstEv.slot] || firstEv.slot),
                            businessPhone: biz.phone,
                            businessEmail: biz.email,
                          })
                          await sendEmail({
                            to: customer.email,
                            subject: subjectPrefix + emailData.subject,
                            htmlBody: emailData.html,
                            textBody: `${emailData.text}\n\nScheduled days:\n${sendSummary}`,
                            replyTo: biz.email,
                            fromName: buildFromName(biz),
                            attachments: [{
                              filename: 'appointment.ics',
                              content: ics,
                              contentType: 'text/calendar',
                            }],
                            orgId: user.orgId,
                            customerId: customer.id,
                            templateName: confirmMode === 'resend' ? 'Booking Reminder' : 'Booking Confirmation',
                          })
                          addComm({
                            customerId: customer.id,
                            customerName: customer.name,
                            templateName: confirmMode === 'resend' ? 'Booking Reminder' : 'Booking Confirmation',
                            channel: 'email',
                            status: 'Sent',
                            date: new Date().toISOString(),
                            body: `${confirmMode === 'resend' ? 'Resent' : 'Sent'} ${eventsForSend.length} day${eventsForSend.length > 1 ? 's' : ''}: ${eventsForSend.map(e => fmtDate(e.date)).join(', ')}`,
                          })
                        } catch (err) {
                          console.error('[Schedule] email confirmation failed', err)
                        }
                      }

                      // ── WhatsApp path ──
                      if (confirmVia.whatsapp && customer?.phone) {
                        const phone = customer.phone.replace(/\s/g, '').replace(/^0/, '44')
                        const intro = confirmMode === 'resend'
                          ? `Hi ${customer.name}, resending the booking details from ${biz.businessName}. We've got you down for:`
                          : `Hi ${customer.name}, ${biz.businessName} here. I've got you booked in for:`
                        const text = `${intro}\n\n${sendSummary}\n\nPlease let me know if any of these don't work and I'll find another time. Otherwise see you then!`
                        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank')
                        if (customer.id) {
                          addComm({
                            customerId: customer.id,
                            customerName: customer.name,
                            templateName: confirmMode === 'resend' ? 'Booking Reminder' : 'Booking Confirmation',
                            channel: 'whatsapp',
                            status: 'Sent',
                            date: new Date().toISOString(),
                            body: `WhatsApp ${confirmMode === 'resend' ? 'reminder' : 'confirmation'} for ${eventsForSend.length} day${eventsForSend.length > 1 ? 's' : ''}`,
                          })
                        }
                      }

                      // Stamp confirmation_sent_at + snapshot the live
                      // date/start/end on every event we just dispatched. The
                      // snapshot lets the warning logic detect later moves and
                      // also detect if the user moves the card and then puts
                      // it back to the originally-confirmed times.
                      const ts = new Date().toISOString()
                      for (const ev of eventsForSend) {
                        updateEvent(ev.id, {
                          confirmationSentAt: ts,
                          confirmedDate: ev.date,
                          confirmedStartTime: ev.startTime ?? null,
                          confirmedEndTime: ev.endTime ?? null,
                        })
                      }

                      // Implicit acceptance: silence is consent. The moment
                      // we tell the customer their dates, the job moves to
                      // Scheduled. If they push back, the user reschedules
                      // and the job stays in Scheduled either way. Only on
                      // initial send — resends are no-ops here.
                      if (confirmMode === 'initial' && selectedJob.status === 'Accepted') {
                        moveJob(selectedJob.id, 'Scheduled')
                        setSelectedJob({ ...selectedJob, status: 'Scheduled' })
                      }

                      const channels = [confirmVia.email && 'Email', confirmVia.whatsapp && 'WhatsApp'].filter(Boolean).join(' + ')
                      setConfirmSentMsg(confirmMode === 'resend'
                        ? `Resent via ${channels}`
                        : `Sent via ${channels}`)
                      setConfirmSending(false)
                    }

                    return (
                      <div ref={scheduleSectionRef} style={{ marginTop: 8, paddingTop: 16, borderTop: `1px solid ${C.steel}33`, scrollMarginTop: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <CalendarDays size={16} color={C.gold} />
                            <span style={{ fontSize: 14, fontWeight: 600, color: C.white }}>Schedule</span>
                          </div>
                          <button
                            onClick={() => { setSelectedJob(null); navigate('/calendar') }}
                            style={{
                              background: 'transparent', border: 'none', color: C.gold,
                              cursor: 'pointer', fontSize: 11, fontWeight: 500, padding: 0,
                              display: 'flex', alignItems: 'center', gap: 4,
                            }}
                            title="Open the full calendar"
                          >
                            View calendar <ChevronRight size={12} />
                          </button>
                        </div>

                        {/* Schedule needs-resend banner — mirrors the quote
                            needs-resend banner. Shown when at least one event
                            is unsent AND at least one other event has been
                            sent before, which means a previously-confirmed
                            schedule has been changed (vs a brand-new addition
                            on a never-confirmed job, which uses softer copy). */}
                        {unconfirmedEvents.length > 0 && jobEvents.some(e => isEventConfirmed(e) || e.confirmationSentAt) && (
                          <div style={{
                            marginBottom: 12, padding: '12px 14px', borderRadius: 10,
                            background: '#D46A6A10', border: '1px solid #D46A6A44',
                            display: 'flex', alignItems: 'flex-start', gap: 10,
                          }}>
                            <AlertCircle size={16} color="#D46A6A" style={{ flexShrink: 0, marginTop: 1 }} />
                            <div style={{ fontSize: 12, color: C.silver, lineHeight: 1.5 }}>
                              The schedule has changed since you last sent it. <strong style={{ color: C.white }}>Send an updated confirmation</strong> below so {customer?.name || 'the customer'} sees the new dates.
                            </div>
                          </div>
                        )}

                        {/* Already-booked days for this job */}
                        {jobEvents.length > 0 && (
                          <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {jobEvents.map(ev => {
                              const isPending = !isEventConfirmed(ev)
                              const timeRange = fmtTimeRange(ev.startTime, ev.endTime)
                              return (
                                <div key={ev.id} style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  padding: '8px 12px', background: C.black, borderRadius: 8,
                                  borderLeft: `3px solid ${isPending ? '#D46A6A' : C.blue}`,
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 13, fontWeight: 500, color: C.white }}>{fmtDate(ev.date)}</span>
                                    <span style={{ fontSize: 12, color: C.steel }}>
                                      {slotLabels[ev.slot]}{timeRange ? ` · ${timeRange}` : ''}
                                    </span>
                                    {isPending && (
                                      <span style={{
                                        fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 6,
                                        color: '#D46A6A', background: '#D46A6A1A',
                                        textTransform: 'uppercase', letterSpacing: 0.5,
                                      }}>Unsent</span>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => {
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
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Soft-conflict warning — at least one of this job's
                            scheduled events overlaps an internal event (stock
                            check, admin, travel, etc.). Customer work takes
                            precedence so the time is still available, but we
                            nag the user to review the overlap before sending
                            the customer their confirmation. */}
                        {internalConflicts.length > 0 && (
                          <div style={{
                            marginBottom: 12, padding: '12px 14px', borderRadius: 10,
                            background: '#C6A86A12', border: '1px solid #C6A86A55',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                              <AlertCircle size={16} color="#C6A86A" style={{ flexShrink: 0, marginTop: 1 }} />
                              <div style={{ fontSize: 12, color: C.silver, lineHeight: 1.5 }}>
                                <strong style={{ color: C.white }}>Schedule clash with your own diary</strong> — review before sending the customer their confirmation. Customer time takes precedence, so you'll need to move or delete the internal entries below if you want to keep them.
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginLeft: 26 }}>
                              {internalConflicts.map((c, i) => {
                                const r = eventMinutes(c.internal)
                                const fmtMins = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
                                return (
                                  <div
                                    key={`${c.jobEvent.id}-${c.internal.id}-${i}`}
                                    style={{ fontSize: 11, color: C.silver }}
                                  >
                                    • <strong style={{ color: C.white }}>{c.internal.customerName}</strong> on {fmtDate(c.internal.date)} at {fmtMins(r.startMin)}–{fmtMins(r.endMin)}
                                  </div>
                                )
                              })}
                            </div>
                            <button
                              onClick={() => setShowConflictResolver(true)}
                              style={{
                                marginTop: 10, marginLeft: 26,
                                padding: '8px 14px', borderRadius: 8,
                                background: '#C6A86A20', border: '1px solid #C6A86A66',
                                color: '#C6A86A', cursor: 'pointer',
                                fontSize: 12, fontWeight: 700, minHeight: 34,
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#C6A86A30' }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#C6A86A20' }}
                            >
                              Resolve clashes <ChevronRight size={12} />
                            </button>
                          </div>
                        )}

                        {/* Send confirmation CTA — appears once one or more
                            days are added but not yet sent to the customer.
                            Tapping it opens the channel-picker modal below.
                            Disabled when there's an unresolved conflict with
                            an internal event — the user must delete or move
                            the internal entry first. */}
                        {unconfirmedEvents.length > 0 && !showConfirmModal && !confirmSentMsg && (
                          <button
                            onClick={() => {
                              if (internalConflicts.length > 0) return
                              setConfirmMode('initial')
                              setShowConfirmModal(true)
                            }}
                            disabled={internalConflicts.length > 0}
                            title={internalConflicts.length > 0 ? 'Resolve the schedule clash above before sending' : undefined}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                              padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                              cursor: internalConflicts.length > 0 ? 'not-allowed' : 'pointer',
                              minHeight: 42, marginBottom: 12,
                              background: internalConflicts.length > 0 ? C.black : `${C.gold}15`,
                              border: `1px solid ${internalConflicts.length > 0 ? C.steel + '33' : C.gold + '66'}`,
                              color: internalConflicts.length > 0 ? C.steel : C.gold,
                              opacity: internalConflicts.length > 0 ? 0.6 : 1,
                            }}
                          >
                            <Send size={14} />
                            {internalConflicts.length > 0
                              ? 'Resolve schedule clash to send'
                              : `Send confirmation (${unconfirmedEvents.length} day${unconfirmedEvents.length > 1 ? 's' : ''})`}
                          </button>
                        )}

                        {/* Resend confirmation — secondary, available whenever
                            there's at least one already-sent day on the job.
                            Used when the customer can't find the original. */}
                        {jobEvents.length > 0 && unconfirmedEvents.length < jobEvents.length && !showConfirmModal && (
                          <button
                            onClick={() => { setConfirmMode('resend'); setShowConfirmModal(true) }}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                              padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                              cursor: 'pointer', minHeight: 34, marginBottom: 12,
                              background: 'transparent', border: `1px solid ${C.steel}44`, color: C.silver,
                            }}
                            onMouseEnter={e => { e.currentTarget.style.color = C.gold; e.currentTarget.style.borderColor = `${C.gold}66` }}
                            onMouseLeave={e => { e.currentTarget.style.color = C.silver; e.currentTarget.style.borderColor = `${C.steel}44` }}
                            title="Resend the booking confirmation if the customer can't find the original email"
                          >
                            <RefreshCw size={12} />
                            Resend confirmation
                          </button>
                        )}

                        {/* After-send confirmation note. The job has already
                            been moved to Scheduled by handleSendConfirmation —
                            silence is consent. The user only needs to act if
                            the customer pushes back. */}
                        {confirmSentMsg && (
                          <div style={{
                            marginBottom: 12, padding: '10px 14px', borderRadius: 10,
                            background: '#6ABF8A12', border: '1px solid #6ABF8A44',
                            display: 'flex', alignItems: 'flex-start', gap: 10,
                          }}>
                            <CheckCircle size={14} color="#6ABF8A" style={{ flexShrink: 0, marginTop: 2 }} />
                            <div style={{ fontSize: 12, color: C.silver, lineHeight: 1.5 }}>
                              {confirmSentMsg}. {customer?.name || 'The customer'} will reply if they need to reschedule.
                            </div>
                          </div>
                        )}

                        {/* Inline send modal — channel picker, mirrors QuickQuote send flow */}
                        {showConfirmModal && (
                          <div style={{
                            marginBottom: 12, padding: '14px 16px', borderRadius: 10,
                            background: C.charcoalLight, border: `1px solid ${C.steel}44`,
                          }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.white, marginBottom: 4 }}>
                              {confirmMode === 'resend' ? 'Resend' : 'Send'} confirmation for {eventsForSend.length} day{eventsForSend.length > 1 ? 's' : ''}
                            </div>
                            <div style={{ fontSize: 11, color: C.steel, marginBottom: 12 }}>
                              {eventsForSend.map(e => `${fmtDate(e.date)} (${slotLabels[e.slot]})`).join(' · ')}
                            </div>

                            <label style={{
                              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                              borderRadius: 8, marginBottom: 6, cursor: customer?.email ? 'pointer' : 'not-allowed',
                              background: confirmVia.email ? `${C.gold}12` : C.black,
                              border: `1px solid ${confirmVia.email ? C.gold : C.steel + '33'}`,
                              opacity: customer?.email ? 1 : 0.5,
                            }}>
                              <input
                                type="checkbox"
                                checked={confirmVia.email}
                                disabled={!customer?.email}
                                onChange={e => setConfirmVia(p => ({ ...p, email: e.target.checked }))}
                                style={{ accentColor: C.gold }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: C.white }}>Email</div>
                                <div style={{ fontSize: 11, color: C.steel, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {customer?.email || 'No email on file'}
                                </div>
                              </div>
                            </label>

                            <label style={{
                              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                              borderRadius: 8, marginBottom: 12, cursor: customer?.phone ? 'pointer' : 'not-allowed',
                              background: confirmVia.whatsapp ? `${C.gold}12` : C.black,
                              border: `1px solid ${confirmVia.whatsapp ? C.gold : C.steel + '33'}`,
                              opacity: customer?.phone ? 1 : 0.5,
                            }}>
                              <input
                                type="checkbox"
                                checked={confirmVia.whatsapp}
                                disabled={!customer?.phone}
                                onChange={e => setConfirmVia(p => ({ ...p, whatsapp: e.target.checked }))}
                                style={{ accentColor: C.gold }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: C.white }}>WhatsApp</div>
                                <div style={{ fontSize: 11, color: C.steel }}>
                                  {customer?.phone || 'No phone on file'}
                                </div>
                              </div>
                            </label>

                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                onClick={() => { setShowConfirmModal(false) }}
                                style={{
                                  flex: 1, padding: '10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                                  background: 'transparent', border: `1px solid ${C.steel}44`,
                                  color: C.silver, cursor: 'pointer', minHeight: 38,
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                onClick={async () => {
                                  await handleSendConfirmation()
                                  setShowConfirmModal(false)
                                }}
                                disabled={confirmSending || (!confirmVia.email && !confirmVia.whatsapp)}
                                style={{
                                  flex: 2, padding: '10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                                  background: confirmSending || (!confirmVia.email && !confirmVia.whatsapp) ? C.black : C.gold,
                                  border: `1px solid ${C.gold}`,
                                  color: confirmSending || (!confirmVia.email && !confirmVia.whatsapp) ? C.steel : C.charcoal,
                                  cursor: confirmSending || (!confirmVia.email && !confirmVia.whatsapp) ? 'not-allowed' : 'pointer',
                                  minHeight: 38,
                                }}
                              >
                                {confirmSending ? 'Sending…' : 'Send'}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Week navigator */}
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          marginBottom: 8, gap: 6,
                        }}>
                          <button
                            onClick={() => shiftWeek(-7)}
                            style={{
                              background: 'transparent', border: `1px solid ${C.steel}33`, borderRadius: 8,
                              color: C.silver, cursor: 'pointer', padding: '4px 8px', fontSize: 12,
                              display: 'flex', alignItems: 'center', minHeight: 28,
                            }}
                          >‹</button>
                          <button
                            onClick={goToToday}
                            style={{
                              flex: 1, background: 'transparent', border: 'none',
                              color: C.silver, cursor: 'pointer', fontSize: 12, fontWeight: 600, minHeight: 28,
                            }}
                            title="Jump to this week"
                          >{weekRangeLabel}</button>
                          <button
                            onClick={() => shiftWeek(7)}
                            style={{
                              background: 'transparent', border: `1px solid ${C.steel}33`, borderRadius: 8,
                              color: C.silver, cursor: 'pointer', padding: '4px 8px', fontSize: 12,
                              display: 'flex', alignItems: 'center', minHeight: 28,
                            }}
                          >›</button>
                        </div>

                        {/* Day strip — each card shows two pips (AM, PM) plus
                            a small "+N" badge for any sub-1hr quick jobs that
                            don't reserve a half-day. Filled pip = taken. */}
                        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                          {weekDays.map((d, i) => {
                            const dateObj = new Date(d)
                            const isPast = d < todayStr
                            const slots = slotsPerDay[d] ?? { am: false, pm: false, quick: 0 }
                            const isSelected = d === scheduleDate
                            const dotColor = isSelected ? C.charcoal : C.gold
                            const emptyColor = isSelected ? `${C.charcoal}44` : `${C.steel}55`
                            return (
                              <button
                                key={d}
                                disabled={isPast}
                                onClick={() => setScheduleDate(d)}
                                style={dayBtnStyle(d)}
                              >
                                <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.7 }}>{dayHeaders[i]}</span>
                                <span style={{ fontSize: 16, fontWeight: 700 }}>{dateObj.getDate()}</span>
                                <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginTop: 1 }}>
                                  <div style={{
                                    width: 6, height: 6, borderRadius: '50%',
                                    background: slots.am ? dotColor : 'transparent',
                                    border: `1px solid ${slots.am ? dotColor : emptyColor}`,
                                  }} />
                                  <div style={{
                                    width: 6, height: 6, borderRadius: '50%',
                                    background: slots.pm ? dotColor : 'transparent',
                                    border: `1px solid ${slots.pm ? dotColor : emptyColor}`,
                                  }} />
                                  {slots.quick > 0 && (
                                    <span style={{
                                      fontSize: 8, fontWeight: 700,
                                      color: dotColor,
                                      marginLeft: 1,
                                    }}>+{slots.quick}</span>
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>

                        {/* Slot picker — only when a day is selected */}
                        {scheduleDate && (() => {
                          const slotDisabled: Record<string, boolean> = {
                            morning: morningTaken,
                            afternoon: afternoonTaken,
                            full: fullTaken,
                          }
                          // If the currently selected slot has just become
                          // disabled by virtue of being already taken, drop the
                          // selection silently so the user has to pick a free one.
                          if (slotDisabled[scheduleSlot]) {
                            // Don't trigger a re-render storm — only fix when needed.
                            setTimeout(() => {
                              if (slotDisabled[scheduleSlot]) {
                                setScheduleSlot(scheduleSlot === 'full' && !morningTaken ? 'morning' : 'quick')
                              }
                            }, 0)
                          }
                          return (
                            <>
                              {selectedDayContext.length > 0 && (
                                <div style={{
                                  fontSize: 11, color: C.silver, marginBottom: 8,
                                  padding: '6px 10px', background: `${C.gold}10`, borderRadius: 6,
                                }}>
                                  Already on {fmtDate(scheduleDate)}: {selectedDayContext.map(e => `${e.customerName} (${slotLabels[e.slot]})`).join(', ')}
                                </div>
                              )}
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr 1fr',
                                gap: 4,
                                marginBottom: 6,
                              }}>
                                {(['morning','afternoon','full'] as const).map(slot => {
                                  const active = scheduleSlot === slot
                                  const disabled = slotDisabled[slot]
                                  return (
                                    <button
                                      key={slot}
                                      onClick={() => { if (!disabled) setScheduleSlot(slot) }}
                                      disabled={disabled}
                                      title={disabled ? `${slotLabels[slot]} is already booked on this day` : undefined}
                                      style={{
                                        padding: '10px 8px', borderRadius: 10,
                                        background: active ? C.gold : C.black,
                                        border: `1px solid ${active ? C.gold : C.steel + '33'}`,
                                        color: active ? C.charcoal : (disabled ? C.steel : C.white),
                                        fontSize: 12, fontWeight: 600,
                                        cursor: disabled ? 'not-allowed' : 'pointer',
                                        opacity: disabled ? 0.4 : 1,
                                        textDecoration: disabled ? 'line-through' : 'none',
                                        minHeight: 38,
                                      }}
                                    >
                                      {slotLabels[slot]}
                                    </button>
                                  )
                                })}
                              </div>
                              {/* Quick fit-in — full-width separate row so it's
                                  visually distinct from the half-day blocks. */}
                              <button
                                onClick={() => setScheduleSlot('quick')}
                                style={{
                                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                  padding: '8px', borderRadius: 10, marginBottom: scheduleSlot === 'quick' ? 6 : 12,
                                  background: scheduleSlot === 'quick' ? C.gold : C.black,
                                  border: `1px dashed ${scheduleSlot === 'quick' ? C.gold : C.steel + '55'}`,
                                  color: scheduleSlot === 'quick' ? C.charcoal : C.silver,
                                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                  minHeight: 32,
                                }}
                              >
                                <Clock size={11} /> Quick fit-in (under 1 hour) — won't block the day
                              </button>

                              {/* Time picker — only visible for Quick slot.
                                  Adjusting this will auto-shrink any conflicting
                                  half-day blocks on this day when you click Add. */}
                              {scheduleSlot === 'quick' && (
                                <div style={{
                                  display: 'flex', alignItems: 'center', gap: 8,
                                  padding: '8px 12px', borderRadius: 10, marginBottom: 12,
                                  background: C.black, border: `1px solid ${C.steel}33`,
                                }}>
                                  <span style={{ fontSize: 11, color: C.steel, fontWeight: 600 }}>START</span>
                                  <input
                                    type="time"
                                    value={quickStartTime}
                                    onChange={e => setQuickStartTime(e.target.value)}
                                    style={{
                                      flex: 1, padding: '6px 8px', borderRadius: 6,
                                      background: C.charcoal, border: `1px solid ${C.steel}33`,
                                      color: C.white, fontSize: 13, outline: 'none',
                                      colorScheme: 'dark',
                                    }}
                                  />
                                  <span style={{ fontSize: 11, color: C.steel }}>
                                    → {formatHHMM(parseHHMM(quickStartTime) + 60)}
                                  </span>
                                </div>
                              )}
                            </>
                          )
                        })()}

                        <button
                          onClick={handleAddDay}
                          disabled={!scheduleDate}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            padding: '12px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                            cursor: scheduleDate ? 'pointer' : 'not-allowed', minHeight: 44,
                            background: scheduleDate ? `${C.gold}15` : C.black,
                            border: `1px solid ${scheduleDate ? C.gold + '44' : C.steel + '33'}`,
                            color: scheduleDate ? C.gold : C.steel,
                            opacity: scheduleDate ? 1 : 0.5,
                          }}
                        >
                          <Plus size={14} />
                          {scheduleDate
                            ? `Add ${fmtDate(scheduleDate)} · ${slotLabels[scheduleSlot]}`
                            : 'Pick a day above'}
                        </button>

                        <div style={{ fontSize: 11, color: C.steel, marginTop: 6, textAlign: 'center' }}>
                          {unconfirmedEvents.length > 0
                            ? 'Add all the days you need, then send a single confirmation.'
                            : 'Add days here, then send the customer one confirmation when ready.'}
                        </div>
                      </div>
                    )
                  })()}

                  {/* ── Photos & Files ── */}
                  <div style={{ marginTop: 8, paddingTop: 16, borderTop: `1px solid ${C.steel}33` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Paperclip size={16} color={C.gold} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: C.white }}>Photos & Files</span>
                        {attachments.length > 0 && (
                          <span style={{
                            fontSize: 11, fontWeight: 700, color: C.charcoal,
                            background: C.silver, borderRadius: 10, padding: '1px 7px',
                          }}>{attachments.length}</span>
                        )}
                      </div>
                    </div>

                    {/* Upload area */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <select
                          value={uploadCategory}
                          onChange={e => setUploadCategory(e.target.value)}
                          style={{
                            width: '100%', padding: '8px 28px 8px 10px', borderRadius: 8,
                            background: C.black, border: `1px solid ${C.steel}33`,
                            color: C.white, fontSize: 12, outline: 'none',
                            appearance: 'none', WebkitAppearance: 'none' as any,
                          }}
                        >
                          <option value="before">Before</option>
                          <option value="after">After</option>
                          <option value="certificate">Certificate</option>
                          <option value="receipt">Receipt</option>
                          <option value="general">General</option>
                        </select>
                        <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: C.steel }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                        </div>
                      </div>
                      <label
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                          borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          background: `${C.gold}15`, border: `1px solid ${C.gold}44`, color: C.gold,
                          minHeight: 36, whiteSpace: 'nowrap',
                        }}
                      >
                        <Upload size={13} />
                        Add File
                        <input
                          type="file"
                          accept="image/*,.pdf,.doc,.docx"
                          style={{ display: 'none' }}
                          onChange={e => { handleFileUpload(e.target.files); e.target.value = '' }}
                        />
                      </label>
                    </div>

                    {uploadError && (
                      <div style={{ fontSize: 12, color: '#D46A6A', marginBottom: 8 }}>{uploadError}</div>
                    )}

                    {/* Attachments grid */}
                    {attachmentsLoading && attachments.length === 0 && (
                      <div style={{ fontSize: 12, color: C.steel, textAlign: 'center', padding: '12px 0' }}>Loading...</div>
                    )}

                    {attachments.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 }}>
                        {attachments.map(att => {
                          const categoryColors: Record<string, string> = {
                            before: '#5B9BD5', after: '#6ABF8A', certificate: '#9B7ED8',
                            receipt: '#C6A86A', general: C.steel,
                          }
                          const catColor = categoryColors[att.category] || C.steel
                          const catLabel = att.category.charAt(0).toUpperCase() + att.category.slice(1)

                          return (
                            <div key={att.id} style={{
                              position: 'relative', background: C.black, borderRadius: 8,
                              overflow: 'hidden', border: `1px solid ${C.steel}22`,
                            }}>
                              {/* Thumbnail or file icon */}
                              {isImageFile(att.fileType) ? (
                                <div
                                  style={{
                                    width: '100%', paddingTop: '100%', position: 'relative',
                                    cursor: 'pointer', backgroundImage: `url(${att.url})`,
                                    backgroundSize: 'cover', backgroundPosition: 'center',
                                  }}
                                  onClick={() => setPreviewAttachment(att)}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: '100%', paddingTop: '100%', position: 'relative',
                                    cursor: 'pointer', display: 'flex',
                                  }}
                                  onClick={() => window.open(att.url, '_blank')}
                                >
                                  <div style={{
                                    position: 'absolute', inset: 0, display: 'flex',
                                    flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    gap: 4,
                                  }}>
                                    <FileText size={24} color={C.steel} />
                                    <span style={{ fontSize: 10, color: C.steel, maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
                                      {att.fileName}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Category badge */}
                              <div style={{
                                position: 'absolute', top: 4, left: 4,
                                fontSize: 9, fontWeight: 700, padding: '2px 6px',
                                borderRadius: 4, background: catColor + '33', color: catColor,
                                textTransform: 'uppercase', letterSpacing: 0.3,
                              }}>
                                {catLabel}
                              </div>

                              {/* Delete button */}
                              <button
                                onClick={e => { e.stopPropagation(); handleDeleteAttachment(att) }}
                                style={{
                                  position: 'absolute', top: 4, right: 4,
                                  background: 'rgba(0,0,0,.6)', border: 'none',
                                  borderRadius: 4, padding: 2, cursor: 'pointer',
                                  display: 'flex', color: C.steel,
                                }}
                                onMouseEnter={e => { e.currentTarget.style.color = '#D46A6A' }}
                                onMouseLeave={e => { e.currentTarget.style.color = C.steel }}
                              >
                                <X size={12} />
                              </button>

                              {/* File size */}
                              <div style={{
                                position: 'absolute', bottom: 4, right: 4,
                                fontSize: 9, color: C.steel, background: 'rgba(0,0,0,.5)',
                                padding: '1px 4px', borderRadius: 3,
                              }}>
                                {formatFileSize(att.fileSize)}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {attachments.length === 0 && !attachmentsLoading && (
                      <div style={{ fontSize: 12, color: C.steel, textAlign: 'center', padding: '8px 0' }}>
                        No files attached
                      </div>
                    )}
                  </div>

                  {/* ── Image Preview Modal ── */}
                  {previewAttachment && (
                    <>
                      <div
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 200, cursor: 'pointer' }}
                        onClick={() => setPreviewAttachment(null)}
                      />
                      <div style={{
                        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        zIndex: 210, maxWidth: '90vw', maxHeight: '90vh', display: 'flex',
                        flexDirection: 'column', alignItems: 'center', gap: 12,
                      }}>
                        <img
                          src={previewAttachment.url}
                          alt={previewAttachment.fileName}
                          style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 8, objectFit: 'contain' }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 13, color: C.white }}>{previewAttachment.fileName}</span>
                          <button
                            onClick={() => setPreviewAttachment(null)}
                            style={{
                              background: C.charcoalLight, border: `1px solid ${C.steel}44`,
                              color: C.white, borderRadius: 8, padding: '6px 14px',
                              fontSize: 12, cursor: 'pointer',
                            }}
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── Footer Actions: Certificates + Delete ── */}
                  {(() => {
                    const certTypes = ['consumer unit', 'ev charger', 'rewire', 'eicr', 'consumer', 'condition report']
                    const jt = selectedJob.jobType.toLowerCase()
                    const showCerts = certTypes.some(t => jt.includes(t))

                    const footerBtn: CSSProperties = {
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', minHeight: 36, background: 'transparent',
                    }

                    return (
                      <div style={{
                        marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.steel}33`,
                        display: 'flex', gap: 8,
                      }}>
                        {showCerts && (
                          <button
                            onClick={() => { setSelectedJob(null); navigate(`/certificates/${selectedJob.id}`) }}
                            style={{ ...footerBtn, border: '1px solid #9B7ED844', color: '#9B7ED8' }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#9B7ED815' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                          >
                            <FileCheck size={13} /> Certificates
                          </button>
                        )}
                        <button
                          onClick={() => {
                            const ok = window.confirm(
                              `Delete this job for ${selectedJob.customerName}?\n\nIt will be hidden from the board but kept in the customer's history so you can restore it later.`
                            )
                            if (!ok) return
                            const jobId = selectedJob.id
                            const customerName = selectedJob.customerName
                            softDeleteJob(jobId)
                            setSelectedJob(null)
                            showUndo({
                              message: `Job deleted: ${customerName}`,
                              undo: () => restoreJob(jobId),
                            })
                          }}
                          style={{ ...footerBtn, border: '1px solid #D46A6A44', color: '#D46A6A' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#D46A6A15' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                        >
                          <Trash2 size={13} /> Delete
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

                      {/* ── Materials Override ── */}
                      {(() => {
                        // Lazily seed the input from the quote's current materials value
                        // the first time we look at this job. Switching jobs resets it
                        // via selectJob().
                        if (materialsLoadedFor !== linkedQuote.id) {
                          setActualMaterials(linkedQuote.materials.toFixed(2))
                          setMaterialsLoadedFor(linkedQuote.id)
                        }

                        const parsed = parseFloat(actualMaterials)
                        const valid = !isNaN(parsed) && parsed >= 0
                        const dirty = valid && Math.abs(parsed - linkedQuote.materials) > 0.005
                        const newNetTotal = (valid ? parsed : linkedQuote.materials) + linkedQuote.labour + linkedQuote.certificates + linkedQuote.waste + linkedQuote.adjustments
                        const newVat = newNetTotal * 0.2
                        const newGrandTotal = newNetTotal + newVat
                        const diff = (valid ? parsed : linkedQuote.materials) - linkedQuote.materials

                        return (
                          <div style={{ marginBottom: 16, paddingTop: 16, borderTop: `1px solid ${C.steel}33` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <Package size={16} color={C.gold} />
                              <span style={{ fontSize: 14, fontWeight: 600, color: C.white }}>Actual materials cost</span>
                            </div>
                            <div style={{ fontSize: 12, color: C.steel, marginBottom: 10 }}>
                              Override the estimate once you know what materials really cost. A detailed breakdown will appear here automatically once you log expenses against this job.
                            </div>

                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <div style={{ position: 'relative', flex: 1 }}>
                                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.steel, fontSize: 14 }}>£</span>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min={0}
                                  step={0.01}
                                  value={actualMaterials}
                                  onChange={e => setActualMaterials(e.target.value)}
                                  style={{
                                    width: '100%', padding: '10px 12px 10px 24px', borderRadius: 10,
                                    background: C.black, border: `1px solid ${C.steel}33`,
                                    color: C.white, fontSize: 14, outline: 'none', boxSizing: 'border-box',
                                  }}
                                />
                              </div>
                              <button
                                onClick={() => {
                                  if (!valid || !dirty) return
                                  const wasSent = linkedQuote.status !== 'Draft'
                                  updateQuote(linkedQuote.id, {
                                    materials: parsed,
                                    netTotal: newNetTotal,
                                    vat: newVat,
                                    grandTotal: newGrandTotal,
                                    needsResend: wasSent,
                                  })
                                  updateJob(selectedJob.id, { value: newGrandTotal })
                                  setSelectedJob({ ...selectedJob, value: newGrandTotal })
                                  setRequoteSuccess(true)
                                  setTimeout(() => setRequoteSuccess(false), 2500)
                                }}
                                disabled={!valid || !dirty}
                                style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                                  cursor: (!valid || !dirty) ? 'not-allowed' : 'pointer', minHeight: 42,
                                  background: (!valid || !dirty) ? C.black : `${C.gold}15`,
                                  border: `1px solid ${(!valid || !dirty) ? C.steel + '33' : C.gold + '44'}`,
                                  color: (!valid || !dirty) ? C.steel : C.gold,
                                  opacity: (!valid || !dirty) ? 0.6 : 1,
                                }}
                              >
                                Save
                              </button>
                            </div>

                            {/* Live preview of impact while typing */}
                            {dirty && (
                              <div style={{
                                marginTop: 10, padding: '10px 14px', borderRadius: 10,
                                background: C.black, border: `1px solid ${C.steel}22`,
                                fontSize: 12, color: C.silver,
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              }}>
                                <span>New quote total</span>
                                <span>
                                  <span style={{ color: C.steel, textDecoration: 'line-through', marginRight: 8 }}>£{linkedQuote.grandTotal.toFixed(2)}</span>
                                  <span style={{ color: C.gold, fontWeight: 700 }}>£{newGrandTotal.toFixed(2)}</span>
                                  <span style={{ color: diff > 0 ? '#D46A6A' : '#6ABF8A', marginLeft: 8, fontWeight: 600 }}>
                                    {diff > 0 ? '+' : ''}£{diff.toFixed(2)}
                                  </span>
                                </span>
                              </div>
                            )}

                            {requoteSuccess && (
                              <div style={{
                                marginTop: 10, padding: '10px 14px', borderRadius: 10,
                                background: '#6ABF8A12', border: '1px solid #6ABF8A44',
                                fontSize: 13, color: '#6ABF8A', textAlign: 'center', fontWeight: 600,
                              }}>
                                Quote updated
                              </div>
                            )}

                            {/* Resend prompt — sticks around until the quote is actually resent */}
                            {linkedQuote.needsResend && (() => {
                              const isUnderway = !(['Lead', 'Quoted', 'Accepted'] as JobStatus[]).includes(selectedJob.status)
                              return (
                                <div style={{
                                  marginTop: 12, padding: '12px 14px', borderRadius: 10,
                                  background: '#D46A6A10', border: '1px solid #D46A6A44',
                                  display: 'flex', alignItems: 'flex-start', gap: 10,
                                }}>
                                  <AlertCircle size={16} color="#D46A6A" style={{ flexShrink: 0, marginTop: 1 }} />
                                  <div style={{ fontSize: 12, color: C.silver, lineHeight: 1.5 }}>
                                    This quote has changed since you last sent it. <strong style={{ color: C.white }}>Resend it</strong> below so the customer sees the new total
                                    {isUnderway
                                      ? <> — the job will stay in <strong style={{ color: C.white }}>{selectedJob.status}</strong> since work is already underway.</>
                                      : <> — the job will move back to <strong style={{ color: C.white }}>Quoted</strong> automatically.</>
                                    }
                                  </div>
                                </div>
                              )
                            })()}
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
                              style={{
                                ...btnStyle,
                                color: linkedQuote.needsResend ? '#D46A6A' : C.gold,
                                borderColor: linkedQuote.needsResend ? '#D46A6A66' : `${C.gold}33`,
                                background: linkedQuote.needsResend ? '#D46A6A12' : 'transparent',
                              }}
                              onClick={async () => {
                                const realQuoteId = await awaitRealId(linkedQuote.id)
                                const url = `${window.location.origin}/q/${realQuoteId}`
                                navigator.clipboard.writeText(url)

                                // Sending (or resending) always normalises the quote to a
                                // Sent state and clears the needs-resend flag.
                                updateQuote(linkedQuote.id, {
                                  status: 'Sent',
                                  sentAt: new Date().toISOString().split('T')[0],
                                  needsResend: false,
                                })

                                // Only push the job back to Quoted if it's in a pre-work
                                // state — once a job is Scheduled or beyond, the work is
                                // underway and reverting the column would be jarring.
                                // The warning has already been cleared above.
                                const preWorkStatuses: JobStatus[] = ['Lead', 'Quoted', 'Accepted']
                                if (preWorkStatuses.includes(selectedJob.status) && selectedJob.status !== 'Quoted') {
                                  moveJob(selectedJob.id, 'Quoted')
                                  setSelectedJob({ ...selectedJob, status: 'Quoted' })
                                }
                                addComm({
                                  customerId: selectedJob.customerId, customerName: selectedJob.customerName,
                                  templateName: linkedQuote.status === 'Draft' ? 'Send Quote' : 'Resend Quote',
                                  channel: 'email', status: 'Sent',
                                  date: new Date().toISOString(), body: url,
                                })

                                // Try sending real email if customer has an email address
                                const customer = customers.find(c => c.id === selectedJob.customerId)
                                if (customer?.email) {
                                  const biz = settings.business
                                  const quoteEmailData = buildQuoteEmail({
                                    customerName: selectedJob.customerName,
                                    businessName: biz.businessName,
                                    quoteRef: linkedQuote.ref,
                                    total: fmtCurrencyDecimals(linkedQuote.grandTotal),
                                    quoteUrl: url,
                                    validityDays: settings.quoteConfig.validityDays,
                                    businessPhone: biz.phone,
                                    businessEmail: biz.email,
                                  })
                                  const result = await sendEmail({
                                    to: customer.email,
                                    subject: quoteEmailData.subject,
                                    htmlBody: quoteEmailData.html,
                                    textBody: quoteEmailData.text,
                                    replyTo: biz.email,
                                    fromName: buildFromName(biz),
                                    orgId: user?.orgId || '',
                                    customerId: customer.id,
                                    templateName: 'Send Quote',
                                  })
                                  if (result.method === 'edge') {
                                    alert(`Quote emailed to ${customer.email} and link copied.`)
                                    return
                                  }
                                }
                                alert(`Quote link copied — send to ${selectedJob.customerName}:\n\n${url}`)
                              }}
                            >
                              <Send size={14} /> {linkedQuote.needsResend ? 'Resend updated quote' : (linkedQuote.status === 'Draft' ? 'Send Quote' : 'Resend Quote')}
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
                        const isVoided = inv.status === 'Voided'
                        const invTypeColor = inv.type ? invoiceTypeColors[inv.type] : C.steel
                        const invStatusColor = isVoided ? '#8A8F96' : (invoiceStatusColors[inv.status] ?? C.steel)
                        return (
                          <div key={inv.id} style={{
                            background: C.black, borderRadius: 10, padding: '10px 14px',
                            borderLeft: `3px solid ${isVoided ? '#8A8F96' : invTypeColor}`,
                            opacity: isVoided ? 0.55 : 1,
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {inv.type && (
                                  <span style={{
                                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                                    color: isVoided ? '#8A8F96' : invTypeColor,
                                    background: (isVoided ? '#8A8F96' : invTypeColor) + '1A',
                                    textTransform: 'uppercase', letterSpacing: 0.5,
                                    textDecoration: isVoided ? 'line-through' : 'none',
                                  }}>
                                    {inv.type}
                                  </span>
                                )}
                                <span style={{
                                  fontSize: 13, fontWeight: 600, color: C.white,
                                  textDecoration: isVoided ? 'line-through' : 'none',
                                }}>{inv.ref}</span>
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
                                    onClick={async () => {
                                      updateInvoice(inv.id, { status: 'Sent', sentAt: new Date().toISOString().split('T')[0] })
                                      const url = `${window.location.origin}/inv/${inv.id}`
                                      navigator.clipboard.writeText(url)
                                      addComm({
                                        customerId: selectedJob.customerId, customerName: selectedJob.customerName,
                                        templateName: 'Send Invoice', channel: 'email', status: 'Sent',
                                        date: new Date().toISOString(), body: url,
                                      })
                                      // Try sending real email if customer has an email address
                                      const customer = customers.find(c => c.id === selectedJob.customerId)
                                      if (customer?.email) {
                                        const biz = settings.business
                                        const invoiceEmailData = buildInvoiceEmail({
                                          customerName: selectedJob.customerName,
                                          businessName: biz.businessName,
                                          invoiceRef: inv.ref,
                                          total: fmtCurrencyDecimals(inv.grandTotal),
                                          invoiceUrl: url,
                                          businessPhone: biz.phone,
                                          businessEmail: biz.email,
                                        })
                                        const result = await sendEmail({
                                          to: customer.email,
                                          subject: invoiceEmailData.subject,
                                          htmlBody: invoiceEmailData.html,
                                          textBody: invoiceEmailData.text,
                                          replyTo: biz.email,
                                          fromName: buildFromName(biz),
                                          orgId: user?.orgId || '',
                                          customerId: customer.id,
                                          templateName: 'Send Invoice',
                                        })
                                        if (result.method === 'edge') {
                                          alert(`Invoice emailed to ${customer.email} and link copied.`)
                                          return
                                        }
                                      }
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
                                {inv.status !== 'Paid' && inv.status !== 'Voided' && (
                                  <button
                                    onClick={() => {
                                      updateInvoice(inv.id, { status: 'Paid', paidAt: new Date().toISOString().split('T')[0] })
                                      // Auto-advance ONLY kicks in when the work is
                                      // already done (Complete or Invoiced). A deposit
                                      // paid while the job is in Scheduled/In Progress
                                      // does NOT move the job — the money is in but the
                                      // work isn't finished, so the job stays in the
                                      // active queue until the user marks it Complete.
                                      const billingStatuses: JobStatus[] = ['Complete', 'Invoiced']
                                      if (!billingStatuses.includes(selectedJob.status)) {
                                        // Pre-work status — payment received, no column move
                                        return
                                      }
                                      const allPaidAfter = activeInvoices
                                        .filter(i => i.id !== inv.id)
                                        .every(i => i.status === 'Paid')
                                      if (allPaidAfter) {
                                        moveJob(selectedJob.id, 'Paid')
                                        setSelectedJob({ ...selectedJob, status: 'Paid' })
                                      } else if (selectedJob.status === 'Complete') {
                                        moveJob(selectedJob.id, 'Invoiced')
                                        setSelectedJob({ ...selectedJob, status: 'Invoiced' })
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
                                {/* Delete / Void invoice. Paid invoices can only
                                    be voided (never hard-deleted) because the
                                    money has been received — voiding creates a
                                    customer credit instead. Draft/Sent/Viewed
                                    invoices can be fully deleted. */}
                                {inv.status !== 'Voided' && (
                                  <button
                                    onClick={() => {
                                      if (inv.status === 'Paid') {
                                        // Void — don't delete
                                        const ok = window.confirm(
                                          `Void invoice ${inv.ref} (${fmtCurrencyDecimals(inv.grandTotal)})?\n\n` +
                                          `This invoice has been paid — it can't be deleted. Voiding it will:\n` +
                                          `• Keep the record for your accounting history\n` +
                                          `• Create a customer credit of ${fmtCurrencyDecimals(inv.grandTotal)}\n` +
                                          `• Auto-deduct the credit from the next invoice on this job`
                                        )
                                        if (!ok) return
                                        updateInvoice(inv.id, { status: 'Voided' })
                                        // Revert job from Paid/Invoiced back based on
                                        // what's left after voiding. Use jobInvoices (not
                                        // the stale activeInvoices snapshot) and exclude
                                        // the invoice being voided.
                                        if (['Paid', 'Invoiced'].includes(selectedJob.status)) {
                                          const stillActive = jobInvoices.filter(i => i.id !== inv.id && i.status !== 'Voided')
                                          const stillUnpaid = stillActive.some(i => i.status !== 'Paid')
                                          let target: JobStatus = selectedJob.status
                                          if (stillActive.length === 0) target = 'Complete'
                                          else if (selectedJob.status === 'Paid' && stillUnpaid) target = 'Invoiced'
                                          if (target !== selectedJob.status) {
                                            moveJob(selectedJob.id, target)
                                            setSelectedJob({ ...selectedJob, status: target })
                                          }
                                        }
                                      } else {
                                        // Hard delete
                                        let msg = `Delete invoice ${inv.ref} (${fmtCurrencyDecimals(inv.grandTotal)})?`
                                        if (inv.status === 'Sent' || inv.status === 'Viewed') {
                                          msg += '\n\nThis invoice has been sent to the customer. They may still have the link.'
                                        }
                                        if (!window.confirm(msg)) return
                                        const invData = { ...inv }
                                        deleteInvoice(inv.id)
                                        if (['Invoiced', 'Paid'].includes(selectedJob.status)) {
                                          const rem = activeInvoices.filter(i => i.id !== inv.id && i.status !== 'Voided')
                                          if (rem.length === 0) {
                                            moveJob(selectedJob.id, 'Complete')
                                            setSelectedJob({ ...selectedJob, status: 'Complete' })
                                          }
                                        }
                                        showUndo({
                                          message: `Invoice ${invData.ref} deleted`,
                                          undo: () => addInvoice({
                                            jobId: invData.jobId, quoteId: invData.quoteId,
                                            customerId: invData.customerId, customerName: invData.customerName,
                                            jobTypeName: invData.jobTypeName, description: invData.description,
                                            type: invData.type, netTotal: invData.netTotal,
                                            vat: invData.vat, grandTotal: invData.grandTotal,
                                            status: invData.status, dueDate: invData.dueDate,
                                          }),
                                        })
                                      }
                                    }}
                                    style={{
                                      background: 'transparent', border: `1px solid ${C.steel}33`, borderRadius: 6,
                                      color: C.steel, cursor: 'pointer', padding: '4px 6px', fontSize: 11,
                                      display: 'flex', alignItems: 'center', gap: 4, minHeight: 30,
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.color = '#D46A6A'; e.currentTarget.style.borderColor = '#D46A6A66' }}
                                    onMouseLeave={e => { e.currentTarget.style.color = C.steel; e.currentTarget.style.borderColor = `${C.steel}33` }}
                                    title={inv.status === 'Paid' ? 'Void this invoice (creates a customer credit)' : 'Delete this invoice'}
                                  >
                                    <Trash2 size={12} /> {inv.status === 'Paid' ? 'Void' : ''}
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
                      {customerCredit > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#5BBFD4' }}>
                          <span>Customer Credit</span>
                          <span style={{ fontWeight: 600 }}>−{fmtCurrencyDecimals(customerCredit)}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: remaining > 0 ? C.gold : C.steel }}>
                        <span>Remaining</span>
                        <span style={{ fontWeight: 600 }}>{fmtCurrencyDecimals(remaining)}</span>
                      </div>
                    </div>
                  )}

                  {/* Add Invoice button / form */}
                  {!showAddInvoice && (
                    <button
                      onClick={() => {
                        setShowAddInvoice(true)
                        const paymentTermsDays = settings.quoteConfig.paymentTerms || 14
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
                        // Compute smart due date
                        const computeDueDate = (type: InvoiceType): string => {
                          if (type === 'Deposit' && selectedJob.date) {
                            const start = new Date(selectedJob.date)
                            start.setDate(start.getDate() - 7)
                            const earliest = new Date()
                            earliest.setDate(earliest.getDate() + 2)
                            const target = start > earliest ? start : earliest
                            return target.toISOString().split('T')[0]
                          }
                          const d = new Date()
                          d.setDate(d.getDate() + paymentTermsDays)
                          return d.toISOString().split('T')[0]
                        }
                        setNewInvDueDate(computeDueDate(defaultType))
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

                  {showAddInvoice && (() => {
                    const inputStyle: CSSProperties = {
                      width: '100%', padding: '10px 12px', borderRadius: 10,
                      background: C.black, border: `1px solid ${C.steel}33`,
                      color: C.white, fontSize: 14, outline: 'none',
                      boxSizing: 'border-box' as const,
                    }
                    const jobTypeName = selectedJob.jobType !== 'TBC' ? selectedJob.jobType : (linkedQuote?.jobTypeName || 'Works')
                    const paymentTermsDays = settings.quoteConfig.paymentTerms || 14
                    const computeDueDate = (type: InvoiceType): string => {
                      if (type === 'Deposit' && selectedJob.date) {
                        // 7 days before start, but never in the past
                        const start = new Date(selectedJob.date)
                        start.setDate(start.getDate() - 7)
                        const earliest = new Date()
                        earliest.setDate(earliest.getDate() + 2)
                        return (start > earliest ? start : earliest).toISOString().split('T')[0]
                      }
                      const d = new Date()
                      d.setDate(d.getDate() + paymentTermsDays)
                      return d.toISOString().split('T')[0]
                    }
                    const dueDateHint: Record<InvoiceType, string> = {
                      Deposit: selectedJob.date ? `Due before work starts on ${fmtDate(selectedJob.date)}` : `Due within ${paymentTermsDays} days`,
                      Progress: `Due within ${paymentTermsDays} days`,
                      Final: `Due within ${paymentTermsDays} days`,
                      Custom: 'Set your own due date',
                    }

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
                                setNewInvDueDate(computeDueDate(t))
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
                          style={{ ...inputStyle, marginBottom: 12 }}
                        />

                        {/* Due date — smart default per type, fully overridable */}
                        <span style={{ ...s.fieldLabel, fontSize: 11 }}>Due Date</span>
                        <input
                          type="date"
                          value={newInvDueDate}
                          onChange={e => setNewInvDueDate(e.target.value)}
                          style={{ ...inputStyle, marginBottom: 4, colorScheme: 'dark' }}
                        />
                        <div style={{ fontSize: 10, color: C.steel, marginBottom: 6, fontStyle: 'italic' }}>
                          {dueDateHint[newInvType]}
                        </div>
                        {/* Quick-pick shortcuts for deposit — relative to the
                            scheduled start date so the user can see at a glance
                            what they're choosing between. */}
                        {newInvType === 'Deposit' && selectedJob.date && (() => {
                          const startDate = new Date(selectedJob.date)
                          const shortcuts = [
                            { label: '1 day before', days: 1 },
                            { label: '3 days before', days: 3 },
                            { label: '7 days before', days: 7 },
                            { label: '14 days before', days: 14 },
                          ]
                          return (
                            <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
                              {shortcuts.map(sc => {
                                const d = new Date(startDate)
                                d.setDate(d.getDate() - sc.days)
                                const val = d.toISOString().split('T')[0]
                                const isPast = val < new Date().toISOString().split('T')[0]
                                const isActive = newInvDueDate === val
                                return (
                                  <button
                                    key={sc.days}
                                    disabled={isPast}
                                    onClick={() => setNewInvDueDate(val)}
                                    style={{
                                      flex: 1, padding: '6px 4px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                                      cursor: isPast ? 'not-allowed' : 'pointer',
                                      border: `1px solid ${isActive ? C.gold + '66' : C.steel + '33'}`,
                                      background: isActive ? `${C.gold}15` : 'transparent',
                                      color: isPast ? C.steel : (isActive ? C.gold : C.silver),
                                      opacity: isPast ? 0.4 : 1,
                                      minWidth: 0,
                                    }}
                                    title={`Due ${fmtDate(val)} (${sc.label} start)`}
                                  >
                                    {sc.label}
                                  </button>
                                )
                              })}
                            </div>
                          )
                        })()}

                        {/* Create */}
                        <button
                          disabled={!newInvAmount || Number(newInvAmount) <= 0}
                          onClick={() => {
                            const amount = Number(newInvAmount)
                            if (!amount || amount <= 0) return
                            const vatRate = 0.20
                            const net = amount / (1 + vatRate)
                            const vat = amount - net
                            const dueDate = newInvDueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]

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

              </>}
            </div>
          </>
        )
      })()}

      {/* Conflict resolver — opens from the schedule clash banner */}
      {showConflictResolver && selectedJob && (
        <ConflictResolverModal
          jobId={selectedJob.id}
          onClose={() => setShowConflictResolver(false)}
        />
      )}

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
