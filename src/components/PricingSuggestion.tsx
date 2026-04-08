import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useData } from '../data/DataContext'

interface PricingSuggestionProps {
  jobTypeId: string
  currentTotal: number
}

function fmt(n: number): string {
  return n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${d.getFullYear()}`
}

export default function PricingSuggestion({ jobTypeId, currentTotal }: PricingSuggestionProps) {
  const { jobs, quotes } = useData()
  const [expanded, setExpanded] = useState(false)

  const analysis = useMemo(() => {
    // Get all paid jobs
    const paidJobs = jobs.filter(j => j.status === 'Paid')

    // Filter to same job type — match by jobType field or by linked quote's jobTypeId
    const similar = paidJobs.filter(j => {
      // Direct match on job type name
      if (j.jobType.toLowerCase().includes(jobTypeId.replace(/-/g, ' '))) return true
      // Match via linked quote
      if (j.quoteId) {
        const q = quotes.find(qq => qq.id === j.quoteId)
        if (q && q.jobTypeId === jobTypeId) return true
        // Also match if the jobTypeName contains the job type (for multi-line quotes)
        if (q && q.jobTypeName.toLowerCase().includes(jobTypeId.replace(/-/g, ' '))) return true
      }
      return false
    })

    if (similar.length < 1) return null

    const values = similar.map(j => {
      if (j.value > 0) return j.value
      const q = j.quoteId ? quotes.find(qq => qq.id === j.quoteId) : undefined
      return q?.netTotal ?? 0
    }).filter(v => v > 0).sort((a, b) => a - b)

    if (values.length < 1) return null

    const count = values.length
    const sum = values.reduce((s, v) => s + v, 0)
    const avg = sum / count
    const min = values[0]
    const max = values[values.length - 1]
    const median = count % 2 === 0
      ? (values[count / 2 - 1] + values[count / 2]) / 2
      : values[Math.floor(count / 2)]

    // Last similar job
    const lastJob = similar.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
    const lastJobValue = lastJob.value > 0 ? lastJob.value : (lastJob.quoteId ? quotes.find(q => q.id === lastJob.quoteId)?.netTotal ?? 0 : 0)

    // Average margin on this job type
    const margins = similar.map(j => {
      if (!j.quoteId) return null
      const q = quotes.find(qq => qq.id === j.quoteId)
      return q ? q.margin : null
    }).filter((m): m is number => m !== null)
    const avgMargin = margins.length > 0 ? margins.reduce((s, m) => s + m, 0) / margins.length : null

    return { count, avg, min, max, median, lastJob, lastJobValue, avgMargin }
  }, [jobs, quotes, jobTypeId])

  if (!analysis) return null

  // Determine pricing status
  const lowerBound = analysis.avg * 0.75
  const upperBound = analysis.avg * 1.25
  let statusIcon: string
  let statusText: string
  let statusColor: string

  if (analysis.count < 3) {
    statusIcon = '--'
    statusText = 'Not enough data (< 3 jobs)'
    statusColor = '#4B5057'
  } else if (currentTotal <= 0) {
    statusIcon = '--'
    statusText = 'Add line items to compare'
    statusColor = '#4B5057'
  } else if (currentTotal >= lowerBound && currentTotal <= upperBound) {
    statusIcon = '\u2713'
    statusText = 'within range'
    statusColor = '#6ABF8A'
  } else if (currentTotal > upperBound) {
    statusIcon = '\u26A0'
    statusText = 'above average'
    statusColor = '#C6A86A'
  } else {
    statusIcon = '\u26A0'
    statusText = 'below average'
    statusColor = '#D46A6A'
  }

  return (
    <div
      style={{
        background: 'var(--color-black)',
        borderRadius: 12,
        border: '1px solid #C6A86A33',
        overflow: 'hidden',
        marginBottom: 16,
      }}
    >
      {/* Header — always visible, click to toggle */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '12px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }} role="img" aria-label="lightbulb">💡</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-white)' }}>
            Pricing Insight
          </span>
          <span style={{ fontSize: 12, color: 'var(--color-steel-light)' }}>
            ({analysis.count} similar job{analysis.count !== 1 ? 's' : ''})
          </span>
        </div>
        <div style={{ color: 'var(--color-steel)', display: 'flex' }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: '0 16px 14px', fontSize: 13 }}>
          {/* Stats row */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '8px 12px',
            background: 'var(--color-charcoal)',
            borderRadius: 8,
            marginBottom: 10,
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--color-steel)', marginBottom: 2 }}>Average</div>
              <div style={{ fontWeight: 600, color: 'var(--color-white)' }}>{'\u00A3'}{fmt(analysis.avg)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--color-steel)', marginBottom: 2 }}>Range</div>
              <div style={{ fontWeight: 500, color: 'var(--color-silver)' }}>
                {'\u00A3'}{fmt(analysis.min)} {'\u2014'} {'\u00A3'}{fmt(analysis.max)}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--color-steel)', marginBottom: 2 }}>Median</div>
              <div style={{ fontWeight: 500, color: 'var(--color-silver)' }}>{'\u00A3'}{fmt(analysis.median)}</div>
            </div>
          </div>

          {/* Current price comparison */}
          {currentTotal > 0 && analysis.count >= 3 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              background: statusColor + '12',
              borderRadius: 8,
              marginBottom: 10,
              border: `1px solid ${statusColor}33`,
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: statusColor }}>{statusIcon}</span>
              <span style={{ color: 'var(--color-silver)', fontSize: 12 }}>
                Your price: {'\u00A3'}{fmt(currentTotal)}
              </span>
              <span style={{ color: statusColor, fontSize: 12, fontWeight: 600 }}>
                {statusText}
              </span>
            </div>
          )}

          {analysis.count < 3 && (
            <div style={{
              padding: '6px 12px',
              borderRadius: 8,
              marginBottom: 10,
              fontSize: 12,
              color: 'var(--color-steel)',
              fontStyle: 'italic',
            }}>
              Need at least 3 similar jobs for pricing comparison
            </div>
          )}

          {/* Last similar job */}
          {analysis.lastJob && analysis.lastJobValue > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: 'var(--color-steel-light)', fontSize: 12 }}>
              <span>Last similar: {'\u00A3'}{fmt(analysis.lastJobValue)} for {analysis.lastJob.customerName}</span>
              <span>{fmtDate(analysis.lastJob.date)}</span>
            </div>
          )}

          {/* Average margin */}
          {analysis.avgMargin !== null && (
            <div style={{ padding: '4px 0', color: 'var(--color-steel-light)', fontSize: 12 }}>
              Avg margin on this type: {Math.round(analysis.avgMargin)}%
            </div>
          )}
        </div>
      )}
    </div>
  )
}
