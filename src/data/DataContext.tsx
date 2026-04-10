import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react'
import * as svc from './supabase-service'

/* ──────────────────────────────────────────────────────
   Shared Types
   ────────────────────────────────────────────────────── */

/* ── App Settings & Pricing ── */

export interface AppSettings {
  business: {
    businessName: string; ownerName: string; phone: string; email: string
    address1: string; address2: string; city: string; county: string; postcode: string
    website: string; vatNumber: string; companyNumber: string
  }
  workingHours: Record<string, { enabled: boolean; start: string; end: string }>
  quoteConfig: {
    validityDays: number; prefix: string; paymentTerms: number
    bankName: string; sortCode: string; accountNumber: string; footer: string
  }
  notifications: {
    jobReminders: boolean; quoteFollowUp: boolean; invoiceOverdue: boolean
    scheduleAlerts: boolean; weeklyDigest: boolean
  }
}

export interface PricingConfig {
  labourRate: number; vatRate: number; certFee: number; wastePct: number
  marginTarget: number; emergencyMult: number; outOfHoursMult: number
  difficultyMin: number; difficultyMax: number; hassleMin: number; hassleMax: number
  emergencyMinCharge: number
}

export interface JobTypeConfig {
  id: string; name: string; baseMaterialCost: number; baseHours: number
  certRequired: boolean; isPerUnit: boolean; minCharge: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  business: {
    businessName: 'Grey Havens Electrical', ownerName: 'Matt', phone: '07XXX XXX XXX',
    email: 'info@thegreyhavens.co.uk', address1: '', address2: '', city: 'Colchester',
    county: 'Essex', postcode: '', website: 'https://thegreyhavens.co.uk', vatNumber: '', companyNumber: '',
  },
  workingHours: {
    Monday: { enabled: true, start: '08:00', end: '17:00' },
    Tuesday: { enabled: true, start: '08:00', end: '17:00' },
    Wednesday: { enabled: true, start: '08:00', end: '17:00' },
    Thursday: { enabled: true, start: '08:00', end: '17:00' },
    Friday: { enabled: true, start: '08:00', end: '17:00' },
    Saturday: { enabled: true, start: '09:00', end: '13:00' },
    Sunday: { enabled: false, start: '10:00', end: '14:00' },
  },
  quoteConfig: {
    validityDays: 30, prefix: 'GH-Q', paymentTerms: 14,
    bankName: '', sortCode: '', accountNumber: '',
    footer: 'Thank you for choosing Grey Havens Electrical. All work guaranteed for 12 months.',
  },
  notifications: { jobReminders: true, quoteFollowUp: true, invoiceOverdue: true, scheduleAlerts: true, weeklyDigest: false },
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  labourRate: 55, vatRate: 0.20, certFee: 85, wastePct: 0.05, marginTarget: 0.30,
  emergencyMult: 1.5, outOfHoursMult: 1.25, difficultyMin: 1.0, difficultyMax: 2.0,
  hassleMin: 1.0, hassleMax: 1.6, emergencyMinCharge: 150,
}

export const DEFAULT_JOB_TYPE_CONFIGS: JobTypeConfig[] = [
  { id: 'consumer-unit', name: 'Consumer Unit', baseMaterialCost: 320, baseHours: 6, certRequired: true, isPerUnit: false, minCharge: 0 },
  { id: 'ev-charger', name: 'EV Charger', baseMaterialCost: 450, baseHours: 5, certRequired: true, isPerUnit: false, minCharge: 0 },
  { id: 'fault-finding', name: 'Fault Finding', baseMaterialCost: 10, baseHours: 2, certRequired: false, isPerUnit: false, minCharge: 150 },
  { id: 'rewire', name: 'Rewire', baseMaterialCost: 180, baseHours: 8, certRequired: true, isPerUnit: true, minCharge: 0 },
  { id: 'lighting', name: 'Lighting', baseMaterialCost: 15, baseHours: 0.5, certRequired: false, isPerUnit: true, minCharge: 0 },
  { id: 'eicr', name: 'EICR', baseMaterialCost: 0, baseHours: 3, certRequired: true, isPerUnit: false, minCharge: 0 },
  { id: 'smart-home', name: 'Smart Home', baseMaterialCost: 200, baseHours: 6, certRequired: false, isPerUnit: false, minCharge: 0 },
  { id: 'ethernet', name: 'Ethernet', baseMaterialCost: 60, baseHours: 1.5, certRequired: false, isPerUnit: true, minCharge: 0 },
  { id: 'smoke-detectors', name: 'Smoke Detectors', baseMaterialCost: 35, baseHours: 0.5, certRequired: false, isPerUnit: true, minCharge: 0 },
  { id: 'minor-works', name: 'Minor Works', baseMaterialCost: 20, baseHours: 1, certRequired: false, isPerUnit: false, minCharge: 0 },
  { id: 'cctv', name: 'CCTV', baseMaterialCost: 150, baseHours: 4, certRequired: false, isPerUnit: false, minCharge: 0 },
  { id: 'other', name: 'Other', baseMaterialCost: 0, baseHours: 1, certRequired: false, isPerUnit: false, minCharge: 0 },
]

