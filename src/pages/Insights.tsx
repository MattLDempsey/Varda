import { useState, useMemo, useCallback } from 'react'
import { TrendingUp, TrendingDown, AlertTriangle, Award, X } from 'lucide-react'
import InsightModal from '../components/InsightModal'
import { useTheme } from '../theme/ThemeContext'
import { useData } from '../data/DataContext'
import { useIsMobile } from '../hooks/useIsMobile'
import { useSubscription } from '../subscription/SubscriptionContext'

import FeatureGate from '../components/FeatureGate'
import type { CSSProperties } from 'react'

/* ── helpers ── */

function fmtCurrency(n: number): string {
  return '£' + n.toLocaleString('en-GB', { maximumFractionDigits: 0 })
}

function monthKey(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function shortMonth(key: string): string {
  const [y, m] = key.split('-')
  const d = new Date(Number(y), Number(m) - 1)
  return d.toLocaleString('en-GB', { month: 'short' })
}

/* smart alerts are now computed inside the component from real data */

export default function Insights() {
  const { C } = useTheme()
  const { jobs, quotes, customers, expenses, invoices } = useData()
  const { canUse } = useSubscription()
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'year' | 'overall'>('year')
  const [selectedYear, setSelectedYear] = useState('')
  const [expandedJobType, setExpandedJobType] = useState<string | null>(null)
  // Modal state for drill-down views — null = closed, string = which modal
  type ModalType = 'allJobTypes' | 'allCustomers' | 'revenueKpi' | 'avgValueKpi' | 'winRateKpi' | 'durationKpi' | 'revenueSummary' | 'costsSummary' | 'profitSummary' | 'taxSummary' | null
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  // Financial Summary + VAT: toggle between actuals-to-date and full year projected
  const [financialView, setFinancialView] = useState<'actuals' | 'projected'>('actuals')
  const [insightsView, setInsightsView] = useState<'simple' | 'detailed'>(() =>
    (localStorage.getItem('varda-insights-view') as 'simple' | 'detailed') || 'simple'
  )
  const isMobile = useIsMobile()
  const handleViewToggle = useCallback((v: 'simple' | 'detailed') => {
    setInsightsView(v)
    localStorage.setItem('varda-insights-view', v)
  }, [])

  // Only paid jobs count in Insights — money received
  // Enrich with quote values as fallback for jobs with stale data
  const paidJobs = useMemo(() => jobs.filter(j => j.status === 'Paid').map(j => {
    if (j.value > 0 && j.jobType !== 'TBC') return j
    const q = j.quoteId ? quotes.find(qq => qq.id === j.quoteId) : undefined
    return {
      ...j,
      value: j.value > 0 ? j.value : (q?.netTotal || 0),
      jobType: j.jobType !== 'TBC' ? j.jobType : (q?.jobTypeName || 'TBC'),
      estimatedHours: j.estimatedHours > 0 ? j.estimatedHours : (q?.estHours || 0),
    }
  }), [jobs, quotes])

  // Available tax years from data
  const taxYears = useMemo(() => {
    const years = new Set<string>()
    const now = new Date()
    // Current tax year always included
    const curTaxYear = (now.getMonth() >= 3 && (now.getMonth() > 3 || now.getDate() >= 6))
      ? `${now.getFullYear()}/${now.getFullYear() + 1}` : `${now.getFullYear() - 1}/${now.getFullYear()}`
    years.add(curTaxYear)
    for (const j of paidJobs) {
      const d = new Date(j.date)
      const yr = (d.getMonth() >= 3 && (d.getMonth() > 3 || d.getDate() >= 6))
        ? `${d.getFullYear()}/${d.getFullYear() + 1}` : `${d.getFullYear() - 1}/${d.getFullYear()}`
      years.add(yr)
    }
    return [...years].sort().reverse()
  }, [paidJobs])

  // Default to current tax year
  const activeYear = selectedYear || taxYears[0] || ''
  const activeYearStart = useMemo(() => {
    if (!activeYear) return new Date()
    const startYr = parseInt(activeYear.split('/')[0])
    return new Date(startYr, 3, 6) // 6 April
  }, [activeYear])
  const activeYearEnd = useMemo(() => {
    if (!activeYear) return new Date()
    const endYr = parseInt(activeYear.split('/')[1])
    return new Date(endYr, 3, 5) // 5 April
  }, [activeYear])

  // Get Monday of current week
  const getMonday = (d: Date) => {
    const date = new Date(d)
    const day = date.getDay()
    date.setDate(date.getDate() - (day === 0 ? 6 : day - 1))
    date.setHours(0, 0, 0, 0)
    return date
  }

  /* ── computed KPIs ── */
  const computed = useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    // Revenue for selected period
    const periodStart = (() => {
      if (period === 'week') return getMonday(now)
      if (period === 'month') return new Date(currentYear, currentMonth, 1)
      if (period === 'quarter') return new Date(currentYear, Math.floor(currentMonth / 3) * 3, 1)
      // YTD — UK tax year starts April 6
      return activeYearStart
    })()

    const periodJobs = paidJobs.filter(j => new Date(j.date) >= periodStart)
    const revenue = periodJobs.reduce((sum, j) => sum + j.value, 0)

    // Avg Job Value: across paid jobs
    const avgJobValue = paidJobs.length > 0 ? paidJobs.reduce((sum, j) => sum + j.value, 0) / paidJobs.length : 0

    // Win Rate: accepted quotes vs total non-Draft quotes
    const nonDraftQuotes = quotes.filter(q => q.status !== 'Draft')
    const acceptedQuotes = nonDraftQuotes.filter(q => q.status === 'Accepted')
    const winRate = nonDraftQuotes.length > 0 ? (acceptedQuotes.length / nonDraftQuotes.length) * 100 : 0

    // Avg Duration
    const avgDuration = paidJobs.length > 0
      ? paidJobs.reduce((sum, j) => sum + j.estimatedHours, 0) / paidJobs.length : 0

    return { revenue, avgJobValue, winRate, avgDuration, periodJobs: periodJobs.length }
  }, [paidJobs, quotes, period])

  const periodLabels: Record<string, string> = { week: 'This Week', month: 'This Month', quarter: 'This Quarter', year: `FY ${activeYear}`, overall: 'All Time' }

  // Filter paid jobs to selected period
  const periodJobs = useMemo(() => {
    const now = new Date()
    const start = (() => {
      if (period === 'week') return getMonday(now)
      if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1)
      if (period === 'quarter') return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
      if (period === 'overall') return new Date(2000, 0, 1) // all time
      return activeYearStart
    })()
    const end = period === 'year' ? activeYearEnd : new Date(9999, 0)
    return paidJobs.filter(j => { const d = new Date(j.date); return d >= start && d <= end })
  }, [paidJobs, period, activeYearStart, activeYearEnd])

  const kpis: { label: string; value: string; change: string; up: boolean; modal: ModalType }[] = [
    { label: `Revenue — ${periodLabels[period]}`, value: fmtCurrency(periodJobs.reduce((s, j) => s + j.value, 0)), change: `${periodJobs.length} jobs`, up: true, modal: 'revenueKpi' },
    { label: 'Avg Job Value', value: fmtCurrency(periodJobs.length > 0 ? Math.round(periodJobs.reduce((s, j) => s + j.value, 0) / periodJobs.length) : 0), change: `${periodJobs.length} jobs`, up: true, modal: 'avgValueKpi' },
    { label: 'Win Rate', value: `${Math.round(computed.winRate)}%`, change: 'quotes accepted', up: computed.winRate > 50, modal: 'winRateKpi' },
    { label: 'Avg Duration', value: `${periodJobs.length > 0 ? (periodJobs.reduce((s, j) => s + j.estimatedHours, 0) / periodJobs.length).toFixed(1) : '0.0'}h`, change: 'per job', up: true, modal: 'durationKpi' },
  ]

  // Helper: get cost for a job from its linked quote
  const getJobCost = useCallback((j: typeof paidJobs[0]) => {
    // First check if there are actual expenses linked to this job
    const jobExpenses = expenses.filter(e => e.jobId === j.id)
    if (jobExpenses.length > 0) return jobExpenses.reduce((s, e) => s + e.amount, 0)
    // Fall back to quote-based estimate
    const q = j.quoteId ? quotes.find(qq => qq.id === j.quoteId) : undefined
    return q ? (q.materials + q.waste + q.certificates) : j.value * 0.35
  }, [quotes, expenses])

  /* ── revenue/costs/profit chart — adapts to period ── */
  const revenueChart = useMemo(() => {
    const now = new Date()
    const bars: { label: string; revenue: number; costs: number; profit: number; key: string; isFuture?: boolean }[] = []

    const calcBar = (matchingJobs: typeof paidJobs) => {
      const revenue = matchingJobs.reduce((s, j) => s + j.value, 0)
      const costs = matchingJobs.reduce((s, j) => s + getJobCost(j), 0)
      return { revenue, costs, profit: revenue - costs }
    }

    if (period === 'week') {
      const monday = getMonday(now)
      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday); d.setDate(d.getDate() + i)
        const key = d.toISOString().split('T')[0]
        const isFuture = d > now
        const { revenue, costs, profit } = calcBar(periodJobs.filter(j => j.date === key))
        bars.push({ label: dayNames[i], revenue, costs, profit, key, isFuture })
      }
    } else if (period === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      let weekStart = getMonday(monthStart)
      let w = 0
      while (weekStart <= monthEnd) {
        const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6)
        const { revenue, costs, profit } = calcBar(periodJobs.filter(j => {
          const d = new Date(j.date); return d >= weekStart && d <= weekEnd
        }))
        bars.push({ label: `${weekStart.getDate()}-${Math.min(weekEnd.getDate(), monthEnd.getDate())}`, revenue, costs, profit, key: `w${w}` })
        weekStart = new Date(weekStart); weekStart.setDate(weekStart.getDate() + 7)
        w++
      }
    } else if (period === 'quarter') {
      const qStart = Math.floor(now.getMonth() / 3) * 3
      for (let i = 0; i < 3; i++) {
        const d = new Date(now.getFullYear(), qStart + i, 1)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const { revenue, costs, profit } = calcBar(paidJobs.filter(j => monthKey(j.date) === key))
        bars.push({ label: shortMonth(key), revenue, costs, profit, key })
      }
    } else if (period === 'overall') {
      // Annual bars for each tax year
      for (const yr of taxYears.slice().reverse()) {
        const startYr = parseInt(yr.split('/')[0])
        const yrStart = new Date(startYr, 3, 6)
        const yrEnd = new Date(startYr + 1, 3, 5)
        const { revenue, costs, profit } = calcBar(paidJobs.filter(j => {
          const d = new Date(j.date); return d >= yrStart && d <= yrEnd
        }))
        bars.push({ label: `FY ${yr.split('/').map(y => y.slice(-2)).join('/')}`, revenue, costs, profit, key: yr })
      }
    } else {
      // Financial year — Apr to Mar
      const startYear = activeYearStart.getFullYear()
      for (let i = 0; i < 12; i++) {
        const d = new Date(startYear, 3 + i, 1)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const isFuture = d.getFullYear() > now.getFullYear() || (d.getFullYear() === now.getFullYear() && d.getMonth() > now.getMonth())
        const { revenue, costs, profit } = calcBar(paidJobs.filter(j => monthKey(j.date) === key))
        bars.push({ label: shortMonth(key), revenue, costs, profit, key, isFuture })
      }
    }
    return bars
  }, [periodJobs, paidJobs, period, getJobCost])

  const chartLabels: Record<string, string> = { week: 'Daily', month: 'Weekly', quarter: 'Monthly', year: 'Monthly', overall: 'Annual' }

  /* ── job type performance (filtered to period) with REAL margins and trends ── */
  const jobTypePerformance = useMemo(() => {
    const byType: Record<string, { jobs: number; revenue: number; costs: number }> = {}
    for (const j of periodJobs) {
      if (!byType[j.jobType]) byType[j.jobType] = { jobs: 0, revenue: 0, costs: 0 }
      byType[j.jobType].jobs += 1
      byType[j.jobType].revenue += j.value
      byType[j.jobType].costs += getJobCost(j)
    }

    // Compute previous period for trend comparison
    const now = new Date()
    const prevStart = (() => {
      if (period === 'week') { const d = getMonday(now); d.setDate(d.getDate() - 7); return d }
      if (period === 'month') return new Date(now.getFullYear(), now.getMonth() - 1, 1)
      if (period === 'quarter') return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 - 3, 1)
      if (period === 'overall') return new Date(2000, 0, 1)
      const ys = new Date(activeYearStart); ys.setFullYear(ys.getFullYear() - 1); return ys
    })()
    const prevEnd = (() => {
      if (period === 'week') return getMonday(now)
      if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1)
      if (period === 'quarter') return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
      if (period === 'overall') return new Date(2000, 0, 1)
      return activeYearStart
    })()
    const prevJobs = paidJobs.filter(j => { const d = new Date(j.date); return d >= prevStart && d < prevEnd })
    const prevByType: Record<string, number> = {}
    for (const j of prevJobs) prevByType[j.jobType] = (prevByType[j.jobType] ?? 0) + j.value

    return Object.entries(byType)
      .map(([type, d]) => {
        const margin = d.revenue > 0 ? Math.round(((d.revenue - d.costs) / d.revenue) * 100) : 0
        const prevRevenue = prevByType[type] ?? 0
        const trend: 'up' | 'down' | 'flat' = prevRevenue === 0
          ? (d.revenue > 0 ? 'up' : 'flat')
          : d.revenue > prevRevenue * 1.05 ? 'up' : d.revenue < prevRevenue * 0.95 ? 'down' : 'flat'
        return {
          type,
          jobs: d.jobs,
          revenue: fmtCurrency(d.revenue),
          revenueRaw: d.revenue,
          costsRaw: d.costs,
          avgPrice: fmtCurrency(Math.round(d.revenue / d.jobs)),
          margin: `${margin}%`,
          marginNum: margin,
          trend,
        }
      })
      .sort((a, b) => b.jobs - a.jobs)
  }, [periodJobs, paidJobs, period, getJobCost, activeYearStart])

  /* ── smart alerts computed from real data ── */
  const smartAlerts = useMemo(() => {
    const alerts: { type: 'warning' | 'info' | 'success'; message: string }[] = []
    if (periodJobs.length < 3) return alerts // not enough data

    // 1. Find the highest-margin job type
    const typeStats: Record<string, { revenue: number; costs: number; jobs: number }> = {}
    for (const j of periodJobs) {
      if (!typeStats[j.jobType]) typeStats[j.jobType] = { revenue: 0, costs: 0, jobs: 0 }
      typeStats[j.jobType].revenue += j.value
      typeStats[j.jobType].costs += getJobCost(j)
      typeStats[j.jobType].jobs += 1
    }

    let bestType = '', bestMargin = 0, worstType = '', worstMargin = 100
    for (const [type, s] of Object.entries(typeStats)) {
      if (s.jobs < 2) continue
      const margin = s.revenue > 0 ? ((s.revenue - s.costs) / s.revenue) * 100 : 0
      if (margin > bestMargin) { bestMargin = margin; bestType = type }
      if (margin < worstMargin) { worstMargin = margin; worstType = type }
    }
    if (bestType && bestMargin > 50) {
      alerts.push({ type: 'success', message: `${bestType} is your most profitable job type at ${Math.round(bestMargin)}% margin` })
    }
    if (worstType && worstMargin < 30 && worstType !== bestType) {
      alerts.push({ type: 'warning', message: `${worstType} margin is only ${Math.round(worstMargin)}% — consider raising your price or reducing costs` })
    }

    // 2. Revenue trend
    const now = new Date()
    const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const sixtyDaysAgo = new Date(now); sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
    const recentRev = paidJobs.filter(j => new Date(j.date) >= thirtyDaysAgo).reduce((s, j) => s + j.value, 0)
    const priorRev = paidJobs.filter(j => { const d = new Date(j.date); return d >= sixtyDaysAgo && d < thirtyDaysAgo }).reduce((s, j) => s + j.value, 0)
    if (priorRev > 0 && recentRev > priorRev * 1.2) {
      alerts.push({ type: 'success', message: `Revenue up ${Math.round((recentRev / priorRev - 1) * 100)}% vs previous 30 days — keep it up` })
    } else if (priorRev > 0 && recentRev < priorRev * 0.8) {
      alerts.push({ type: 'warning', message: `Revenue down ${Math.round((1 - recentRev / priorRev) * 100)}% vs previous 30 days — check your pipeline` })
    }

    // 3. Quote conversion speed
    const sentQuotes = quotes.filter(q => q.status !== 'Draft' && q.sentAt)
    const acceptedQuotes = sentQuotes.filter(q => q.status === 'Accepted' && q.acceptedAt && q.sentAt)
    if (acceptedQuotes.length >= 3) {
      const avgDays = acceptedQuotes.reduce((s, q) => {
        const sent = new Date(q.sentAt!).getTime()
        const accepted = new Date(q.acceptedAt!).getTime()
        return s + (accepted - sent) / 86400000
      }, 0) / acceptedQuotes.length
      if (avgDays <= 2) {
        alerts.push({ type: 'success', message: `Quotes are being accepted in ${avgDays.toFixed(1)} days on average — fast turnaround` })
      } else if (avgDays > 7) {
        alerts.push({ type: 'info', message: `Average ${Math.round(avgDays)} days from quote to acceptance — consider following up sooner` })
      }
    }

    // 4. Outstanding invoices
    const overdueInvoices = invoices.filter(i => i.status === 'Sent' && i.dueDate && i.dueDate < now.toISOString().split('T')[0])
    if (overdueInvoices.length > 0) {
      const overdueTotal = overdueInvoices.reduce((s, i) => s + i.grandTotal, 0)
      alerts.push({ type: 'warning', message: `${overdueInvoices.length} overdue invoice${overdueInvoices.length > 1 ? 's' : ''} totalling ${fmtCurrency(overdueTotal)} — chase payment` })
    }

    // 5. Growing job type
    for (const [type, s] of Object.entries(typeStats)) {
      if (s.jobs < 3) continue
      const prevCount = paidJobs.filter(j => {
        const d = new Date(j.date)
        return j.jobType === type && d >= sixtyDaysAgo && d < thirtyDaysAgo
      }).length
      const recentCount = paidJobs.filter(j => new Date(j.date) >= thirtyDaysAgo && j.jobType === type).length
      if (prevCount > 0 && recentCount >= prevCount * 1.5 && recentCount >= 3) {
        alerts.push({ type: 'info', message: `${type} demand up ${Math.round((recentCount / prevCount - 1) * 100)}% — consider raising your base price` })
      }
    }

    // 6. Pricing intelligence — per-job-type win rate analysis
    // An unusually high win rate signals underpricing (market would bear
    // more). Low win rate signals overpricing or strong competition.
    // Cross-referenced with margin for actionable advice.
    const nonDraftQuotes = quotes.filter(q => q.status !== 'Draft')
    const quotesByType: Record<string, { sent: number; won: number }> = {}
    for (const q of nonDraftQuotes) {
      const type = q.jobTypeName
      if (!quotesByType[type]) quotesByType[type] = { sent: 0, won: 0 }
      quotesByType[type].sent += 1
      if (q.status === 'Accepted') quotesByType[type].won += 1
    }
    for (const [type, qd] of Object.entries(quotesByType)) {
      if (qd.sent < 5) continue // need enough data to be meaningful
      const winRate = (qd.won / qd.sent) * 100
      const stats = typeStats[type]
      const margin = stats && stats.revenue > 0 ? ((stats.revenue - stats.costs) / stats.revenue) * 100 : 50

      if (winRate > 80 && margin < 40) {
        // High win + low margin = definitely underpriced
        alerts.push({ type: 'warning', message: `Winning ${Math.round(winRate)}% of ${type} quotes but margin is only ${Math.round(margin)}% — strongly consider raising your price` })
      } else if (winRate > 80) {
        // High win + decent margin = probably still underpriced
        alerts.push({ type: 'info', message: `Winning ${Math.round(winRate)}% of ${type} quotes — you could likely charge more and still win most of them` })
      } else if (winRate < 30 && margin > 60) {
        // Low win + high margin = overpriced
        alerts.push({ type: 'warning', message: `Only winning ${Math.round(winRate)}% of ${type} quotes — your pricing may be above market rate` })
      } else if (winRate < 30) {
        // Low win + low margin = competitors undercutting
        alerts.push({ type: 'info', message: `${type} win rate is ${Math.round(winRate)}% — check if competitors are undercutting or if your follow-up timing needs adjusting` })
      }
    }

    return alerts.slice(0, 5) // Cap at 5 alerts
  }, [periodJobs, paidJobs, quotes, invoices, getJobCost])

  /* ── repeat customers (filtered to period, top 5) with margin ── */
  const repeatCustomers = useMemo(() => {
    const byCustomer: Record<string, { name: string; jobs: number; totalSpend: number; totalCost: number; lastDate: string }> = {}
    for (const j of periodJobs) {
      if (!byCustomer[j.customerId]) {
        const cust = customers.find(c => c.id === j.customerId)
        byCustomer[j.customerId] = { name: cust?.name || j.customerName, jobs: 0, totalSpend: 0, totalCost: 0, lastDate: j.date }
      }
      const entry = byCustomer[j.customerId]
      entry.jobs += 1
      entry.totalSpend += j.value
      entry.totalCost += getJobCost(j)
      if (j.date > entry.lastDate) entry.lastDate = j.date
    }
    return Object.values(byCustomer)
      .sort((a, b) => b.jobs - a.jobs)
      .slice(0, 5)
      .map(c => {
        const margin = c.totalSpend > 0 ? Math.round(((c.totalSpend - c.totalCost) / c.totalSpend) * 100) : 0
        return {
          name: c.name,
          jobs: c.jobs,
          totalSpend: fmtCurrency(c.totalSpend),
          margin,
          marginColor: margin >= 50 ? '#6ABF8A' : margin >= 30 ? '#C6A86A' : '#D46A6A',
          lastJob: new Date(c.lastDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        }
      })
  }, [periodJobs, customers, getJobCost])

  /* ── Financial Summary ── */
  const financials = useMemo(() => {
    const revenue = periodJobs.reduce((s, j) => s + j.value, 0)
    let costs = 0
    for (const j of periodJobs) {
      const q = j.quoteId ? quotes.find(qq => qq.id === j.quoteId) : undefined
      if (q) {
        costs += q.materials + q.waste + q.certificates
      } else {
        costs += j.value * 0.35
      }
    }
    const grossProfit = revenue - costs

    // For year view: use actual profit, no annualising
    // For shorter periods: annualise but require at least 30 days of data
    let annualProfit: number
    if (period === 'year' || period === 'overall') {
      // Use the actual profit — don't inflate
      annualProfit = grossProfit
    } else {
      const now = new Date()
      const periodStart = (() => {
        if (period === 'week') return getMonday(now)
        if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1)
        return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
      })()
      const daysCovered = Math.max((now.getTime() - periodStart.getTime()) / 86400000, 30)
      annualProfit = grossProfit * (365 / daysCovered)
    }

    // UK self-employed tax estimate
    const personalAllowance = 12570
    const basicRateLimit = 50270
    // Income Tax
    let incomeTax = 0
    if (annualProfit > personalAllowance) {
      const basicBand = Math.min(annualProfit, basicRateLimit) - personalAllowance
      incomeTax += basicBand * 0.20
      if (annualProfit > basicRateLimit) {
        incomeTax += (annualProfit - basicRateLimit) * 0.40
      }
    }
    // Class 2 NI — £3.45/week
    const class2NI = 3.45 * 52
    // Class 4 NI
    let class4NI = 0
    if (annualProfit > personalAllowance) {
      const band = Math.min(annualProfit, basicRateLimit) - personalAllowance
      class4NI += band * 0.06
      if (annualProfit > basicRateLimit) {
        class4NI += (annualProfit - basicRateLimit) * 0.02
      }
    }
    const estimatedTax = Math.max(incomeTax + class2NI + class4NI, 0)

    return { revenue, costs, grossProfit, estimatedTax }
  }, [periodJobs, quotes, period])

  /* ── Profit Margin by Job Type ── */
  const marginByType = useMemo(() => {
    const byType: Record<string, { revenue: number; costs: number }> = {}
    for (const j of periodJobs) {
      if (!byType[j.jobType]) byType[j.jobType] = { revenue: 0, costs: 0 }
      byType[j.jobType].revenue += j.value
      const q = j.quoteId ? quotes.find(qq => qq.id === j.quoteId) : undefined
      if (q) {
        byType[j.jobType].costs += q.materials + q.waste + q.certificates
      } else {
        byType[j.jobType].costs += j.value * 0.35
      }
    }
    return Object.entries(byType)
      .map(([type, d]) => ({
        type,
        revenue: d.revenue,
        costs: d.costs,
        margin: d.revenue > 0 ? ((d.revenue - d.costs) / d.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.margin - a.margin)
  }, [periodJobs, quotes])

  /* ── Revenue Forecast (last 6 months actual + 3 months forecast) ── */
  interface MonthData { label: string; revenue: number; costs: number; profit: number; month: number }

  const forecastData = useMemo(() => {
    const now = new Date()
    const curTaxYearStartYr = (now.getMonth() >= 3 && (now.getMonth() > 3 || now.getDate() >= 6))
      ? now.getFullYear() : now.getFullYear() - 1

    // Helper: get monthly revenue/costs/profit for a tax year
    const getYearData = (startYr: number): MonthData[] => {
      const months: MonthData[] = []
      for (let i = 0; i < 12; i++) {
        const d = new Date(startYr, 3 + i, 1)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const monthJobs = paidJobs.filter(j => monthKey(j.date) === key)
        const revenue = monthJobs.reduce((s, j) => s + j.value, 0)
        const costs = monthJobs.reduce((s, j) => s + getJobCost(j), 0)
        months.push({ label: shortMonth(key), revenue, costs, profit: revenue - costs, month: d.getMonth() })
      }
      return months
    }

    // Current year — mark future months with -1
    const curYearRaw = getYearData(curTaxYearStartYr)
    const actual: (MonthData & { isFuture: boolean })[] = curYearRaw.map((m, i) => {
      const monthDate = new Date(curTaxYearStartYr, 3 + i, 1)
      const isFuture = monthDate.getFullYear() > now.getFullYear() ||
        (monthDate.getFullYear() === now.getFullYear() && monthDate.getMonth() > now.getMonth())
      return { ...m, revenue: isFuture ? -1 : m.revenue, costs: isFuture ? -1 : m.costs, profit: isFuture ? -1 : m.profit, isFuture }
    })

    const lastYear = getYearData(curTaxYearStartYr - 1)
    const twoYearsAgo = getYearData(curTaxYearStartYr - 2)

    // YoY growth rate
    const completedMonths = actual.filter(m => m.revenue > 0)
    const hasLastYearData = lastYear.some(m => m.revenue > 0)
    let growthRate = 1
    if (completedMonths.length >= 2 && hasLastYearData) {
      const lyTotal = completedMonths.reduce((s, m) => s + (lastYear.find(l => l.month === m.month)?.revenue || 0), 0)
      const tyTotal = completedMonths.reduce((s, m) => s + m.revenue, 0)
      growthRate = lyTotal > 0 ? tyTotal / lyTotal : 1
    }
    growthRate = Math.min(Math.max(growthRate, 0.5), 2)

    // Pipeline
    const pipelineStatuses = ['Quoted', 'Accepted', 'Scheduled', 'In Progress']
    const pipelineValue = jobs.filter(j => pipelineStatuses.includes(j.status)).reduce((s, j) => s + j.value, 0)

    // ── Seasonal adjustment factors (UK trades — relative to annual average)
    // Derived from typical patterns: spring/summer busy, winter quiet, Jan quiet.
    // Month 0 = Jan ... 11 = Dec
    const SEASONAL: Record<number, number> = {
      0: 0.7, 1: 0.75, 2: 0.9, 3: 1.05, 4: 1.15, 5: 1.2,
      6: 1.15, 7: 1.1, 8: 1.05, 9: 1.0, 10: 0.85, 11: 0.7,
    }

    // When no prior-year data exists, build a baseline from the months
    // we DO have. Average monthly revenue × seasonal factor for each
    // future month. This gives a sensible forecast from day one instead
    // of dropping to £0.
    const avgMonthlyRevenue = completedMonths.length > 0
      ? completedMonths.reduce((s, m) => s + m.revenue, 0) / completedMonths.length
      : 0
    const avgMonthlyCost = completedMonths.length > 0
      ? completedMonths.reduce((s, m) => s + (actual.find(a => a.month === m.month && !a.isFuture)?.costs ?? 0), 0) / completedMonths.length
      : 0

    // Forecast future months — revenue, costs, profit
    const forecast: MonthData[] = []
    const futureMonths = actual.filter(m => m.isFuture)
    for (const fm of futureMonths) {
      const ly = lastYear.find(l => l.month === fm.month)
      const tya = twoYearsAgo.find(t => t.month === fm.month)

      let fcRev: number
      let fcCost: number

      if (hasLastYearData) {
        // We have prior-year data — use weighted average × growth
        const weightedRev = weightedAvg(ly?.revenue || 0, tya?.revenue || 0)
        const weightedCost = weightedAvg(ly?.costs || 0, tya?.costs || 0)
        fcRev = Math.round(weightedRev * growthRate + pipelineValue / Math.max(futureMonths.length, 1))
        fcCost = Math.round(weightedCost * growthRate)
      } else if (avgMonthlyRevenue > 0) {
        // No prior year — extrapolate from completed months + seasonal curve
        const seasonal = SEASONAL[fm.month] ?? 1
        fcRev = Math.round(avgMonthlyRevenue * seasonal + pipelineValue / Math.max(futureMonths.length, 1))
        fcCost = Math.round(avgMonthlyCost * seasonal)
      } else {
        // No data at all — just spread pipeline
        fcRev = Math.round(pipelineValue / Math.max(futureMonths.length, 1))
        fcCost = 0
      }

      forecast.push({ label: fm.label, revenue: fcRev, costs: fcCost, profit: fcRev - fcCost, month: fm.month })
    }

    return { actual, lastYear, forecast, growthRate, hasLastYearData }
  }, [paidJobs, jobs, getJobCost])

  // Projected full-year financials: actuals + forecast revenue/costs
  const projectedFinancials = useMemo(() => {
    if (period !== 'year') return financials
    const fcRevenue = forecastData.forecast.reduce((s, m) => s + m.revenue, 0)
    const fcCosts = forecastData.forecast.reduce((s, m) => s + m.costs, 0)
    const revenue = financials.revenue + fcRevenue
    const costs = financials.costs + fcCosts
    const grossProfit = revenue - costs
    const personalAllowance = 12570
    const basicRateLimit = 50270
    let incomeTax = 0
    if (grossProfit > personalAllowance) {
      const basicBand = Math.min(grossProfit, basicRateLimit) - personalAllowance
      incomeTax += basicBand * 0.20
      if (grossProfit > basicRateLimit) incomeTax += (grossProfit - basicRateLimit) * 0.40
    }
    const class2NI = 3.45 * 52
    let class4NI = 0
    if (grossProfit > personalAllowance) {
      const band = Math.min(grossProfit, basicRateLimit) - personalAllowance
      class4NI += band * 0.06
      if (grossProfit > basicRateLimit) class4NI += (grossProfit - basicRateLimit) * 0.02
    }
    return { revenue, costs, grossProfit, estimatedTax: Math.max(incomeTax + class2NI + class4NI, 0) }
  }, [financials, forecastData, period])

  // Weighted average: 2× recent + 1× older
  function weightedAvg(recent: number, older: number): number {
    if (recent > 0 && older > 0) return (recent * 2 + older) / 3
    if (recent > 0) return recent
    if (older > 0) return older
    return 0
  }

  /* ── VAT Summary ── */
  const vatSummary = useMemo(() => {
    const fin = financialView === 'projected' && period === 'year' ? projectedFinancials : financials
    const outputVAT = fin.revenue * 0.20
    const inputVAT = fin.costs * 0.20
    const liability = outputVAT - inputVAT
    return { outputVAT, inputVAT, liability }
  }, [financials, projectedFinancials, financialView, period])

  /* ── CSV export ── */
  const exportCSV = useCallback(() => {
    const headers = ['Job ID', 'Date', 'Customer', 'Job Type', 'Value (Net)', 'VAT', 'Total (Gross)', 'Hours', 'Quote Ref', 'Invoice Ref']
    const rows = paidJobs.map(j => {
      const q = j.quoteId ? quotes.find(qq => qq.id === j.quoteId) : undefined
      const vat = j.value * 0.2
      return [
        j.id,
        j.date,
        j.customerName,
        j.jobType,
        j.value.toFixed(2),
        vat.toFixed(2),
        (j.value + vat).toFixed(2),
        j.estimatedHours.toString(),
        q?.ref || '',
        j.invoiceId || '',
      ]
    })

    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `grey-havens-jobs-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [paidJobs, quotes])

  const [selectedBar, setSelectedBar] = useState<string | null>(null)
  const [chartMetric, setChartMetric] = useState<'revenue' | 'costs' | 'profit'>('revenue')
  const [chartType, setChartType] = useState<'bar' | 'stacked' | 'line'>('bar')
  const [forecastMetric, setForecastMetric] = useState<'revenue' | 'costs' | 'profit'>('revenue')
  const maxChartValue = Math.max(...revenueChart.map(m => chartType === 'stacked' ? m.revenue : Math.max(m.revenue, m.costs, m.profit)), 1)

  /* ── styles ── */
  const s: Record<string, CSSProperties> = {
    page: { padding: 32, maxWidth: 1400, margin: '0 auto' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 },
    heading: { fontSize: 28, fontWeight: 600, color: C.white },
    periodToggle: { display: 'flex', background: C.black, borderRadius: 8, overflow: 'hidden' },
    periodBtn: {
      padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13,
      fontWeight: 500, minHeight: 40, transition: 'background .15s, color .15s',
    },
    kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 },
    kpiCard: {
      background: C.charcoalLight, borderRadius: 12, padding: '20px 24px',
      borderLeft: `4px solid ${C.gold}`,
    },
    kpiValue: { fontSize: 28, fontWeight: 700, color: C.white, lineHeight: 1, marginBottom: 6 },
    kpiLabel: { fontSize: 13, color: C.silver, marginBottom: 8 },
    kpiChange: { fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 },
    twoCol: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 24 },
    threeCol: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: 20, marginBottom: 24 },
    panel: { background: C.charcoalLight, borderRadius: 12, padding: '20px 24px' },
    panelTitle: { fontSize: 16, fontWeight: 600, color: C.white, marginBottom: 16 },
    // chart
    chartWrap: { display: 'flex', alignItems: 'flex-end', gap: 12, height: 180, padding: '0 8px' },
    bar: { flex: 1, borderRadius: '6px 6px 0 0', transition: 'height .3s ease', cursor: 'pointer', position: 'relative' },
    barLabel: { textAlign: 'center', fontSize: 11, color: C.steel, marginTop: 8 },
    barValue: { textAlign: 'center', fontSize: 11, fontWeight: 600, color: C.gold, marginBottom: 4 },
    // table
    table: { width: '100%', borderCollapse: 'collapse' },
    th: {
      textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 600,
      color: C.silver, textTransform: 'uppercase', letterSpacing: 0.6,
      borderBottom: `1px solid ${C.steel}33`,
    },
    td: { padding: '10px 12px', fontSize: 13, color: C.white, borderBottom: `1px solid ${C.steel}1A` },
    // alerts
    alertCard: {
      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px',
      borderRadius: 8, marginBottom: 8, fontSize: 13, lineHeight: 1.5,
    },
  }

  return (
    <FeatureGate feature="insightsBasic">
    <div style={s.page}>
      {/* header */}
      <div style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={s.heading}>Insights</h1>
          <div style={{ display: 'flex', background: C.black, borderRadius: 8, overflow: 'hidden' }}>
            {(['simple', 'detailed'] as const).map(v => (
              <button
                key={v}
                style={{
                  padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13,
                  fontWeight: 500, minHeight: 40, transition: 'background .15s, color .15s',
                  background: insightsView === v ? C.charcoalLight : 'transparent',
                  color: insightsView === v ? C.gold : C.steel,
                }}
                onClick={() => handleViewToggle(v)}
              >
                {v === 'simple' ? 'Simple' : 'Detailed'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
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
          <button
            onClick={exportCSV}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              borderRadius: 8, background: C.black, border: `1px solid ${C.steel}33`,
              color: C.silver, cursor: 'pointer', fontSize: 13, fontWeight: 500, minHeight: 40,
            }}
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Empty state for new users */}
      {periodJobs.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '32px 20px', marginBottom: 24,
          background: C.charcoalLight, borderRadius: 12,
          border: `1px dashed ${C.gold}44`,
        }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.white, marginBottom: 6 }}>
            No completed jobs in this period yet
          </div>
          <div style={{ fontSize: 13, color: C.silver, lineHeight: 1.5 }}>
            Your insights will build automatically as you complete and get paid for jobs.
            Try switching to "Overall" to see all your data, or create your first quote to get started.
          </div>
        </div>
      )}

      {/* KPIs */}
      <div style={s.kpiRow}>
        {kpis.map(k => (
          <div
            key={k.label}
            style={{ ...s.kpiCard, cursor: 'pointer', transition: 'border-color .15s' }}
            onClick={() => setActiveModal(k.modal)}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.gold }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent' }}
          >
            <div style={s.kpiValue}>{k.value}</div>
            <div style={s.kpiLabel}>{k.label}</div>
            <div style={{ ...s.kpiChange, color: k.up ? C.green : C.red }}>
              {k.up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {k.change}
            </div>
          </div>
        ))}
      </div>

      {/* charts + alerts */}
      <div style={insightsView === 'simple' ? { marginBottom: 24 } : s.threeCol}>
        {/* revenue/costs/profit chart */}
        <div style={s.panel}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div style={s.panelTitle as CSSProperties}>{chartLabels[period]} Breakdown</div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {/* Metric toggle (bar mode only) */}
              {chartType === 'bar' && (
                <div style={{ display: 'flex', background: C.black, borderRadius: 8, overflow: 'hidden' }}>
                  {([['revenue', C.gold, 'Revenue'], ['costs', '#D46A6A', 'Costs'], ['profit', C.green, 'Profit']] as const).map(([key, color, label]) => (
                    <button
                      key={key}
                      onClick={() => setChartMetric(key)}
                      style={{
                        padding: '6px 12px', border: 'none', cursor: 'pointer', fontSize: 11,
                        fontWeight: 600, background: chartMetric === key ? `${color}22` : 'transparent',
                        color: chartMetric === key ? color : C.steel, transition: 'all .15s',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {/* Chart type toggle */}
              <div style={{ display: 'flex', background: C.black, borderRadius: 8, overflow: 'hidden' }}>
                {([['bar', 'Bar'], ['stacked', 'Stacked'], ['line', 'Line']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setChartType(key)}
                    style={{
                      padding: '6px 12px', border: 'none', cursor: 'pointer', fontSize: 11,
                      fontWeight: 600, background: chartType === key ? C.charcoalLight : 'transparent',
                      color: chartType === key ? C.silver : C.steel, transition: 'all .15s',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bar chart */}
          {chartType === 'bar' && (
            <div style={s.chartWrap}>
              {revenueChart.map((m, i) => {
                const val = m[chartMetric]
                const height = (Math.abs(val) / maxChartValue) * 160
                const isLast = i === revenueChart.length - 1
                const isSelected = selectedBar === m.label
                const isFut = !!m.isFuture
                const barColor = chartMetric === 'revenue' ? C.gold : chartMetric === 'costs' ? '#D46A6A' : C.green
                return (
                  <div key={m.label + m.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', opacity: isFut ? 0.3 : 1 }}>
                    <div style={s.barValue as CSSProperties}>
                      {isFut ? '—' : Math.abs(val) >= 1000 ? `£${(val / 1000).toFixed(1)}k` : `£${Math.round(val)}`}
                    </div>
                    <div
                      style={{
                        width: '100%', height: Math.max(height, 2), borderRadius: '6px 6px 0 0',
                        background: isFut ? `${C.steel}33` : (isSelected || isLast ? barColor : `${barColor}44`),
                        transition: 'height .3s ease, background .15s', cursor: isFut ? 'default' : 'pointer',
                        borderTop: isFut ? `1px dashed ${C.steel}66` : 'none',
                      }}
                      onClick={() => !isFut && setSelectedBar(isSelected ? null : m.label)}
                      onMouseEnter={e => { if (!isFut) e.currentTarget.style.background = barColor }}
                      onMouseLeave={e => { if (!isFut && !isLast && !isSelected) e.currentTarget.style.background = `${barColor}44` }}
                    />
                    <div style={{ ...(s.barLabel as object), color: isFut ? `${C.steel}88` : C.steel }}>{m.label}</div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Stacked bar chart */}
          {chartType === 'stacked' && (
            <div style={s.chartWrap}>
              {revenueChart.map((m) => {
                const costsH = (m.costs / maxChartValue) * 160
                const profitH = (m.profit / maxChartValue) * 160
                const isFut = !!m.isFuture
                return (
                  <div key={m.label + m.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', opacity: isFut ? 0.3 : 1 }}>
                    <div style={s.barValue as CSSProperties}>
                      {isFut ? '—' : m.revenue >= 1000 ? `£${(m.revenue / 1000).toFixed(1)}k` : `£${Math.round(m.revenue)}`}
                    </div>
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                      <div style={{ width: '100%', height: Math.max(profitH, 0), borderRadius: '6px 6px 0 0', background: isFut ? `${C.steel}33` : C.green, transition: 'height .3s ease', borderTop: isFut ? `1px dashed ${C.steel}66` : 'none' }} />
                      <div style={{ width: '100%', height: Math.max(costsH, 0), background: isFut ? `${C.steel}22` : '#D46A6A', transition: 'height .3s ease' }} />
                    </div>
                    <div style={{ ...(s.barLabel as object), color: isFut ? `${C.steel}88` : C.steel }}>{m.label}</div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Line chart */}
          {chartType === 'line' && (() => {
            const chartW = 600
            const chartH = 200
            const padL = 50 // left padding for Y-axis labels
            const padR = 20
            const padT = 20
            const padB = 30
            const plotW = chartW - padL - padR
            const plotH = chartH - padT - padB
            const maxVal = Math.max(...revenueChart.map(m => Math.max(m.revenue, m.costs, m.profit)), 1)
            const step = plotW / Math.max(revenueChart.length - 1, 1)

            const toX = (i: number) => padL + i * step
            const toY = (v: number) => padT + plotH * (1 - v / maxVal)

            // Only draw lines for past/current months — future months are excluded
            // from the line chart so it builds up over time rather than
            // showing a line dropping to £0.
            const pastBars = revenueChart.filter(m => !m.isFuture)
            const lastPastIdx = pastBars.length - 1

            const toLinePoints = (values: number[], limit?: number) => {
              const n = limit != null ? Math.min(values.length, limit + 1) : values.length
              return values.slice(0, n).map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')
            }

            // Area fill points (close the path at the bottom)
            const toAreaPoints = (values: number[], limit?: number) => {
              const n = limit != null ? Math.min(values.length, limit + 1) : values.length
              const slice = values.slice(0, n)
              const line = slice.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`)
              return [...line, `${toX(n - 1).toFixed(1)},${toY(0).toFixed(1)}`, `${toX(0).toFixed(1)},${toY(0).toFixed(1)}`].join(' ')
            }

            const revLine = toLinePoints(revenueChart.map(m => m.revenue), lastPastIdx)
            const costLine = toLinePoints(revenueChart.map(m => m.costs), lastPastIdx)
            const profitLine = toLinePoints(revenueChart.map(m => m.profit), lastPastIdx)

            // Y-axis tick values
            const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxVal * f))

            const fmtK = (n: number) => n >= 1000 ? `£${(n / 1000).toFixed(0)}k` : `£${n}`

            return (
              <div style={{ position: 'relative' }}>
                <svg viewBox={`0 0 ${chartW} ${chartH + 24}`} style={{ width: '100%', height: 240 }} preserveAspectRatio="xMidYMid meet">
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.gold} stopOpacity="0.25" />
                      <stop offset="100%" stopColor={C.gold} stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.green} stopOpacity="0.15" />
                      <stop offset="100%" stopColor={C.green} stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* Grid lines + Y labels */}
                  {yTicks.map((val, i) => {
                    const y = toY(val)
                    return (
                      <g key={`g-${i}`}>
                        <line x1={padL} x2={chartW - padR} y1={y} y2={y} stroke={`${C.steel}22`} strokeWidth="0.5" />
                        <text x={padL - 8} y={y + 4} textAnchor="end" fill={C.steel} fontSize="9" fontFamily="inherit">{fmtK(val)}</text>
                      </g>
                    )
                  })}

                  {/* Area fills — only up to current month */}
                  <polygon points={toAreaPoints(revenueChart.map(m => m.revenue), lastPastIdx)} fill="url(#revGrad)" />
                  <polygon points={toAreaPoints(revenueChart.map(m => m.profit), lastPastIdx)} fill="url(#profitGrad)" />

                  {/* Lines */}
                  <polyline points={costLine} fill="none" stroke="#D46A6A" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                  <polyline points={profitLine} fill="none" stroke={C.green} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                  <polyline points={revLine} fill="none" stroke={C.gold} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

                  {/* Dots + hover columns — future months show as faint placeholders */}
                  {revenueChart.map((m, i) => {
                    const x = toX(i)
                    const isHovered = selectedBar === m.label
                    const isFut = !!m.isFuture
                    return (
                      <g key={m.key} opacity={isFut ? 0.2 : 1}>
                        {/* Invisible hover column */}
                        {!isFut && <rect
                          x={x - step / 2} y={padT} width={step} height={plotH}
                          fill="transparent" cursor="pointer"
                          onClick={() => setSelectedBar(isHovered ? null : m.label)}
                        />}
                        {/* Vertical indicator on hover */}
                        {isHovered && (
                          <line x1={x} x2={x} y1={padT} y2={padT + plotH} stroke={`${C.steel}44`} strokeWidth="1" strokeDasharray="4 4" />
                        )}
                        {/* Dots — only for past months */}
                        {!isFut && <>
                          <circle cx={x} cy={toY(m.revenue)} r={isHovered ? 5.5 : 3.5} fill={C.gold} stroke={C.black} strokeWidth={isHovered ? 2 : 0} />
                          <circle cx={x} cy={toY(m.costs)} r={isHovered ? 5 : 3} fill="#D46A6A" stroke={C.black} strokeWidth={isHovered ? 2 : 0} />
                          <circle cx={x} cy={toY(m.profit)} r={isHovered ? 5 : 3} fill={C.green} stroke={C.black} strokeWidth={isHovered ? 2 : 0} />
                        </>}
                        {/* Future month marker */}
                        {isFut && <circle cx={x} cy={toY(0)} r={2} fill={C.steel} opacity={0.5} />}
                        {/* Tooltip */}
                        {isHovered && (
                          <g>
                            <rect x={x - 45} y={padT - 2} width={90} height={42} rx={6} fill={C.charcoalLight} stroke={`${C.steel}44`} strokeWidth="0.5" />
                            <text x={x} y={padT + 11} textAnchor="middle" fill={C.gold} fontSize="9" fontWeight="600">{fmtK(m.revenue)}</text>
                            <text x={x} y={padT + 23} textAnchor="middle" fill="#D46A6A" fontSize="8">{fmtK(m.costs)}</text>
                            <text x={x} y={padT + 35} textAnchor="middle" fill={C.green} fontSize="8">{fmtK(m.profit)}</text>
                          </g>
                        )}
                      </g>
                    )
                  })}

                  {/* X labels */}
                  {revenueChart.map((m, i) => (
                    <text key={`l-${m.key}`} x={toX(i)} y={chartH + 12}
                      textAnchor="middle" fill={C.steel} fontSize="10" fontFamily="inherit">
                      {m.label}
                    </text>
                  ))}
                </svg>
              </div>
            )
          })()}

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8, fontSize: 11, color: C.steel }}>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: C.gold, marginRight: 4 }} />Revenue</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#D46A6A', marginRight: 4 }} />Costs</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: C.green, marginRight: 4 }} />Profit</span>
          </div>
        </div>

        {/* ── Smart Alerts — Pro+ only ── */}
        {smartAlerts.length > 0 && canUse('smartAlerts') && (
        <div style={{ ...s.panel, marginTop: 24 }}>
          <div style={s.panelTitle}>Smart Alerts</div>
          {smartAlerts.map((a, i) => (
            <div
              key={i}
              style={{
                ...s.alertCard,
                background: a.type === 'warning' ? `${C.gold}15` : a.type === 'success' ? `${C.green}15` : `${C.blue}15`,
                color: a.type === 'warning' ? C.gold : a.type === 'success' ? C.green : C.blue,
              }}
            >
              {a.type === 'warning' ? <AlertTriangle size={16} /> : a.type === 'success' ? <Award size={16} /> : <TrendingUp size={16} />}
              <span style={{ color: C.silver }}>{a.message}</span>
            </div>
          ))}
        </div>
        )}
      </div>

      {/* Everything below is detailed view only */}
      {insightsView === 'detailed' && <>

      {/* job type performance + repeat customers */}
      <div style={s.twoCol}>
        <div style={s.panel}>
          <div
            style={{ ...s.panelTitle as object, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
            onClick={() => setActiveModal('allJobTypes')}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.color = C.gold }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.color = C.white }}
          >Job Type Performance <span style={{ fontSize: 11, color: C.steel, fontWeight: 400 }}>View all →</span></div>
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th as CSSProperties}>Type</th>
                  <th style={s.th as CSSProperties}>Jobs</th>
                  <th style={s.th as CSSProperties}>Revenue</th>
                  <th style={s.th as CSSProperties}>Avg Price</th>
                  <th style={s.th as CSSProperties}>Margin</th>
                  <th style={s.th as CSSProperties}>Trend</th>
                </tr>
              </thead>
              <tbody>
                {jobTypePerformance.map(j => (
                  <tr
                    key={j.type}
                    onClick={() => setExpandedJobType(j.type)}
                    style={{ cursor: 'pointer', transition: 'background .15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${C.steel}22` }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ ...s.td, fontWeight: 500 }}>{j.type}</td>
                    <td style={s.td}>{j.jobs}</td>
                    <td style={{ ...s.td, color: C.gold, fontWeight: 600 }}>{j.revenue}</td>
                    <td style={s.td}>{j.avgPrice}</td>
                    <td style={{
                      ...s.td, fontWeight: 600,
                      color: j.marginNum >= 50 ? C.green : j.marginNum >= 30 ? C.gold : '#D46A6A',
                    }}>{j.margin}</td>
                    <td style={s.td}>
                      {j.trend === 'up'
                        ? <TrendingUp size={14} color={C.green} />
                        : j.trend === 'down'
                          ? <TrendingDown size={14} color={'#D46A6A'} />
                          : <span style={{ fontSize: 12, color: C.steel }}>—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={s.panel}>
          <div
            style={{ ...s.panelTitle as object, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
            onClick={() => setActiveModal('allCustomers')}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.color = C.gold }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.color = C.white }}
          >Top Repeat Customers <span style={{ fontSize: 11, color: C.steel, fontWeight: 400 }}>View all →</span></div>
          {repeatCustomers.map((c, i) => (
            <div
              key={c.name}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 8px', borderRadius: 8, cursor: 'pointer',
                borderBottom: i < repeatCustomers.length - 1 ? `1px solid ${C.steel}1A` : 'none',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = `${C.steel}22` }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.white }}>{c.name}</div>
                <div style={{ fontSize: 12, color: C.silver }}>{c.jobs} jobs · Last: {c.lastJob}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.gold }}>{c.totalSpend}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: c.marginColor }}>
                  {c.margin}% margin
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Financial Summary Panel ── */}
      <div style={{ ...s.panel, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={s.panelTitle}>Financial Summary — {periodLabels[period]}</div>
          {period === 'year' && (
            <div style={{ display: 'flex', background: C.black, borderRadius: 8, overflow: 'hidden' }}>
              <button
                onClick={() => setFinancialView('actuals')}
                style={{
                  padding: '6px 12px', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  background: financialView === 'actuals' ? C.charcoalLight : 'transparent',
                  color: financialView === 'actuals' ? C.gold : C.steel,
                }}
              >Actuals to Date</button>
              <button
                onClick={() => setFinancialView('projected')}
                style={{
                  padding: '6px 12px', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  background: financialView === 'projected' ? C.charcoalLight : 'transparent',
                  color: financialView === 'projected' ? C.gold : C.steel,
                }}
              >Full Year (Projected)</button>
            </div>
          )}
        </div>
        {(() => {
          const fin = financialView === 'projected' && period === 'year' ? projectedFinancials : financials
          const isProjected = financialView === 'projected' && period === 'year'
          return (
        <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          {([
            { label: isProjected ? 'Revenue (Projected)' : 'Revenue', value: fmtCurrency(Math.round(fin.revenue)), color: C.gold, modal: 'revenueSummary' as ModalType },
            { label: isProjected ? 'Costs (Projected)' : 'Costs', value: fmtCurrency(Math.round(fin.costs)), color: C.red, modal: 'costsSummary' as ModalType },
            { label: isProjected ? 'Gross Profit (Projected)' : 'Gross Profit', value: fmtCurrency(Math.round(fin.grossProfit)), color: C.green, modal: 'profitSummary' as ModalType },
            { label: 'Income Tax + NI (est.)', value: `${fmtCurrency(Math.round(fin.estimatedTax))}/yr`, color: C.silver, modal: 'taxSummary' as ModalType },
          ]).map(item => (
            <div
              key={item.label}
              onClick={() => setActiveModal(item.modal)}
              style={{
                background: C.black, borderRadius: 10, padding: '16px 20px',
                borderTop: `3px solid ${item.color}`,
                cursor: 'pointer', transition: 'border-color .15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderTopColor = C.gold }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderTopColor = item.color }}
            >
              <div style={{ fontSize: 12, color: C.silver, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: C.steel, marginTop: 8, fontStyle: 'italic' }}>
          {isProjected ? 'Projected figures include forecast revenue/costs for remaining months. ' : ''}
          Income Tax + NI estimate includes Income Tax (20%/40% bands), Class 2 NI, and Class 4 NI based on 2025/26 HMRC rates. Consult your accountant for actual figures.
        </div>
        </>
          )
        })()}
      </div>

      {/* ── Trend & Forecast (full width) — Business plan ── */}
      <FeatureGate feature="insightsAdvanced">
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 520px', gap: 20, marginBottom: 24 }}>
      <div style={s.panel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={s.panelTitle}>Trend & Forecast</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{ display: 'flex', background: C.black, borderRadius: 8, overflow: 'hidden' }}>
              {([['revenue', C.gold, 'Revenue'], ['costs', '#D46A6A', 'Costs'], ['profit', C.green, 'Profit']] as const).map(([key, color, label]) => (
                <button key={key} onClick={() => setForecastMetric(key)}
                  style={{ padding: '6px 12px', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                    background: forecastMetric === key ? `${color}22` : 'transparent',
                    color: forecastMetric === key ? color : C.steel, transition: 'all .15s' }}>
                  {label}
                </button>
              ))}
            </div>
            {forecastData.growthRate !== 1 && forecastData.hasLastYearData && (
              <span style={{ fontSize: 11, color: forecastData.growthRate > 1 ? C.green : C.red, fontWeight: 600 }}>
                {forecastData.growthRate > 1 ? '↑' : '↓'} {Math.round((forecastData.growthRate - 1) * 100)}% YoY
              </span>
            )}
            {!forecastData.hasLastYearData && (
              <span style={{ fontSize: 11, color: C.steel }}>
                Forecast based on your recent months + seasonal trends
              </span>
            )}
          </div>
        </div>
        {(() => {
          // All 12 months of tax year — actual values where we have data, forecast fills the rest
          const m = forecastMetric // shorthand
          const actualWithForecast = forecastData.actual.map((a, i) => {
            const fc = forecastData.forecast.find(f => f.label === a.label)
            const isFuture = a.revenue === -1
            const ly = forecastData.lastYear[i]
            return {
              label: a.label,
              actual: isFuture ? 0 : a[m],
              lastYear: ly ? ly[m] : 0,
              forecast: fc ? fc[m] : 0,
              isForecast: isFuture,
            }
          })

          // Lifetime average per month — respects selected metric
          const lifetimeAvg = forecastData.actual.map((_a, i) => {
            let total = 0
            let years = 0
            for (const yr of taxYears.slice(1)) { // skip current
              const startYr = parseInt(yr.split('/')[0])
              const d = new Date(startYr, 3 + i, 1)
              const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
              const monthJobs = paidJobs.filter(j => monthKey(j.date) === key)
              let val = 0
              if (m === 'revenue') val = monthJobs.reduce((s, j) => s + j.value, 0)
              else if (m === 'costs') val = monthJobs.reduce((s, j) => s + getJobCost(j), 0)
              else val = monthJobs.reduce((s, j) => s + j.value - getJobCost(j), 0)
              if (val > 0 || years > 0) { total += val; years++ }
            }
            return years > 0 ? total / years : 0
          })

          const maxVal = Math.max(
            ...actualWithForecast.map(m => Math.max(m.actual, m.lastYear, m.forecast)),
            ...lifetimeAvg,
            1
          )
          const chartW = 600, chartH = 220, padL = 50, padR = 20, padT = 24, padB = 30
          const plotW = chartW - padL - padR, plotH = chartH - padT - padB
          const stepX = plotW / Math.max(actualWithForecast.length - 1, 1)
          const toX = (i: number) => padL + i * stepX
          const toY = (v: number) => padT + plotH * (1 - v / maxVal)
          const fmtK = (n: number) => n >= 1000 ? `£${(n / 1000).toFixed(0)}k` : `£${n}`

          // Lines
          const actualIdx = actualWithForecast.map((m, i) => !m.isForecast ? i : -1).filter(i => i >= 0)
          const actualLine = actualIdx.map(i => `${toX(i).toFixed(1)},${toY(actualWithForecast[i].actual).toFixed(1)}`).join(' ')

          const lastYearLine = actualWithForecast.map((m, i) => `${toX(i).toFixed(1)},${toY(m.lastYear).toFixed(1)}`).join(' ')
          const avgLine = lifetimeAvg.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')

          // Forecast connects from last actual point
          const lastActualIdx = actualIdx.length > 0 ? actualIdx[actualIdx.length - 1] : 0
          const forecastMonths = actualWithForecast.map((m, i) => ({ ...m, i })).filter(m => m.isForecast)
          const forecastLine = [
            { i: lastActualIdx, value: actualWithForecast[lastActualIdx]?.actual || 0 },
            ...forecastMonths.map(m => ({ i: m.i, value: m.forecast }))
          ].map(p => `${toX(p.i).toFixed(1)},${toY(p.value).toFixed(1)}`).join(' ')

          // Area under actual
          const actualArea = actualIdx.length > 1 ? [
            ...actualIdx.map(i => `${toX(i).toFixed(1)},${toY(actualWithForecast[i].actual).toFixed(1)}`),
            `${toX(actualIdx[actualIdx.length - 1]).toFixed(1)},${toY(0).toFixed(1)}`,
            `${toX(actualIdx[0]).toFixed(1)},${toY(0).toFixed(1)}`,
          ].join(' ') : ''

          const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxVal * f))

          return (
            <div>
              <svg viewBox={`0 0 ${chartW} ${chartH + 24}`} style={{ width: '100%', height: 260 }} preserveAspectRatio="xMidYMid meet">
                <defs>
                  <linearGradient id="fcGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.gold} stopOpacity="0.15" />
                    <stop offset="100%" stopColor={C.gold} stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Grid + Y labels */}
                {yTicks.map((val, i) => (
                  <g key={`yt-${i}`}>
                    <line x1={padL} x2={chartW - padR} y1={toY(val)} y2={toY(val)} stroke={`${C.steel}22`} strokeWidth="0.5" />
                    <text x={padL - 8} y={toY(val) + 4} textAnchor="end" fill={C.steel} fontSize="9">{fmtK(val)}</text>
                  </g>
                ))}
                {/* Lifetime average — subtle dotted line (back layer) */}
                <polyline points={avgLine} fill="none" stroke={C.silver} strokeWidth="1.5" strokeDasharray="4,4" strokeLinejoin="round" opacity="0.5" />
                {/* Last year — distinct blue line */}
                <polyline points={lastYearLine} fill="none" stroke={C.blue} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.6" />
                {/* Area fill under actual */}
                {actualArea && <polygon points={actualArea} fill="url(#fcGrad)" />}
                {/* Forecast — dashed green */}
                {forecastLine && <polyline points={forecastLine} fill="none" stroke={C.green} strokeWidth="2" strokeDasharray="8,4" strokeLinejoin="round" strokeLinecap="round" opacity="0.8" />}
                {/* This year actual */}
                {(() => {
                  const mainColor = forecastMetric === 'revenue' ? C.gold : forecastMetric === 'costs' ? '#D46A6A' : C.green
                  return (
                    <>
                      <polyline points={actualLine} fill="none" stroke={mainColor} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                      {/* Dots — last year */}
                      {actualWithForecast.map((mm, i) => (
                        mm.lastYear > 0 ? <circle key={`ly-${i}`} cx={toX(i)} cy={toY(mm.lastYear)} r="3" fill={C.blue} opacity="0.6" /> : null
                      ))}
                      {/* Dots — actual */}
                      {actualIdx.map(i => (
                        <circle key={`ad-${i}`} cx={toX(i)} cy={toY(actualWithForecast[i].actual)} r="5" fill={mainColor} stroke={C.black} strokeWidth="2" />
                      ))}
                      {/* Dots — forecast */}
                      {forecastMonths.map(mm => (
                        <circle key={`fd-${mm.i}`} cx={toX(mm.i)} cy={toY(mm.forecast)} r="4" fill={C.silver} stroke={C.black} strokeWidth="1.5" />
                      ))}
                    </>
                  )
                })()}
                {/* X labels */}
                {actualWithForecast.map((m, i) => (
                  <text key={`xl-${i}`} x={toX(i)} y={chartH + 12} textAnchor="middle"
                    fill={m.isForecast ? C.silver : C.steel}
                    fontSize="10" fontStyle={m.isForecast ? 'italic' : 'normal'}>
                    {m.label}
                  </text>
                ))}
              </svg>
              <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 8, fontSize: 12, color: C.silver, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 18, height: 3, background: C.gold, borderRadius: 2 }} />This Year</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 18, height: 2, background: C.blue, borderRadius: 2, opacity: 0.6 }} />Last Year</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 18, height: 1, background: C.steel, borderTop: `1px dashed ${C.steel}` }} />Avg</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 18, height: 2, background: C.green, borderRadius: 2, opacity: 0.8, borderTop: `2px dashed ${C.green}` }} />Forecast</span>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Summary panel */}
      <div style={s.panel}>
        <div style={s.panelTitle}>Summary</div>
        {(() => {
          const metricLabel = forecastMetric === 'revenue' ? 'Revenue' : forecastMetric === 'costs' ? 'Costs' : 'Profit'
          const metricColor = forecastMetric === 'revenue' ? C.gold : forecastMetric === 'costs' ? '#D46A6A' : C.green
          const m = forecastMetric

          // This year actual + forecast
          const thisYearActual = forecastData.actual.filter(a => a[m] >= 0).reduce((s, a) => s + a[m], 0)
          const thisYearForecast = forecastData.forecast.reduce((s, f) => s + f[m], 0)
          const thisYearProjected = thisYearActual + thisYearForecast

          // Last year total
          const lastYearTotal = forecastData.lastYear.reduce((s, l) => s + l[m], 0)

          // All-time average per year — use same getJobCost as forecastData
          const completedYears = taxYears.slice(1) // skip current partial year
          const allYearTotals = completedYears.map(yr => {
            const startYr = parseInt(yr.split('/')[0])
            const yrStart = new Date(startYr, 3, 6)
            const yrEnd = new Date(startYr + 1, 3, 5)
            const yrJobs = paidJobs.filter(j => { const d = new Date(j.date); return d >= yrStart && d <= yrEnd })
            if (m === 'revenue') return yrJobs.reduce((s, j) => s + j.value, 0)
            if (m === 'costs') return yrJobs.reduce((s, j) => s + getJobCost(j), 0)
            return yrJobs.reduce((s, j) => s + j.value - getJobCost(j), 0) // profit
          })
          const avgPerYear = allYearTotals.length > 0 ? allYearTotals.reduce((s, t) => s + t, 0) / allYearTotals.length : 0

          // YoY change
          const yoyChange = lastYearTotal > 0 ? ((thisYearProjected - lastYearTotal) / lastYearTotal) * 100 : 0

          // Year-to-date comparison (same months only)
          const completedMonthIndices = forecastData.actual.map((a, i) => a[m] >= 0 ? i : -1).filter(i => i >= 0)
          const ytdThis = completedMonthIndices.reduce((s, i) => s + Math.max(forecastData.actual[i][m], 0), 0)
          const ytdLast = completedMonthIndices.reduce((s, i) => s + (forecastData.lastYear[i]?.[m] || 0), 0)
          const ytdChange = ytdLast > 0 ? ((ytdThis - ytdLast) / ytdLast) * 100 : 0
          const ytdMonthCount = completedMonthIndices.length

          // Margin calculations
          const ytdRevenue = completedMonthIndices.reduce((s, i) => s + Math.max(forecastData.actual[i].revenue, 0), 0)
          const ytdCosts = completedMonthIndices.reduce((s, i) => s + Math.max(forecastData.actual[i].costs, 0), 0)
          const ytdMargin = ytdRevenue > 0 ? ((ytdRevenue - ytdCosts) / ytdRevenue) * 100 : 0

          const lyRevenue = forecastData.lastYear.reduce((s, l) => s + l.revenue, 0)
          const lyCosts = forecastData.lastYear.reduce((s, l) => s + l.costs, 0)
          const lyMargin = lyRevenue > 0 ? ((lyRevenue - lyCosts) / lyRevenue) * 100 : 0

          const lyYtdRevenue = completedMonthIndices.reduce((s, i) => s + (forecastData.lastYear[i]?.revenue || 0), 0)
          const lyYtdCosts = completedMonthIndices.reduce((s, i) => s + (forecastData.lastYear[i]?.costs || 0), 0)
          const lyYtdMargin = lyYtdRevenue > 0 ? ((lyYtdRevenue - lyYtdCosts) / lyYtdRevenue) * 100 : 0

          const marginChange = ytdMargin - lyYtdMargin

          const ytdItems = [
            { label: 'Year to Date', value: ytdThis, sub: `Apr–${forecastData.actual[completedMonthIndices[completedMonthIndices.length - 1]]?.label || 'Apr'} (${ytdMonthCount}mo)` },
            { label: 'Same Period Last Year', value: ytdLast },
            { label: 'YTD Change', value: null, display: `${ytdChange >= 0 ? '+' : ''}${ytdChange.toFixed(1)}%`, color: ytdChange >= 0 ? C.green : C.red },
            { label: 'YTD Margin', value: null, display: `${ytdMargin.toFixed(1)}%`, color: ytdMargin >= 50 ? C.green : ytdMargin >= 30 ? C.gold : C.red, sub: `Last yr: ${lyYtdMargin.toFixed(1)}% (${marginChange >= 0 ? '+' : ''}${marginChange.toFixed(1)}pp)` },
          ]
          const fullItems = [
            { label: `Full Year (projected)`, value: thisYearProjected, sub: `Actual: ${fmtCurrency(Math.round(thisYearActual))}` },
            { label: 'Last Year (full)', value: lastYearTotal },
            { label: 'Full Year Change', value: null, display: `${yoyChange >= 0 ? '+' : ''}${yoyChange.toFixed(1)}%`, color: yoyChange >= 0 ? C.green : C.red },
            { label: 'Last Year Margin', value: null, display: `${lyMargin.toFixed(1)}%`, color: lyMargin >= 50 ? C.green : lyMargin >= 30 ? C.gold : C.red, sub: `Avg: ${avgPerYear > 0 ? fmtCurrency(Math.round(avgPerYear)) : '—'}/yr` },
          ]

          return (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 10 }}>
              {/* YTD column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: C.steel, textTransform: 'uppercase', letterSpacing: 0.8 }}>Year to Date</div>
                {ytdItems.slice(0, 3).map(item => (
                  <div key={item.label} style={{ background: C.black, borderRadius: 8, padding: '10px 14px', flex: 1 }}>
                    <div style={{ fontSize: 10, color: C.steel, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: item.color || metricColor }}>
                      {item.display || fmtCurrency(Math.round(item.value || 0))}
                    </div>
                    {item.sub && <div style={{ fontSize: 10, color: C.steel, marginTop: 2 }}>{item.sub}</div>}
                  </div>
                ))}
              </div>
              {/* Full year column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: C.steel, textTransform: 'uppercase', letterSpacing: 0.8 }}>Full Year</div>
                {fullItems.slice(0, 3).map(item => (
                  <div key={item.label} style={{ background: C.black, borderRadius: 8, padding: '10px 14px', flex: 1 }}>
                    <div style={{ fontSize: 10, color: C.steel, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: item.color || metricColor }}>
                      {item.display || fmtCurrency(Math.round(item.value || 0))}
                    </div>
                    {item.sub && <div style={{ fontSize: 10, color: C.steel, marginTop: 2 }}>{item.sub}</div>}
                  </div>
                ))}
              </div>
              {/* Margins column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderLeft: `1px solid ${C.steel}22`, paddingLeft: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: C.steel, textTransform: 'uppercase', letterSpacing: 0.8 }}>Margins</div>
                <div style={{ background: C.black, borderRadius: 8, padding: '10px 14px', flex: 1 }}>
                  <div style={{ fontSize: 10, color: C.steel, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>YTD Margin</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: ytdMargin >= 50 ? C.green : ytdMargin >= 30 ? C.gold : C.red }}>{ytdMargin.toFixed(1)}%</div>
                  <div style={{ fontSize: 10, color: C.steel, marginTop: 2 }}>vs {lyYtdMargin.toFixed(1)}% last yr ({marginChange >= 0 ? '+' : ''}{marginChange.toFixed(1)}pp)</div>
                </div>
                <div style={{ background: C.black, borderRadius: 8, padding: '10px 14px', flex: 1 }}>
                  <div style={{ fontSize: 10, color: C.steel, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>Last Year Margin</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: lyMargin >= 50 ? C.green : lyMargin >= 30 ? C.gold : C.red }}>{lyMargin.toFixed(1)}%</div>
                  <div style={{ fontSize: 10, color: C.steel, marginTop: 2 }}>Full year</div>
                </div>
                <div style={{ background: C.black, borderRadius: 8, padding: '10px 14px', flex: 1 }}>
                  <div style={{ fontSize: 10, color: C.steel, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>Margin Trend</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: marginChange >= 0 ? C.green : C.red }}>
                    {marginChange >= 0 ? '↑' : '↓'} {Math.abs(marginChange).toFixed(1)}pp
                  </div>
                  <div style={{ fontSize: 10, color: C.steel, marginTop: 2 }}>vs same period last year</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: C.steel, textAlign: 'center', fontStyle: 'italic' }}>
                {metricLabel} · FY {activeYear}
              </div>
            </div>
          )
        })()}
      </div>
      </div>
      </FeatureGate>

      {/* Job Type Detail Modal — opens when clicking a row in Job Type Performance */}
      {expandedJobType && (() => {
        const jt = jobTypePerformance.find(j => j.type === expandedJobType)
        if (!jt) return null
        // Get month-by-month revenue for this job type
        const monthlyData: { label: string; revenue: number; jobs: number }[] = []
        const now = new Date()
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          const monthJobs = paidJobs.filter(j => j.jobType === expandedJobType && j.date.startsWith(key))
          const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
          monthlyData.push({ label: months[d.getMonth()], revenue: monthJobs.reduce((s, j) => s + j.value, 0), jobs: monthJobs.length })
        }
        const maxRev = Math.max(...monthlyData.map(m => m.revenue), 1)
        const barColor = jt.marginNum >= 50 ? C.green : jt.marginNum >= 30 ? C.gold : '#D46A6A'
        return (
          <>
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 200 }} onClick={() => setExpandedJobType(null)} />
            <div style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              background: C.charcoalLight, borderRadius: 16, padding: 'clamp(20px, 4vw, 28px)',
              width: 'min(520px, calc(100vw - 24px))', maxHeight: 'calc(100dvh - 24px)', overflowY: 'auto',
              zIndex: 210, boxShadow: '0 16px 48px rgba(0,0,0,.5)', border: `1px solid ${C.steel}44`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.white }}>{expandedJobType}</div>
                  <div style={{ fontSize: 12, color: C.silver, marginTop: 2 }}>{jt.jobs} jobs · {jt.revenue} revenue · {jt.avgPrice} avg</div>
                </div>
                <button onClick={() => setExpandedJobType(null)} style={{ background: 'transparent', border: 'none', color: C.silver, cursor: 'pointer', padding: 4, display: 'flex' }}>
                  <X size={20} />
                </button>
              </div>

              {/* Margin bar */}
              <div style={{ background: C.black, borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: C.silver }}>Profit Margin</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: barColor }}>{jt.margin}</span>
                </div>
                <div style={{ background: `${C.steel}33`, borderRadius: 4, height: 10, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ width: `${Math.min(jt.marginNum, 100)}%`, height: '100%', borderRadius: 4, background: barColor }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.steel }}>
                  <span>Revenue: {fmtCurrency(Math.round(jt.revenueRaw))}</span>
                  <span>Costs: {fmtCurrency(Math.round(jt.costsRaw))}</span>
                  <span>Profit: {fmtCurrency(Math.round(jt.revenueRaw - jt.costsRaw))}</span>
                </div>
              </div>

              {/* 6-month trend mini chart */}
              <div style={{ fontSize: 12, fontWeight: 600, color: C.silver, marginBottom: 8 }}>Last 6 Months</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 100, marginBottom: 8 }}>
                {monthlyData.map((m, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{
                      width: '100%', borderRadius: 4,
                      height: maxRev > 0 ? Math.max((m.revenue / maxRev) * 80, 4) : 4,
                      background: m.revenue > 0 ? barColor : `${C.steel}33`,
                      transition: 'height .3s',
                    }} />
                    <span style={{ fontSize: 9, color: C.steel }}>{m.label}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.steel }}>
                {monthlyData.map((m, i) => (
                  <span key={i} style={{ flex: 1, textAlign: 'center' }}>
                    {m.jobs > 0 ? `${m.jobs}j · £${Math.round(m.revenue / 1000)}k` : '—'}
                  </span>
                ))}
              </div>

              {/* Trend indicator */}
              <div style={{
                marginTop: 16, padding: '10px 14px', borderRadius: 8,
                background: C.black, display: 'flex', alignItems: 'center', gap: 10,
              }}>
                {jt.trend === 'up' ? <TrendingUp size={16} color={C.green} /> : jt.trend === 'down' ? <TrendingDown size={16} color={'#D46A6A'} /> : <span style={{ color: C.steel }}>—</span>}
                <span style={{ fontSize: 12, color: C.silver }}>
                  {jt.trend === 'up' ? 'Revenue trending up vs previous period' : jt.trend === 'down' ? 'Revenue trending down vs previous period' : 'Revenue stable vs previous period'}
                </span>
              </div>
            </div>
          </>
        )
      })()}

      {/* ═══════════ Drill-down modals for all clickable elements ═══════════ */}

      {/* All Job Types Performance */}
      {activeModal === 'allJobTypes' && (
        <InsightModal title="All Job Type Performance" subtitle={`${periodLabels[period]} · ${jobTypePerformance.length} types`} onClose={() => setActiveModal(null)} width={640}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {jobTypePerformance.map(jt => {
              const barColor = jt.marginNum >= 50 ? C.green : jt.marginNum >= 30 ? C.gold : '#D46A6A'
              return (
                <div key={jt.type} onClick={() => { setActiveModal(null); setExpandedJobType(jt.type) }} style={{
                  background: C.black, borderRadius: 10, padding: '12px 16px', cursor: 'pointer',
                  transition: 'background .15s',
                }} onMouseEnter={e => { e.currentTarget.style.background = `${C.steel}22` }} onMouseLeave={e => { e.currentTarget.style.background = C.black }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 600, color: C.white }}>{jt.type}</span>
                      <span style={{ fontSize: 12, color: C.silver, marginLeft: 8 }}>{jt.jobs} job{jt.jobs > 1 ? 's' : ''} · {jt.avgPrice} avg</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: C.gold }}>{jt.revenue}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: barColor, marginLeft: 8 }}>{jt.margin}</span>
                    </div>
                  </div>
                  <div style={{ background: `${C.steel}33`, borderRadius: 3, height: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(jt.marginNum, 100)}%`, height: '100%', borderRadius: 3, background: barColor }} />
                  </div>
                </div>
              )
            })}
          </div>
        </InsightModal>
      )}

      {/* All Customers */}
      {activeModal === 'allCustomers' && (() => {
        const allCusts: typeof repeatCustomers = []
        const byCustomer: Record<string, { name: string; jobs: number; totalSpend: number; totalCost: number; lastDate: string }> = {}
        for (const j of periodJobs) {
          if (!byCustomer[j.customerId]) {
            const cust = customers.find(c => c.id === j.customerId)
            byCustomer[j.customerId] = { name: cust?.name || j.customerName, jobs: 0, totalSpend: 0, totalCost: 0, lastDate: j.date }
          }
          const entry = byCustomer[j.customerId]
          entry.jobs += 1; entry.totalSpend += j.value; entry.totalCost += getJobCost(j)
          if (j.date > entry.lastDate) entry.lastDate = j.date
        }
        for (const c of Object.values(byCustomer)) {
          const margin = c.totalSpend > 0 ? Math.round(((c.totalSpend - c.totalCost) / c.totalSpend) * 100) : 0
          allCusts.push({ name: c.name, jobs: c.jobs, totalSpend: fmtCurrency(c.totalSpend), margin, marginColor: margin >= 50 ? '#6ABF8A' : margin >= 30 ? '#C6A86A' : '#D46A6A', lastJob: new Date(c.lastDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) })
        }
        allCusts.sort((a, b) => b.jobs - a.jobs)
        return (
          <InsightModal title="All Customers" subtitle={`${periodLabels[period]} · ${allCusts.length} customers`} onClose={() => setActiveModal(null)} width={540}>
            {allCusts.map((c, i) => (
              <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 8px', borderBottom: i < allCusts.length - 1 ? `1px solid ${C.steel}1A` : 'none' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.white }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: C.silver }}>{c.jobs} jobs · Last: {c.lastJob}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.gold }}>{c.totalSpend}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: c.marginColor }}>{c.margin}% margin</div>
                </div>
              </div>
            ))}
          </InsightModal>
        )
      })()}

      {/* Revenue KPI breakdown */}
      {activeModal === 'revenueKpi' && (
        <InsightModal title="Revenue Breakdown" subtitle={periodLabels[period]} onClose={() => setActiveModal(null)}>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.gold, marginBottom: 16 }}>{fmtCurrency(periodJobs.reduce((s, j) => s + j.value, 0))}</div>
          <div style={{ fontSize: 12, color: C.steel, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Top 10 jobs by value</div>
          {[...periodJobs].sort((a, b) => b.value - a.value).slice(0, 10).map((j, i) => (
            <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.steel}11`, fontSize: 13 }}>
              <span style={{ color: C.white }}>{i + 1}. {j.customerName} — {j.jobType}</span>
              <span style={{ color: C.gold, fontWeight: 600 }}>{fmtCurrency(j.value)}</span>
            </div>
          ))}
        </InsightModal>
      )}

      {/* Win Rate KPI breakdown */}
      {activeModal === 'winRateKpi' && (() => {
        const nonDraft = quotes.filter(q => q.status !== 'Draft')
        const accepted = nonDraft.filter(q => q.status === 'Accepted')
        const declined = nonDraft.filter(q => q.status === 'Declined' || q.status === 'Expired')
        const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const pending = nonDraft.filter(q => (q.status === 'Sent' || q.status === 'Viewed') && q.sentAt && new Date(q.sentAt) >= thirtyDaysAgo)
        return (
          <InsightModal title="Quote Conversion" subtitle={`${nonDraft.length} quotes sent`} onClose={() => setActiveModal(null)}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ background: C.black, borderRadius: 10, padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#6ABF8A' }}>{accepted.length}</div>
                <div style={{ fontSize: 11, color: C.steel }}>Accepted</div>
              </div>
              <div style={{ background: C.black, borderRadius: 10, padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: C.gold }}>{pending.length}</div>
                <div style={{ fontSize: 11, color: C.steel }}>Pending</div>
              </div>
              <div style={{ background: C.black, borderRadius: 10, padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#D46A6A' }}>{declined.length}</div>
                <div style={{ fontSize: 11, color: C.steel }}>Lost</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: C.silver }}>
              Win rate: <strong style={{ color: C.white }}>{Math.round(computed.winRate)}%</strong> — {computed.winRate > 50 ? 'healthy conversion' : 'consider following up on pending quotes'}
            </div>
          </InsightModal>
        )
      })()}

      {/* Avg Value / Duration KPI — simple info modals */}
      {(activeModal === 'avgValueKpi' || activeModal === 'durationKpi') && (
        <InsightModal
          title={activeModal === 'avgValueKpi' ? 'Average Job Value' : 'Average Job Duration'}
          subtitle={`${periodJobs.length} jobs in ${periodLabels[period]}`}
          onClose={() => setActiveModal(null)}
        >
          {activeModal === 'avgValueKpi' ? (
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.gold, marginBottom: 16 }}>
                {fmtCurrency(periodJobs.length > 0 ? Math.round(periodJobs.reduce((s, j) => s + j.value, 0) / periodJobs.length) : 0)}
              </div>
              <div style={{ fontSize: 12, color: C.steel, marginBottom: 8 }}>Value distribution</div>
              {[
                { label: 'Under £250', count: periodJobs.filter(j => j.value < 250).length },
                { label: '£250–£500', count: periodJobs.filter(j => j.value >= 250 && j.value < 500).length },
                { label: '£500–£1,000', count: periodJobs.filter(j => j.value >= 500 && j.value < 1000).length },
                { label: '£1,000–£2,500', count: periodJobs.filter(j => j.value >= 1000 && j.value < 2500).length },
                { label: 'Over £2,500', count: periodJobs.filter(j => j.value >= 2500).length },
              ].map(band => (
                <div key={band.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
                  <span style={{ color: C.silver }}>{band.label}</span>
                  <span style={{ color: C.white, fontWeight: 600 }}>{band.count} job{band.count !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.gold, marginBottom: 16 }}>
                {periodJobs.length > 0 ? (periodJobs.reduce((s, j) => s + j.estimatedHours, 0) / periodJobs.length).toFixed(1) : '0.0'}h
              </div>
              <div style={{ fontSize: 12, color: C.steel, marginBottom: 8 }}>Duration distribution</div>
              {[
                { label: 'Under 2h', count: periodJobs.filter(j => j.estimatedHours < 2).length },
                { label: '2–4h', count: periodJobs.filter(j => j.estimatedHours >= 2 && j.estimatedHours < 4).length },
                { label: '4–8h (full day)', count: periodJobs.filter(j => j.estimatedHours >= 4 && j.estimatedHours < 8).length },
                { label: '1–2 days', count: periodJobs.filter(j => j.estimatedHours >= 8 && j.estimatedHours < 16).length },
                { label: '2+ days', count: periodJobs.filter(j => j.estimatedHours >= 16).length },
              ].map(band => (
                <div key={band.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
                  <span style={{ color: C.silver }}>{band.label}</span>
                  <span style={{ color: C.white, fontWeight: 600 }}>{band.count} job{band.count !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          )}
        </InsightModal>
      )}

      {/* Financial Summary breakdowns */}
      {activeModal === 'revenueSummary' && (
        <InsightModal title="Revenue Breakdown" subtitle={`${periodLabels[period]}`} onClose={() => setActiveModal(null)}>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.gold, marginBottom: 16 }}>{fmtCurrency(Math.round(financials.revenue))}</div>
          <div style={{ fontSize: 12, color: C.steel, marginBottom: 8 }}>By job type</div>
          {jobTypePerformance.map(jt => (
            <div key={jt.type} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.steel}11`, fontSize: 13 }}>
              <span style={{ color: C.silver }}>{jt.type} ({jt.jobs})</span>
              <span style={{ color: C.gold, fontWeight: 600 }}>{jt.revenue}</span>
            </div>
          ))}
        </InsightModal>
      )}

      {activeModal === 'costsSummary' && (
        <InsightModal title="Costs Breakdown" subtitle={`${periodLabels[period]}`} onClose={() => setActiveModal(null)}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#D46A6A', marginBottom: 16 }}>{fmtCurrency(Math.round(financials.costs))}</div>
          <div style={{ fontSize: 12, color: C.steel, marginBottom: 8 }}>By job type</div>
          {jobTypePerformance.map(jt => (
            <div key={jt.type} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.steel}11`, fontSize: 13 }}>
              <span style={{ color: C.silver }}>{jt.type}</span>
              <span style={{ color: '#D46A6A', fontWeight: 600 }}>{fmtCurrency(Math.round(jt.costsRaw))}</span>
            </div>
          ))}
        </InsightModal>
      )}

      {activeModal === 'profitSummary' && (
        <InsightModal title="Profit Breakdown" subtitle={`${periodLabels[period]}`} onClose={() => setActiveModal(null)}>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.green, marginBottom: 16 }}>{fmtCurrency(Math.round(financials.grossProfit))}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div style={{ background: C.black, borderRadius: 10, padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.gold }}>{fmtCurrency(Math.round(financials.revenue))}</div>
              <div style={{ fontSize: 10, color: C.steel }}>Revenue</div>
            </div>
            <div style={{ background: C.black, borderRadius: 10, padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#D46A6A' }}>{fmtCurrency(Math.round(financials.costs))}</div>
              <div style={{ fontSize: 10, color: C.steel }}>Costs</div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: C.silver }}>
            Overall margin: <strong style={{ color: financials.revenue > 0 ? C.green : C.steel }}>{financials.revenue > 0 ? Math.round((financials.grossProfit / financials.revenue) * 100) : 0}%</strong>
          </div>
        </InsightModal>
      )}

      {activeModal === 'taxSummary' && (
        <InsightModal title="Tax Estimate Breakdown" subtitle="Based on 2025/26 HMRC rates" onClose={() => setActiveModal(null)}>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.silver, marginBottom: 16 }}>{fmtCurrency(Math.round(financials.estimatedTax))}/yr</div>
          <div style={{ fontSize: 12, color: C.steel, marginBottom: 8 }}>Components</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: `1px solid ${C.steel}11` }}>
              <span style={{ color: C.silver }}>Gross Profit (taxable income)</span>
              <span style={{ color: C.white, fontWeight: 600 }}>{fmtCurrency(Math.round(financials.grossProfit))}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: `1px solid ${C.steel}11` }}>
              <span style={{ color: C.silver }}>Personal Allowance</span>
              <span style={{ color: C.green }}>−£12,570</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: `1px solid ${C.steel}11` }}>
              <span style={{ color: C.silver }}>Income Tax (20% basic / 40% higher)</span>
              <span style={{ color: C.white }}>{fmtCurrency(Math.round(financials.estimatedTax * 0.7))}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: `1px solid ${C.steel}11` }}>
              <span style={{ color: C.silver }}>Class 2 NI (£3.45/week)</span>
              <span style={{ color: C.white }}>£179</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
              <span style={{ color: C.silver }}>Class 4 NI (6%/2% bands)</span>
              <span style={{ color: C.white }}>{fmtCurrency(Math.round(financials.estimatedTax * 0.3))}</span>
            </div>
          </div>
          <div style={{ fontSize: 11, color: C.steel, marginTop: 12, fontStyle: 'italic' }}>
            This is a rough estimate. Actual tax depends on personal circumstances, allowable expenses, pension contributions, and other factors. Consult your accountant.
          </div>
        </InsightModal>
      )}

      {/* ── VAT Summary Panel ── */}
      <div style={{ ...s.panel, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={s.panelTitle}>VAT Summary — {periodLabels[period]}{financialView === 'projected' && period === 'year' ? ' (Projected)' : ''}</div>
          {period === 'year' && (
            <div style={{ display: 'flex', background: C.black, borderRadius: 8, overflow: 'hidden' }}>
              <button
                onClick={() => setFinancialView('actuals')}
                style={{
                  padding: '6px 12px', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  background: financialView === 'actuals' ? C.charcoalLight : 'transparent',
                  color: financialView === 'actuals' ? C.gold : C.steel,
                }}
              >Actuals</button>
              <button
                onClick={() => setFinancialView('projected')}
                style={{
                  padding: '6px 12px', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  background: financialView === 'projected' ? C.charcoalLight : 'transparent',
                  color: financialView === 'projected' ? C.gold : C.steel,
                }}
              >Full Year</button>
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 12 }}>
          {[
            { label: 'Output VAT (collected)', value: fmtCurrency(Math.round(vatSummary.outputVAT)), color: C.gold },
            { label: 'Input VAT (reclaimable)', value: fmtCurrency(Math.round(vatSummary.inputVAT)), color: C.green },
            { label: 'VAT Liability', value: fmtCurrency(Math.round(vatSummary.liability)), color: vatSummary.liability > 0 ? C.red : C.green },
          ].map(item => (
            <div key={item.label} style={{
              background: C.black, borderRadius: 10, padding: '16px 20px',
              borderTop: `3px solid ${item.color}`,
            }}>
              <div style={{ fontSize: 12, color: C.silver, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: C.steel, fontStyle: 'italic', padding: '4px 0' }}>
          Estimated — consult your accountant for actual figures
        </div>
      </div>

      </>}
    </div>
    </FeatureGate>
  )
}
