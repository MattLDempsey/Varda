import { useState, useMemo } from 'react'
import { Plus, X, Check, Minus, ArrowUpDown } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useTheme } from '../theme/ThemeContext'
import { useData, type ExpenseCategory } from '../data/DataContext'
import { useSubscription } from '../subscription/SubscriptionContext'
import { useUndo } from '../hooks/useUndo'
import FeatureGate from '../components/FeatureGate'
import LoadingSpinner from '../components/LoadingSpinner'

/* ── types ── */

interface Expense {
  id: string
  date: string // YYYY-MM-DD
  supplier: string
  description: string
  category: 'Materials' | 'Tools & Equipment' | 'Vehicle' | 'Insurance' | 'Subscriptions' | 'Training' | 'Other'
  amount: number // net amount
  vat: number // VAT paid
  total: number // gross (amount + vat)
  jobId?: string // optional link to a job
  receipt?: boolean // whether receipt is held
}

type Category = Expense['category']

const CATEGORIES: Category[] = ['Materials', 'Tools & Equipment', 'Vehicle', 'Insurance', 'Subscriptions', 'Training', 'Other']

const CATEGORY_COLORS: Record<Category, string> = {
  Materials: '#C6A86A',
  'Tools & Equipment': '#5B9BD5',
  Vehicle: '#9B7ED8',
  Insurance: '#5BBFD4',
  Subscriptions: '#C9CDD2',
  Training: '#6ABF8A',
  Other: '#4B5057',
}