export type JobStatus = 'Lead' | 'Quoted' | 'Accepted' | 'Scheduled' | 'In Progress' | 'Complete' | 'Invoiced' | 'Paid'
export type QuoteStatus = 'Draft' | 'Sent' | 'Viewed' | 'Accepted' | 'Expired' | 'Declined'
export type InvoiceStatus = 'Draft' | 'Sent' | 'Viewed' | 'Paid' | 'Overdue' | 'Voided'
export type InvoiceType = 'Deposit' | 'Progress' | 'Final' | 'Custom'
export type CommChannel = 'email' | 'whatsapp' | 'sms'
export type CommStatus = 'Sent' | 'Delivered' | 'Read' | 'Failed'
export type EventSlot = 'morning' | 'afternoon' | 'full' | 'quick'
export type EventStatus = 'Scheduled' | 'In Progress' | 'Complete'
export type ExpenseCategory = 'Materials' | 'Tools & Equipment' | 'Vehicle' | 'Insurance' | 'Subscriptions' | 'Training' | 'Other'

export interface Expense {
  id: string
  date: string
  supplier: string
  description: string
  category: ExpenseCategory
  amount: number
  vat: number
  total: number
  jobId?: string
  receipt: boolean
}

export interface Customer {
  id: string
  name: string
  phone: string
  email: string
  address1: string
  address2: string
  city: string
  postcode: string
  notes: string
  createdAt: string
}

export interface Quote {
  id: string
  ref: string // e.g. GH-Q1042
  customerId: string
  customerName: string
  jobTypeId: string
  jobTypeName: string
  description: string
  quantity: number
  difficulty: number
  hassleFactor: number
  emergency: boolean
  outOfHours: boolean
  certRequired: boolean
  customerSuppliesMaterials: boolean
  notes: string
  // calculated
  materials: number
  labour: number
  certificates: number
  waste: number
  subtotal: number
  adjustments: number
  netTotal: number
  vat: number
  grandTotal: number
  margin: number
  estHours: number
  // materials breakdown (line-item materials after sourcing)
  materialsBreakdown?: Array<{ description: string; quantity: number; unitPrice: number }>
  // meta
  status: QuoteStatus
  createdAt: string
  sentAt?: string
  viewedAt?: string
  acceptedAt?: string
  /**
   * True when the quote has been edited (e.g. materials override) since it
   * was last sent to the customer. Cleared when the quote is resent.
   */
  needsResend?: boolean
}

export interface Job {
  id: string
  customerId: string
  customerName: string
  quoteId?: string
  invoiceId?: string
  jobType: string
  value: number
  estimatedHours: number
  actualHours?: number
  status: JobStatus
  date: string
  notes: string
  createdAt: string
  isRecurring?: boolean
  recurrenceRule?: string
  recurrenceIntervalMonths?: number
  nextRecurrenceDate?: string
  parentJobId?: string
  /** ISO timestamp set when job is soft-deleted; null/undefined for active jobs */
  deletedAt?: string | null
  /** ISO timestamp set when the user explicitly marks the job as started.
   *  Distinct from `date` (the scheduled day) — captures when work actually
   *  began, used by Insights for accurate "actual hours" reporting. */
  startedAt?: string | null
}

export interface ScheduleEvent {
  id: string
  jobId?: string
  customerId?: string
  customerName: string
  jobType: string
  date: string // YYYY-MM-DD
  slot: EventSlot
  status: EventStatus
  notes: string
  /**
   * ISO timestamp set when the customer was sent a booking confirmation for
   * this slot. Null/undefined means the slot was added locally but the
   * customer hasn't been notified yet — used to drive the "Send confirmation"
   * prompt in the job panel and to batch multiple days into a single email.
   */
  confirmationSentAt?: string | null
  /**
   * Explicit start time in HH:MM format. Set by:
   *   - Quick fit-ins (always)
   *   - Half-day slots that have been auto-shrunk to make room for a quick
   * When null, the .ics/display layer falls back to the slot's symbolic
   * default (08:00 morning, 12:00 afternoon, 08:00 full).
   */
  startTime?: string | null
  /**
   * Explicit end time in HH:MM format. Same lifecycle as startTime — set
   * for quick events and for half-day slots that have been shrunk by a
   * conflicting quick. When null, falls back to slot defaults
   * (12:00 morning, 17:00 afternoon, 17:00 full, +1h after start for quick).
   */
  endTime?: string | null
  /**
   * Tag for internal (non-customer) calendar entries — 'travel', 'admin',
   * 'supplies', 'training', 'maintenance', 'break', 'other'. NULL means
   * this is a customer job (existing behaviour). When set, the event has
   * no jobId/customerId and customerName carries the preset display name.
   */
  category?: string | null
  /**
   * Snapshot of date/startTime/endTime at the moment the customer was last
   * sent a booking confirmation. Used by isEventConfirmed() to detect
   * whether the schedule has been moved since the customer was notified —
   * if the live values still match these, no resend is needed even if the
   * card was temporarily dragged elsewhere and put back.
   */
  confirmedDate?: string | null
  confirmedStartTime?: string | null
  confirmedEndTime?: string | null
}

/**
 * True if the customer has been told about this event AND its current
 * date/start/end times still match what they were told. False for events
 * never sent OR events that have been moved since.
 */
export function isEventConfirmed(ev: ScheduleEvent): boolean {
  if (!ev.confirmationSentAt) return false
  // Internal events have no customer to confirm with — always "confirmed".
  if (ev.category) return true
  // If the snapshot columns are missing (old data), fall back to the
  // legacy behaviour where the timestamp alone meant confirmed.
  if (ev.confirmedDate == null && ev.confirmedStartTime == null && ev.confirmedEndTime == null) return true
  if (ev.confirmedDate && ev.confirmedDate !== ev.date) return false
  if ((ev.confirmedStartTime || null) !== (ev.startTime || null)) return false
  if ((ev.confirmedEndTime || null) !== (ev.endTime || null)) return false
  return true
}

export interface Invoice {
  id: string
  ref: string // e.g. GH-INV015
  jobId: string
  quoteId?: string
  customerId: string
  customerName: string
  jobTypeName: string
  description: string
  type?: InvoiceType
  netTotal: number
  vat: number
  grandTotal: number
  status: InvoiceStatus
  createdAt: string
  sentAt?: string
  paidAt?: string
  dueDate: string
}

export interface CommLog {
  id: string
  customerId?: string
  customerName: string
  templateName: string
  channel: CommChannel
  status: CommStatus
  date: string
  body: string
}

/* ──────────────────────────────────────────────────────
   localStorage cache (fallback / backup)
   ────────────────────────────────────────────────────── */

const STORAGE_KEY = 'gh-data'

interface DataStore {
  customers: Customer[]
  quotes: Quote[]
  jobs: Job[]
  invoices: Invoice[]
  events: ScheduleEvent[]
  comms: CommLog[]
  expenses: Expense[]
  settings: AppSettings
  pricingConfig: PricingConfig
  jobTypeConfigs: JobTypeConfig[]
}

function emptyStore(): DataStore {
  return {
    customers: [],
    quotes: [],
    jobs: [],
    invoices: [],
    events: [],
    comms: [],
    expenses: [],
    settings: DEFAULT_SETTINGS,
    pricingConfig: DEFAULT_PRICING_CONFIG,
    jobTypeConfigs: DEFAULT_JOB_TYPE_CONFIGS,
  }
}