/* ── helpers ── */

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${d.getFullYear()}`
}

function fmtCurrency(n: number): string {
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function genId(): string {
  return 'EXP-' + Math.random().toString(36).slice(2, 9).toUpperCase()
}

/* ── seed data generator ── */

function generateSeedExpenses(): Expense[] {
  const expenses: Expense[] = []
  const now = new Date()

  // Helper to create a date string N days ago
  const daysAgo = (n: number): string => {
    const d = new Date(now)
    d.setDate(d.getDate() - n)
    return d.toISOString().split('T')[0]
  }

  const jobIds = Array.from({ length: 20 }, (_, i) => `J-${String(i + 1).padStart(3, '0')}`)

  // Materials purchases — spread across the year
  const materialSuppliers = [
    { supplier: 'Screwfix', items: ['Cable 6242Y 2.5mm 100m', 'Consumer unit 10-way', 'MCBs x10 pack', 'Socket outlets x5', 'LED downlights x6', 'Trunking 3m lengths', 'Junction boxes x10', 'Cable clips assorted', 'Back boxes x10', 'Wago connectors 50pk'] },
    { supplier: 'Edmundson Electrical', items: ['RCBO Type A 32A x4', 'SWA cable 25m', 'Henley blocks x3', 'Distribution board', 'Busbar chamber', 'Cable glands SWA x10', 'Isolator switch 100A', 'CT meter tails'] },
    { supplier: 'CEF', items: ['Fire alarm cable 100m', 'Emergency lighting units x4', 'Smoke detectors x6', 'LED battens x8', 'Containment tray 3m', 'Cable tray brackets x20', 'Flexible conduit 25m', 'MICC cable 50m'] },
    { supplier: 'Toolstation', items: ['Fixings assorted box', 'Drill bits set', 'First fix pack', 'Second fix pack', 'Sealant x6 tubes', 'Grommet pack', 'Earth rods x2', 'Saddle clips 100pk'] },
  ]

  // Spread ~25 material purchases across the year
  for (let i = 0; i < 25; i++) {
    const supplierData = materialSuppliers[i % materialSuppliers.length]
    const item = supplierData.items[i % supplierData.items.length]
    const net = Math.round((20 + Math.random() * 280) * 100) / 100
    const vatAmount = Math.round(net * 0.2 * 100) / 100
    expenses.push({
      id: genId(),
      date: daysAgo(Math.floor(Math.random() * 350) + 5),
      supplier: supplierData.supplier,
      description: item,
      category: 'Materials',
      amount: net,
      vat: vatAmount,
      total: Math.round((net + vatAmount) * 100) / 100,
      jobId: jobIds[Math.floor(Math.random() * jobIds.length)],
      receipt: Math.random() > 0.1,
    })
  }

  // Vehicle fuel — monthly
  const fuelSuppliers = ['Shell', 'BP']
  for (let i = 0; i < 12; i++) {
    const net = Math.round((55 + Math.random() * 30) * 100) / 100
    const vatAmount = Math.round(net * 0.2 * 100) / 100
    expenses.push({
      id: genId(),
      date: daysAgo(i * 30 + Math.floor(Math.random() * 10)),
      supplier: fuelSuppliers[i % 2],
      description: 'Diesel fuel',
      category: 'Vehicle',
      amount: net,
      vat: vatAmount,
      total: Math.round((net + vatAmount) * 100) / 100,
      receipt: true,
    })
  }

  // Insurance — quarterly payments
  for (let i = 0; i < 4; i++) {
    expenses.push({
      id: genId(),
      date: daysAgo(i * 90 + 15),
      supplier: 'Hiscox',
      description: 'Public liability & professional indemnity insurance',
      category: 'Insurance',
      amount: 145.00,
      vat: 0,
      total: 145.00,
      receipt: true,
    })
  }

  // NICEIC subscription
  expenses.push({
    id: genId(),
    date: daysAgo(120),
    supplier: 'NICEIC',
    description: 'Annual contractor registration',
    category: 'Subscriptions',
    amount: 445.00,
    vat: 89.00,
    total: 534.00,
    receipt: true,
  })

  // Other subscriptions
  expenses.push({
    id: genId(),
    date: daysAgo(60),
    supplier: 'Simpro',
    description: 'Job management software — annual',
    category: 'Subscriptions',
    amount: 360.00,
    vat: 72.00,
    total: 432.00,
    receipt: true,
  })

  expenses.push({
    id: genId(),
    date: daysAgo(30),
    supplier: 'Certsure',
    description: 'Electrical certification platform — monthly',
    category: 'Subscriptions',
    amount: 29.99,
    vat: 6.00,
    total: 35.99,
    receipt: true,
  })

  // Tool purchases
  const tools = [
    { supplier: 'Milwaukee', description: 'M18 SDS-Plus hammer drill', amount: 189.99, vat: 38.00 },
    { supplier: 'Fluke', description: 'Multifunction tester MFT1741', amount: 599.00, vat: 119.80 },
    { supplier: 'Knipex', description: 'VDE pliers set 5-piece', amount: 89.95, vat: 17.99 },
    { supplier: 'Megger', description: 'PAT tester PAT420', amount: 349.00, vat: 69.80 },
  ]

  tools.forEach((t, i) => {
    expenses.push({
      id: genId(),
      date: daysAgo(50 + i * 70),
      supplier: t.supplier,
      description: t.description,
      category: 'Tools & Equipment',
      amount: t.amount,
      vat: t.vat,
      total: Math.round((t.amount + t.vat) * 100) / 100,
      receipt: true,
    })
  })

  // Training courses
  expenses.push({
    id: genId(),
    date: daysAgo(200),
    supplier: 'JTL Training',
    description: '18th Edition wiring regulations update course',
    category: 'Training',
    amount: 275.00,
    vat: 0,
    total: 275.00,
    receipt: true,
  })

  expenses.push({
    id: genId(),
    date: daysAgo(90),
    supplier: 'EV Training Ltd',
    description: 'EV charger installation qualification',
    category: 'Training',
    amount: 495.00,
    vat: 0,
    total: 495.00,
    receipt: true,
  })

  // Sort by date descending
  expenses.sort((a, b) => b.date.localeCompare(a.date))

  return expenses
}

/* ── localStorage persistence ── */

const STORAGE_KEY = 'gh-expenses'

function loadExpenses(): Expense[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch { /* ignore */ }
  // No seed data — start clean for real businesses
  return []
}

function saveExpenses(expenses: Expense[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses))
}

/* ── component ── */

export default function Expenses() {
  const { C } = useTheme()
  const { jobs, expenses, addExpense, updateExpense, deleteExpense, isDataLoading } = useData()
  const { showUndo } = useUndo()
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'year' | 'overall'>('year')
  const [selectedYear, setSelectedYear] = useState('')
  const [sortField, setSortField] = useState<'date' | 'total'>('date')
  const [sortAsc, setSortAsc] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)

  // Form state
  const [formDate, setFormDate] = useState('')
  const [formSupplier, setFormSupplier] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formCategory, setFormCategory] = useState<Category>('Materials')
  const [formAmount, setFormAmount] = useState('')
  const [formVat, setFormVat] = useState('')
  const [formJobId, setFormJobId] = useState('')
  const [formReceipt, setFormReceipt] = useState(false)

  /* ── period filtering ── */

  const getMonday = (d: Date) => {
    const date = new Date(d)
    const day = date.getDay()
    date.setDate(date.getDate() - (day === 0 ? 6 : day - 1))
    date.setHours(0, 0, 0, 0)
    return date
  }

  // Available tax years from expenses
  const taxYears = useMemo(() => {
    const years = new Set<string>()
    const now = new Date()
    const curTaxYear = (now.getMonth() >= 3 && (now.getMonth() > 3 || now.getDate() >= 6))
      ? `${now.getFullYear()}/${now.getFullYear() + 1}` : `${now.getFullYear() - 1}/${now.getFullYear()}`
    years.add(curTaxYear)
    for (const e of expenses) {
      const d = new Date(e.date)
      const yr = (d.getMonth() >= 3 && (d.getMonth() > 3 || d.getDate() >= 6))
        ? `${d.getFullYear()}/${d.getFullYear() + 1}` : `${d.getFullYear() - 1}/${d.getFullYear()}`
      years.add(yr)
    }
    return [...years].sort().reverse()
  }, [expenses])

  const activeYear = selectedYear || taxYears[0] || ''
  const activeYearStart = useMemo(() => {
    if (!activeYear) return new Date()
    return new Date(parseInt(activeYear.split('/')[0]), 3, 6)
  }, [activeYear])
  const activeYearEnd = useMemo(() => {
    if (!activeYear) return new Date()
    return new Date(parseInt(activeYear.split('/')[1]), 3, 5)
  }, [activeYear])

  const filteredExpenses = useMemo(() => {
    const now = new Date()
    const start = (() => {
      if (period === 'week') return getMonday(now)
      if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1)
      if (period === 'quarter') return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
      if (period === 'overall') return new Date(2000, 0, 1)
      return activeYearStart
    })()
    const end = period === 'year' ? activeYearEnd : new Date(9999, 0)
    return expenses.filter(e => { const d = new Date(e.date); return d >= start && d <= end })
  }, [expenses, period, activeYearStart, activeYearEnd])

  const sortedExpenses = useMemo(() => {
    const sorted = [...filteredExpenses]
    sorted.sort((a, b) => {
      const cmp = sortField === 'date'
        ? a.date.localeCompare(b.date)
        : a.total - b.total
      return sortAsc ? cmp : -cmp
    })
    return sorted
  }, [filteredExpenses, sortField, sortAsc])

  /* ── summary computations ── */

  const summary = useMemo(() => {
    const totalGross = filteredExpenses.reduce((s, e) => s + e.total, 0)
    const totalVat = filteredExpenses.reduce((s, e) => s + e.vat, 0)
    const count = filteredExpenses.length

    // Top category
    const catTotals: Record<string, number> = {}
    filteredExpenses.forEach(e => {
      catTotals[e.category] = (catTotals[e.category] || 0) + e.total
    })
    let topCategory = 'None'
    let topCategoryAmount = 0
    Object.entries(catTotals).forEach(([cat, amt]) => {
      if (amt > topCategoryAmount) {
        topCategory = cat
        topCategoryAmount = amt
      }
    })

    return { totalGross, totalVat, count, topCategory, topCategoryAmount, catTotals }
  }, [filteredExpenses])

  /* ── category breakdown for bar chart ── */

  const categoryBreakdown = useMemo(() => {
    const maxVal = Math.max(...Object.values(summary.catTotals), 1)
    return CATEGORIES
      .map(cat => ({ category: cat, amount: summary.catTotals[cat] || 0 }))
      .filter(c => c.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .map(c => ({ ...c, pct: (c.amount / maxVal) * 100 }))
  }, [summary.catTotals])

  /* ── form helpers ── */

  function openAdd() {
    setEditingExpense(null)
    const today = new Date().toISOString().split('T')[0]
    setFormDate(today)
    setFormSupplier('')
    setFormDescription('')
    setFormCategory('Materials')
    setFormAmount('')
    setFormVat('')
    setFormJobId('')
    setFormReceipt(false)
    setPanelOpen(true)
  }

  function openEdit(exp: Expense) {
    setEditingExpense(exp)
    setFormDate(exp.date)
    setFormSupplier(exp.supplier)
    setFormDescription(exp.description)
    setFormCategory(exp.category)
    setFormAmount(String(exp.amount))
    setFormVat(String(exp.vat))
    setFormJobId(exp.jobId || '')
    setFormReceipt(exp.receipt || false)
    setPanelOpen(true)
  }

  function handleAmountChange(val: string) {
    setFormAmount(val)
    const num = parseFloat(val)
    if (!isNaN(num)) {
      setFormVat(String(Math.round(num * 0.2 * 100) / 100))
    }
  }

  function handleSave() {
    const net = parseFloat(formAmount) || 0
    const vat = parseFloat(formVat) || 0
    const data = {
      date: formDate,
      supplier: formSupplier,
      description: formDescription,
      category: formCategory as ExpenseCategory,
      amount: net,
      vat,
      total: Math.round((net + vat) * 100) / 100,
      jobId: formJobId || undefined,
      receipt: formReceipt,
    }

    if (editingExpense) {
      updateExpense(editingExpense.id, data)
    } else {
      addExpense(data)
    }
    setPanelOpen(false)
  }

  function handleDelete() {
    if (!editingExpense) return
    const expData = { ...editingExpense }
    deleteExpense(editingExpense.id)
    setPanelOpen(false)
    showUndo({
      message: `Deleted expense: ${expData.description || expData.supplier}`,
      undo: () => addExpense({
        date: expData.date, supplier: expData.supplier, description: expData.description,
        category: expData.category, amount: expData.amount, vat: expData.vat,
        total: expData.total, jobId: expData.jobId, receipt: expData.receipt ?? false,
      }),
    })
  }

  function toggleSort(field: 'date' | 'total') {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(false)
    }
  }

  /* ── styles ── */

  const s: Record<string, CSSProperties> = {
    page: { padding: 32, maxWidth: 1400, margin: '0 auto', position: 'relative', minHeight: '100%' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 },
    headerLeft: { display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
    heading: { fontSize: 28, fontWeight: 600, color: C.white },
    periodToggle: { display: 'flex', background: C.black, borderRadius: 8, overflow: 'hidden' },
    periodBtn: {
      padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13,
      fontWeight: 500, minHeight: 40, transition: 'background .15s, color .15s',
    },
    addBtn: {
      display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
      borderRadius: 10, background: C.gold, color: C.black, border: 'none',
      cursor: 'pointer', fontSize: 14, fontWeight: 600, minHeight: 44,
    },
    // Summary cards
    kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 },
    kpiCard: {
      background: C.charcoalLight, borderRadius: 12, padding: '20px 20px 16px',
      borderTop: '3px solid',
    },
    kpiLabel: { fontSize: 12, fontWeight: 600, color: C.silver, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 6 },
    kpiValue: { fontSize: 24, fontWeight: 700, color: C.white },
    kpiSub: { fontSize: 12, color: C.steel, marginTop: 4 },
    // Table
    tableWrap: { overflowX: 'auto', marginBottom: 32 },
    table: { width: '100%', borderCollapse: 'collapse' as const, background: C.charcoalLight, borderRadius: 12, overflow: 'hidden' },
    th: {
      textAlign: 'left' as const, padding: '14px 16px', fontSize: 12, fontWeight: 600,
      color: C.silver, textTransform: 'uppercase' as const, letterSpacing: 0.6,
      borderBottom: `1px solid ${C.steel}33`, cursor: 'default',
    },
    thSortable: {
      textAlign: 'left' as const, padding: '14px 16px', fontSize: 12, fontWeight: 600,
      color: C.silver, textTransform: 'uppercase' as const, letterSpacing: 0.6,
      borderBottom: `1px solid ${C.steel}33`, cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 4,
    },
    td: { padding: '14px 16px', fontSize: 14, color: C.white, borderBottom: `1px solid ${C.steel}1A` },
    tableRow: { cursor: 'pointer', transition: 'background .15s' },
    badge: {
      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
      textTransform: 'uppercase' as const, letterSpacing: 0.5, whiteSpace: 'nowrap',
    },
    // Category breakdown
    breakdownSection: { marginBottom: 32 },
    breakdownTitle: { fontSize: 18, fontWeight: 600, color: C.white, marginBottom: 16 },
    barRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 },
    barLabel: { fontSize: 13, color: C.silver, minWidth: 0, flex: '0 1 140px', textAlign: 'right' as const, whiteSpace: 'nowrap' as const, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const },
    barTrack: { flex: 1, height: 24, background: C.black, borderRadius: 6, overflow: 'hidden' },
    barAmount: { fontSize: 13, color: C.white, fontWeight: 500, flex: '0 0 auto', whiteSpace: 'nowrap' as const },
    // Panel
    overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 90 },
    panel: {
      position: 'fixed' as const, top: 0, right: 0, bottom: 0, width: 'min(440px, 100vw)', maxWidth: '100vw',
      background: C.charcoal, borderLeft: `1px solid ${C.steel}44`, zIndex: 100,
      overflowY: 'auto' as const, padding: 'clamp(16px, 4vw, 28px)', boxShadow: '-8px 0 32px rgba(0,0,0,.5)',
    },
    panelHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
    panelTitle: { fontSize: 20, fontWeight: 600, color: C.white },
    closeBtn: {
      background: 'transparent', border: 'none', color: C.silver, cursor: 'pointer',
      padding: 8, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    fieldLabel: {
      fontSize: 12, fontWeight: 600, color: C.silver, textTransform: 'uppercase' as const,
      letterSpacing: 0.5, marginBottom: 6, display: 'block',
    },
    input: {
      width: '100%', background: C.black, border: `1px solid ${C.steel}44`, borderRadius: 8,
      padding: '10px 14px', color: C.white, fontSize: 14, outline: 'none', minHeight: 44,
      boxSizing: 'border-box' as const, marginBottom: 16,
    },
    select: {
      width: '100%', background: C.black, border: `1px solid ${C.steel}44`, borderRadius: 8,
      padding: '10px 14px', color: C.white, fontSize: 14, outline: 'none', minHeight: 44,
      boxSizing: 'border-box' as const, marginBottom: 16, cursor: 'pointer',
    },
    toggleRow: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 0', marginBottom: 16,
    },
    toggleTrack: {
      width: 48, height: 26, borderRadius: 13, cursor: 'pointer', position: 'relative' as const,
      transition: 'background .2s', border: 'none', padding: 0,
    },
    toggleKnob: {
      width: 20, height: 20, borderRadius: '50%', background: '#fff',
      position: 'absolute' as const, top: 3, transition: 'left .2s',
    },
    saveBtn: {
      width: '100%', background: C.gold, color: C.black, border: 'none', borderRadius: 10,
      padding: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 44, marginTop: 8,
    },
    deleteBtn: {
      width: '100%', background: '#D46A6A22', color: '#D46A6A', border: 'none', borderRadius: 10,
      padding: 12, fontSize: 14, fontWeight: 500, cursor: 'pointer', minHeight: 44, marginTop: 8,
    },
    fieldRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
    emptyState: {
      textAlign: 'center' as const, padding: '48px 24px', color: C.steel, fontSize: 15,
    },
  }

  const { canUse: canUseFeature } = useSubscription()
  const expensesLocked = !canUseFeature('expenses')

  if (isDataLoading) {
    return (
      <FeatureGate feature="expenses">
      <div style={s.page}>
        <h1 style={s.heading}>Expenses</h1>
        <LoadingSpinner message="Loading expenses..." />
      </div>
      </FeatureGate>
    )
  }

  return (
    <FeatureGate feature="expenses">
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <h1 style={s.heading}>Expenses</h1>
          <div style={s.periodToggle}>
            {(['week', 'month', 'quarter', 'overall'] as const).map(p => (
              <button
                key={p}
                style={{
                  ...s.periodBtn,
                  background: period === p ? C.charcoalLight : 'transparent',
                  color: period === p ? C.gold : C.steel,
                }}
                onClick={() => setPeriod(p)}
              >
                {p === 'overall' ? 'Overall' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
            <div style={{ position: 'relative' }}>
              <select
                value={period === 'year' ? activeYear : ''}
                onChange={e => { setSelectedYear(e.target.value); setPeriod('year') }}
                style={{
                  ...s.periodBtn,
                  background: period === 'year' ? C.charcoalLight : 'transparent',
                  color: period === 'year' ? C.gold : C.steel,
                  appearance: 'none', WebkitAppearance: 'none' as any,
                  paddingRight: 24, cursor: 'pointer', border: 'none', outline: 'none',
                }}
              >
                {taxYears.map(yr => (
                  <option key={yr} value={yr} style={{ color: C.white, background: C.black }}>FY {yr}</option>
                ))}
              </select>
              <div style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: C.steel }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
          </div>
        </div>
        <button style={s.addBtn} onClick={openAdd}>
          <Plus size={18} /> Add Expense
        </button>
      </div>

      {/* Summary Cards */}
      <div style={s.kpiRow}>
        <div style={{ ...s.kpiCard, borderTopColor: C.gold }}>
          <div style={s.kpiLabel}>Total Expenses</div>
          <div style={s.kpiValue}>{fmtCurrency(summary.totalGross)}</div>
          <div style={s.kpiSub}>Gross (inc. VAT)</div>
        </div>
        <div style={{ ...s.kpiCard, borderTopColor: '#5BBFD4' }}>
          <div style={s.kpiLabel}>VAT Reclaimable</div>
          <div style={s.kpiValue}>{fmtCurrency(summary.totalVat)}</div>
          <div style={s.kpiSub}>Claim back from HMRC</div>
        </div>
        <div style={{ ...s.kpiCard, borderTopColor: CATEGORY_COLORS[summary.topCategory as Category] || C.steel }}>
          <div style={s.kpiLabel}>Top Category</div>
          <div style={s.kpiValue}>{fmtCurrency(summary.topCategoryAmount)}</div>
          <div style={s.kpiSub}>{summary.topCategory}</div>
        </div>
        <div style={{ ...s.kpiCard, borderTopColor: '#9B7ED8' }}>
          <div style={s.kpiLabel}>Transactions</div>
          <div style={s.kpiValue}>{summary.count}</div>
          <div style={s.kpiSub}>In selected period</div>
        </div>
      </div>

      {/* Expenses Table */}
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>
                <span
                  style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                  onClick={() => toggleSort('date')}
                >
                  Date <ArrowUpDown size={12} />
                </span>
              </th>
              <th style={s.th}>Supplier</th>
              <th style={s.th}>Description</th>
              <th style={s.th}>Category</th>
              <th style={s.th}>Net</th>
              <th style={s.th}>VAT</th>
              <th style={s.th}>
                <span
                  style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                  onClick={() => toggleSort('total')}
                >
                  Total <ArrowUpDown size={12} />
                </span>
              </th>
              <th style={{ ...s.th, textAlign: 'center' }}>Receipt</th>
            </tr>
          </thead>
          <tbody>
            {sortedExpenses.length === 0 ? (
              <tr>
                <td colSpan={8} style={s.emptyState}>
                  {expenses.length === 0
                    ? 'No expenses recorded. Track your business costs here.'
                    : 'No expenses in this period'}
                </td>
              </tr>
            ) : (
              sortedExpenses.map(exp => (
                <tr
                  key={exp.id}
                  style={s.tableRow}
                  onClick={() => openEdit(exp)}
                  onMouseEnter={e => { e.currentTarget.style.background = `${C.steel}15` }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <td style={s.td}>{fmtDate(exp.date)}</td>
                  <td style={{ ...s.td, fontWeight: 500 }}>{exp.supplier}</td>
                  <td style={{ ...s.td, color: C.silver, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp.description}</td>
                  <td style={s.td}>
                    <span style={{
                      ...s.badge,
                      color: CATEGORY_COLORS[exp.category],
                      background: CATEGORY_COLORS[exp.category] + '1A',
                    }}>
                      {exp.category}
                    </span>
                  </td>
                  <td style={s.td}>{fmtCurrency(exp.amount)}</td>
                  <td style={{ ...s.td, color: C.steel }}>{fmtCurrency(exp.vat)}</td>
                  <td style={{ ...s.td, fontWeight: 600 }}>{fmtCurrency(exp.total)}</td>
                  <td style={{ ...s.td, textAlign: 'center' }}>
                    {exp.receipt
                      ? <Check size={16} color={C.green} />
                      : <Minus size={16} color={C.steel} />
                    }
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Category Breakdown */}
      {categoryBreakdown.length > 0 && (
        <div style={s.breakdownSection}>
          <h2 style={s.breakdownTitle}>Spend by Category</h2>
          {categoryBreakdown.map(({ category, amount, pct }) => (
            <div key={category} style={s.barRow}>
              <span style={s.barLabel}>{category}</span>
              <div style={s.barTrack}>
                <div style={{
                  width: `${pct}%`, height: '100%',
                  background: CATEGORY_COLORS[category],
                  borderRadius: 6, transition: 'width .3s',
                }} />
              </div>
              <span style={s.barAmount}>{fmtCurrency(amount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Panel */}
      {panelOpen && (
        <>
          <div style={s.overlay} onClick={() => setPanelOpen(false)} />
          <div style={s.panel}>
            <div style={s.panelHeader}>
              <span style={s.panelTitle}>{editingExpense ? 'Edit Expense' : 'Add Expense'}</span>
              <button style={s.closeBtn} onClick={() => setPanelOpen(false)}>
                <X size={22} />
              </button>
            </div>

            <label style={s.fieldLabel}>Date</label>
            <input
              type="date"
              style={s.input}
              value={formDate}
              onChange={e => setFormDate(e.target.value)}
            />

            <label style={s.fieldLabel}>Supplier</label>
            <input
              style={s.input}
              value={formSupplier}
              onChange={e => setFormSupplier(e.target.value)}
              placeholder="e.g. Screwfix, Shell"
            />

            <label style={s.fieldLabel}>Description</label>
            <input
              style={s.input}
              value={formDescription}
              onChange={e => setFormDescription(e.target.value)}
              placeholder="What was purchased"
            />

            <label style={s.fieldLabel}>Category</label>
            <select
              style={s.select}
              value={formCategory}
              onChange={e => setFormCategory(e.target.value as Category)}
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <div style={s.fieldRow}>
              <div>
                <label style={s.fieldLabel}>Net Amount</label>
                <input
                  type="number"
                  step="0.01"
                  style={s.input}
                  value={formAmount}
                  onChange={e => handleAmountChange(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label style={s.fieldLabel}>VAT</label>
                <input
                  type="number"
                  step="0.01"
                  style={s.input}
                  value={formVat}
                  onChange={e => setFormVat(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <label style={s.fieldLabel}>Link to Job (optional)</label>
            <select
              style={s.select}
              value={formJobId}
              onChange={e => setFormJobId(e.target.value)}
            >
              <option value="">None</option>
              {jobs.map(j => (
                <option key={j.id} value={j.id}>
                  {j.id} — {j.customerName} — {j.jobType}
                </option>
              ))}
            </select>

            <div style={s.toggleRow}>
              <span style={{ fontSize: 14, color: C.white }}>Receipt held</span>
              <button
                style={{
                  ...s.toggleTrack,
                  background: formReceipt ? C.green : C.steel,
                }}
                onClick={() => setFormReceipt(!formReceipt)}
              >
                <div style={{
                  ...s.toggleKnob,
                  left: formReceipt ? 25 : 3,
                }} />
              </button>
            </div>

            {/* Total preview */}
            <div style={{
              background: C.black, borderRadius: 10, padding: '14px 16px', marginBottom: 20,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 14, color: C.silver }}>Total (gross)</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: C.gold }}>
                {fmtCurrency((parseFloat(formAmount) || 0) + (parseFloat(formVat) || 0))}
              </span>
            </div>

            <button style={s.saveBtn} onClick={handleSave}>
              {editingExpense ? 'Update Expense' : 'Save Expense'}
            </button>

            {editingExpense && (
              <button style={s.deleteBtn} onClick={handleDelete}>
                Delete Expense
              </button>
            )}
          </div>
        </>
      )}
    </div>
    </FeatureGate>
  )
}