function loadCachedStore(): DataStore {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      // Backfill missing fields
      if (!parsed.invoices) parsed.invoices = []
      if (!parsed.expenses) parsed.expenses = []
      if (!parsed.settings) parsed.settings = DEFAULT_SETTINGS
      if (!parsed.pricingConfig) parsed.pricingConfig = DEFAULT_PRICING_CONFIG
      if (!parsed.jobTypeConfigs) parsed.jobTypeConfigs = DEFAULT_JOB_TYPE_CONFIGS
      return parsed
    } catch { /* fall through */ }
  }
  return emptyStore()
}

function saveCache(store: DataStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // localStorage full or unavailable — ignore
  }
}

/* ──────────────────────────────────────────────────────
   Supabase data loading
   ────────────────────────────────────────────────────── */

async function loadFromSupabase(): Promise<DataStore> {
  const [
    customers,
    quotes,
    jobs,
    invoices,
    events,
    comms,
    expenses,
    settingsResult,
    pricingResult,
    jobTypeConfigs,
  ] = await Promise.all([
    svc.fetchCustomers(),
    svc.fetchQuotes(),
    svc.fetchJobs(),
    svc.fetchInvoices(),
    svc.fetchEvents(),
    svc.fetchComms(),
    svc.fetchExpenses(),
    svc.fetchSettings(),
    svc.fetchPricingConfig(),
    svc.fetchJobTypeConfigs(),
  ])

  return {
    customers,
    quotes,
    jobs,
    invoices,
    events,
    comms,
    expenses,
    settings: settingsResult ?? DEFAULT_SETTINGS,
    pricingConfig: pricingResult ?? DEFAULT_PRICING_CONFIG,
    jobTypeConfigs: jobTypeConfigs.length > 0 ? jobTypeConfigs : DEFAULT_JOB_TYPE_CONFIGS,
  }
}

/* ──────────────────────────────────────────────────────
   Context
   ────────────────────────────────────────────────────── */

interface DataContextValue {
  // data
  customers: Customer[]
  quotes: Quote[]
  jobs: Job[]
  invoices: Invoice[]
  events: ScheduleEvent[]
  comms: CommLog[]
  // customer actions
  addCustomer: (c: Omit<Customer, 'id' | 'createdAt'>) => Customer
  updateCustomer: (id: string, updates: Partial<Customer>) => void
  deleteCustomer: (id: string) => void
  // quote actions
  addQuote: (q: Omit<Quote, 'id' | 'ref' | 'createdAt' | 'status'>) => Quote
  updateQuote: (id: string, updates: Partial<Quote>) => void
  // job actions
  addJob: (j: Omit<Job, 'id' | 'createdAt'>) => Job
  updateJob: (id: string, updates: Partial<Job>) => void
  moveJob: (id: string, status: JobStatus) => void
  softDeleteJob: (id: string) => void
  restoreJob: (id: string) => void
  // event actions
  addEvent: (e: Omit<ScheduleEvent, 'id'>) => ScheduleEvent
  updateEvent: (id: string, updates: Partial<ScheduleEvent>) => void
  deleteEvent: (id: string) => void
  // invoice actions
  addInvoice: (i: Omit<Invoice, 'id' | 'ref' | 'createdAt'>) => Invoice
  updateInvoice: (id: string, updates: Partial<Invoice>) => void
  deleteInvoice: (id: string) => void
  getInvoiceForJob: (jobId: string) => Invoice | undefined
  getInvoicesForJob: (jobId: string) => Invoice[]
  // comm actions
  addComm: (c: Omit<CommLog, 'id'>) => CommLog
  // expense actions
  expenses: Expense[]
  addExpense: (e: Omit<Expense, 'id'>) => Expense
  updateExpense: (id: string, updates: Partial<Expense>) => void
  deleteExpense: (id: string) => void
  // settings + pricing
  settings: AppSettings
  pricingConfig: PricingConfig
  jobTypeConfigs: JobTypeConfig[]
  updateSettings: (path: string, value: any) => void
  updatePricingConfig: (updates: Partial<PricingConfig>) => void
  updateJobTypeConfig: (id: string, updates: Partial<JobTypeConfig>) => void
  // helpers
  getCustomer: (id: string) => Customer | undefined
  getJobsForCustomer: (customerId: string) => Job[]
  getQuotesForCustomer: (customerId: string) => Quote[]
  getNextQuoteRef: () => string
  /**
   * Resolves a temp ID to its real Supabase UUID, waiting for the optimistic
   * insert to round-trip if necessary. Returns the input unchanged if it's
   * already a real UUID. Use this before building any external URL or
   * persisting a reference that the user might share.
   */
  awaitRealId: (id: string) => Promise<string>
  // loading state
  isDataLoading: boolean
}

const DataContext = createContext<DataContextValue>(null as any)

export function DataProvider({ orgId, children }: { orgId: string; children: ReactNode }) {
  const [store, setStore] = useState<DataStore>(emptyStore)
  const [isDataLoading, setIsDataLoading] = useState(true)

  // Keep a ref to orgId so background callbacks always have the latest value
  const orgIdRef = useRef(orgId)
  orgIdRef.current = orgId

  // Keep a ref to current store for synchronous reads inside callbacks
  const storeRef = useRef(store)
  storeRef.current = store

  /* ── Initial load from Supabase (fallback to localStorage) ── */
  useEffect(() => {
    if (!orgId) return

    let cancelled = false

    setIsDataLoading(true)
    loadFromSupabase()
      .then((data) => {
        if (cancelled) return
        setStore(data)
        saveCache(data)
        setIsDataLoading(false)
      })
      .catch((err) => {
        console.error('[DataContext] Supabase load failed, falling back to localStorage', err)
        if (cancelled) return
        setStore(loadCachedStore())
        setIsDataLoading(false)
      })

    return () => { cancelled = true }
  }, [orgId])

  /* ── Persist helper: update state + cache to localStorage ── */
  const persist = useCallback((updater: (prev: DataStore) => DataStore) => {
    setStore(prev => {
      const next = updater(prev)
      saveCache(next)
      return next
    })
  }, [])

  /* ── Fire-and-forget Supabase call with error logging ── */
  const bgCall = useCallback((fn: () => Promise<unknown>) => {
    fn().catch((err) => console.error('[DataContext] Supabase background write failed', err))
  }, [])

  // Map temp IDs to real Supabase IDs — used to resolve FK references
  const idMapRef = useRef<Record<string, string>>({})

  function resolveId(id: string | undefined): string | undefined {
    if (!id) return id
    return idMapRef.current[id] || id
  }

  // ── Customer ──
  const addCustomer = useCallback((c: Omit<Customer, 'id' | 'createdAt'>): Customer => {
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const created: Customer = { ...c, id: tempId, createdAt: new Date().toISOString().split('T')[0] }

    persist(s => ({ ...s, customers: [created, ...s.customers] }))

    bgCall(async () => {
      const real = await svc.insertCustomer(orgIdRef.current, c)
      // Store the mapping so quotes/jobs can resolve this temp ID
      idMapRef.current[tempId] = real.id
      setStore(prev => {
        const next = {
          ...prev,
          customers: prev.customers.map(cu => cu.id === tempId ? real : cu),
        }
        saveCache(next)
        return next
      })
    })

    return created
  }, [persist, bgCall])

  const updateCustomer = useCallback((id: string, updates: Partial<Customer>) => {
    persist(s => ({
      ...s,
      customers: s.customers.map(c => c.id === id ? { ...c, ...updates } : c),
    }))
    bgCall(() => svc.updateCustomer(id, updates))
  }, [persist, bgCall])

  const deleteCustomer = useCallback((id: string) => {
    persist(s => ({ ...s, customers: s.customers.filter(c => c.id !== id) }))
    bgCall(() => svc.deleteCustomer(id))
  }, [persist, bgCall])

  // Pending callbacks waiting for a temp ID to be resolved to a real Supabase
  // ID. Used by addQuote/addJob so consumers can update local state (e.g.
  // QuickQuote's activeQuoteId) once the server confirms the row.
  const pendingResolversRef = useRef<Record<string, ((realId: string) => void)[]>>({})

  function registerResolver(tempId: string, cb: (realId: string) => void) {
    if (!tempId.startsWith('tmp-')) { cb(tempId); return }
    const map = pendingResolversRef.current
    if (!map[tempId]) map[tempId] = []
    map[tempId].push(cb)
  }

  function fireResolvers(tempId: string, realId: string) {
    idMapRef.current[tempId] = realId
    const cbs = pendingResolversRef.current[tempId]
    if (cbs) {
      delete pendingResolversRef.current[tempId]
      cbs.forEach(cb => { try { cb(realId) } catch (err) { console.error(err) } })
    }
  }

  /**
   * Wait for a temp ID to be resolved to a real Supabase ID. Resolves
   * immediately if `id` is already a real UUID. Used to defer Supabase writes
   * until the row actually exists server-side.
   */
  function awaitRealId(id: string): Promise<string> {
    if (!id || !id.startsWith('tmp-')) return Promise.resolve(id)
    const mapped = idMapRef.current[id]
    if (mapped) return Promise.resolve(mapped)
    return new Promise(resolve => registerResolver(id, resolve))
  }

  // ── Quote ──
  const addQuote = useCallback((q: Omit<Quote, 'id' | 'ref' | 'createdAt' | 'status'>): Quote => {
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    // Generate a ref based on current count (best-effort; server may differ)
    const refNum = storeRef.current.quotes.length + 1
    const ref = `GH-Q${refNum}`
    const created: Quote = { ...q, id: tempId, ref, status: 'Draft', createdAt: new Date().toISOString().split('T')[0] }

    persist(s => ({ ...s, quotes: [created, ...s.quotes] }))

    bgCall(async () => {
      // Resolve any temp IDs to real Supabase IDs before inserting
      const resolved = { ...q, ref, status: 'Draft' as const, customerId: resolveId(q.customerId) || q.customerId }
      const real = await svc.insertQuote(orgIdRef.current, resolved)
      setStore(prev => {
        const next = { ...prev, quotes: prev.quotes.map(qu => qu.id === tempId ? real : qu) }
        saveCache(next)
        return next
      })
      fireResolvers(tempId, real.id)
    })

    return created
  }, [persist, bgCall])

  const updateQuote = useCallback((id: string, updates: Partial<Quote>) => {
    persist(s => ({
      ...s,
      quotes: s.quotes.map(q => q.id === id ? { ...q, ...updates } : q),
    }))
    bgCall(async () => {
      const realId = await awaitRealId(id)
      await svc.updateQuote(realId, updates)
    })
  }, [persist, bgCall])

  // ── Job ──
  const addJob = useCallback((j: Omit<Job, 'id' | 'createdAt'>): Job => {
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const created: Job = { ...j, id: tempId, createdAt: new Date().toISOString().split('T')[0] }

    persist(s => ({ ...s, jobs: [created, ...s.jobs] }))

    bgCall(async () => {
      // Resolve temp IDs for customer and quote references — wait for the
      // quote insert to finish if it's still in flight.
      const customerId = j.customerId && j.customerId.startsWith('tmp-')
        ? await awaitRealId(j.customerId) : j.customerId
      const quoteId = j.quoteId && j.quoteId.startsWith('tmp-')
        ? await awaitRealId(j.quoteId) : j.quoteId
      const resolved = { ...j, customerId: customerId || j.customerId, quoteId }
      const real = await svc.insertJob(orgIdRef.current, resolved)
      setStore(prev => {
        const next = { ...prev, jobs: prev.jobs.map(jo => jo.id === tempId ? real : jo) }
        saveCache(next)
        return next
      })
      fireResolvers(tempId, real.id)
    })

    return created
  }, [persist, bgCall])

  const updateJob = useCallback((id: string, updates: Partial<Job>) => {
    persist(s => ({
      ...s,
      jobs: s.jobs.map(j => j.id === id ? { ...j, ...updates } : j),
    }))
    bgCall(async () => {
      const realId = await awaitRealId(id)
      await svc.updateJob(realId, updates)
    })
  }, [persist, bgCall])

  const moveJob = useCallback((id: string, status: JobStatus) => {
    persist(s => ({
      ...s,
      jobs: s.jobs.map(j => j.id === id ? { ...j, status } : j),
    }))
    bgCall(async () => {
      const realId = await awaitRealId(id)
      await svc.moveJob(realId, status)
    })
  }, [persist, bgCall])

  const softDeleteJob = useCallback((id: string) => {
    const ts = new Date().toISOString()
    persist(s => ({
      ...s,
      jobs: s.jobs.map(j => j.id === id ? { ...j, deletedAt: ts } : j),
    }))
    bgCall(async () => {
      const realId = await awaitRealId(id)
      await svc.updateJob(realId, { deletedAt: ts } as Partial<Job>)
    })
  }, [persist, bgCall])

  const restoreJob = useCallback((id: string) => {
    persist(s => ({
      ...s,
      jobs: s.jobs.map(j => j.id === id ? { ...j, deletedAt: null } : j),
    }))
    bgCall(async () => {
      const realId = await awaitRealId(id)
      await svc.updateJob(realId, { deletedAt: null } as Partial<Job>)
    })
  }, [persist, bgCall])

  // ── Event ──
  const addEvent = useCallback((e: Omit<ScheduleEvent, 'id'>): ScheduleEvent => {
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const created: ScheduleEvent = { ...e, id: tempId }

    persist(s => ({ ...s, events: [...s.events, created] }))

    bgCall(async () => {
      const real = await svc.insertEvent(orgIdRef.current, e)
      setStore(prev => {
        const next = { ...prev, events: prev.events.map(ev => ev.id === tempId ? real : ev) }
        saveCache(next)
        return next
      })
    })

    return created
  }, [persist, bgCall])

  const updateEvent = useCallback((id: string, updates: Partial<ScheduleEvent>) => {
    // We no longer clear confirmation_sent_at here — the warning logic
    // compares the live date/start_time/end_time against confirmed_*
    // snapshot fields instead, so dragging an event away and back again
    // restores the "confirmed" state automatically.
    persist(s => ({
      ...s,
      events: s.events.map(e => e.id === id ? { ...e, ...updates } : e),
    }))
    bgCall(() => svc.updateEvent(id, updates))
  }, [persist, bgCall])

  const deleteEvent = useCallback((id: string) => {
    persist(s => ({ ...s, events: s.events.filter(e => e.id !== id) }))
    bgCall(() => svc.deleteEvent(id))
  }, [persist, bgCall])

  // ── Comm ──
  const addComm = useCallback((c: Omit<CommLog, 'id'>): CommLog => {
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const created: CommLog = { ...c, id: tempId }

    persist(s => ({ ...s, comms: [created, ...s.comms] }))

    bgCall(async () => {
      const real = await svc.insertComm(orgIdRef.current, c)
      setStore(prev => {
        const next = { ...prev, comms: prev.comms.map(cm => cm.id === tempId ? real : cm) }
        saveCache(next)
        return next
      })
    })

    return created
  }, [persist, bgCall])

  // ── Invoice ──
  const addInvoice = useCallback((i: Omit<Invoice, 'id' | 'ref' | 'createdAt'>): Invoice => {
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const invNum = storeRef.current.invoices.length + 1
    const ref = `GH-INV${String(invNum).padStart(3, '0')}`
    const created: Invoice = { ...i, id: tempId, ref, createdAt: new Date().toISOString().split('T')[0] }

    persist(s => ({ ...s, invoices: [created, ...s.invoices] }))

    bgCall(async () => {
      const real = await svc.insertInvoice(orgIdRef.current, { ...i, ref })
      setStore(prev => {
        const next = { ...prev, invoices: prev.invoices.map(inv => inv.id === tempId ? real : inv) }
        saveCache(next)
        return next
      })
    })

    return created
  }, [persist, bgCall])

  const updateInvoice = useCallback((id: string, updates: Partial<Invoice>) => {
    persist(s => ({
      ...s,
      invoices: s.invoices.map(i => i.id === id ? { ...i, ...updates } : i),
    }))
    bgCall(() => svc.updateInvoice(id, updates))
  }, [persist, bgCall])

  const deleteInvoice = useCallback((id: string) => {
    persist(s => ({ ...s, invoices: s.invoices.filter(i => i.id !== id) }))
    bgCall(() => svc.deleteInvoice(id))
  }, [persist, bgCall])

  const getInvoiceForJob = useCallback((jobId: string) => storeRef.current.invoices.find(i => i.jobId === jobId), [])
  const getInvoicesForJob = useCallback((jobId: string) => storeRef.current.invoices.filter(i => i.jobId === jobId), [])

  // ── Expense ──
  const addExpense = useCallback((e: Omit<Expense, 'id'>): Expense => {
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const created: Expense = { ...e, id: tempId }

    persist(s => ({ ...s, expenses: [created, ...s.expenses] }))

    bgCall(async () => {
      const real = await svc.insertExpense(orgIdRef.current, e)
      setStore(prev => {
        const next = { ...prev, expenses: prev.expenses.map(ex => ex.id === tempId ? real : ex) }
        saveCache(next)
        return next
      })
    })

    return created
  }, [persist, bgCall])

  const updateExpense = useCallback((id: string, updates: Partial<Expense>) => {
    persist(s => ({ ...s, expenses: s.expenses.map(e => e.id === id ? { ...e, ...updates } : e) }))
    bgCall(() => svc.updateExpense(id, updates))
  }, [persist, bgCall])

  const deleteExpense = useCallback((id: string) => {
    persist(s => ({ ...s, expenses: s.expenses.filter(e => e.id !== id) }))
    bgCall(() => svc.deleteExpense(id))
  }, [persist, bgCall])

  // ── Settings + Pricing ──
  const updateSettings = useCallback((path: string, value: any) => {
    persist(s => {
      const newSettings = JSON.parse(JSON.stringify(s.settings))
      const parts = path.split('.')
      let obj = newSettings as any
      for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]]
      obj[parts[parts.length - 1]] = value
      return { ...s, settings: newSettings }
    })
    // Read the latest settings after state update for the Supabase call
    bgCall(async () => {
      // Small delay to let React state settle so storeRef has the latest
      await new Promise(r => setTimeout(r, 0))
      await svc.upsertSettings(orgIdRef.current, storeRef.current.settings)
    })
  }, [persist, bgCall])

  const updatePricingConfig = useCallback((updates: Partial<PricingConfig>) => {
    persist(s => ({ ...s, pricingConfig: { ...s.pricingConfig, ...updates } }))
    bgCall(async () => {
      await new Promise(r => setTimeout(r, 0))
      await svc.upsertPricingConfig(orgIdRef.current, storeRef.current.pricingConfig)
    })
  }, [persist, bgCall])

  const updateJobTypeConfig = useCallback((id: string, updates: Partial<JobTypeConfig>) => {
    persist(s => ({
      ...s,
      jobTypeConfigs: s.jobTypeConfigs.map(jt => jt.id === id ? { ...jt, ...updates } : jt),
    }))
    bgCall(async () => {
      await new Promise(r => setTimeout(r, 0))
      await svc.upsertJobTypeConfigs(orgIdRef.current, storeRef.current.jobTypeConfigs)
    })
  }, [persist, bgCall])

  // ── Helpers ──
  const getCustomer = useCallback((id: string) => storeRef.current.customers.find(c => c.id === id), [])
  // Customer history intentionally includes soft-deleted jobs so the record stays retrievable
  const getJobsForCustomer = useCallback((customerId: string) => storeRef.current.jobs.filter(j => j.customerId === customerId), [])
  const getQuotesForCustomer = useCallback((customerId: string) => storeRef.current.quotes.filter(q => q.customerId === customerId), [])
  const getNextQuoteRef = useCallback(() => `GH-Q${storeRef.current.quotes.length + 1}`, [])
  const awaitRealIdCb = useCallback((id: string) => awaitRealId(id), [])

  // Soft-deleted jobs are hidden from the main `jobs` list everywhere — they remain
  // in the underlying store and surface only via getJobsForCustomer (customer history).
  const visibleJobs = useMemo(() => store.jobs.filter(j => !j.deletedAt), [store.jobs])

  return (
    <DataContext.Provider value={{
      customers: store.customers,
      quotes: store.quotes,
      jobs: visibleJobs,
      invoices: store.invoices,
      events: store.events,
      comms: store.comms,
      addCustomer, updateCustomer, deleteCustomer,
      addQuote, updateQuote,
      addJob, updateJob, moveJob, softDeleteJob, restoreJob,
      addInvoice, updateInvoice, deleteInvoice, getInvoiceForJob, getInvoicesForJob,
      addEvent, updateEvent, deleteEvent,
      addComm,
      expenses: store.expenses, addExpense, updateExpense, deleteExpense,
      settings: store.settings, pricingConfig: store.pricingConfig, jobTypeConfigs: store.jobTypeConfigs,
      updateSettings, updatePricingConfig, updateJobTypeConfig,
      getCustomer, getJobsForCustomer, getQuotesForCustomer, getNextQuoteRef,
      awaitRealId: awaitRealIdCb,
      isDataLoading,
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  return useContext(DataContext)
}
