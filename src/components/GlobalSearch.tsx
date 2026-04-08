import { useState, useEffect, useRef, useMemo, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  X,
  Users,
  Briefcase,
  FileText,
  Receipt,
} from 'lucide-react'
import { useData } from '../data/DataContext'
import { useTheme } from '../theme/ThemeContext'

interface SearchResult {
  category: 'customer' | 'job' | 'quote' | 'invoice'
  id: string
  primary: string
  secondary: string
  badge: string
  navigateTo: string
  queryParams?: string
}

const categoryConfig = {
  customer: { label: 'Customers', icon: Users },
  job: { label: 'Jobs', icon: Briefcase },
  quote: { label: 'Quotes', icon: FileText },
  invoice: { label: 'Invoices', icon: Receipt },
} as const

const MAX_PER_CATEGORY = 5

export default function GlobalSearch({ onClose }: { onClose: () => void }) {
  const { C } = useTheme()
  const navigate = useNavigate()
  const { customers, jobs, quotes, invoices } = useData()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []

    const all: SearchResult[] = []

    // Search customers
    const matchedCustomers = customers
      .filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.postcode.toLowerCase().includes(q)
      )
      .slice(0, MAX_PER_CATEGORY)
      .map(c => ({
        category: 'customer' as const,
        id: c.id,
        primary: c.name,
        secondary: [c.email, c.phone].filter(Boolean).join(' | '),
        badge: c.postcode || c.city || '',
        navigateTo: '/customers',
      }))
    all.push(...matchedCustomers)

    // Search jobs
    const matchedJobs = jobs
      .filter(j =>
        j.id.toLowerCase().includes(q) ||
        j.customerName.toLowerCase().includes(q) ||
        j.jobType.toLowerCase().includes(q)
      )
      .slice(0, MAX_PER_CATEGORY)
      .map(j => ({
        category: 'job' as const,
        id: j.id,
        primary: `${j.jobType} — ${j.customerName}`,
        secondary: j.date,
        badge: j.status,
        navigateTo: '/jobs',
      }))
    all.push(...matchedJobs)

    // Search quotes
    const matchedQuotes = quotes
      .filter(qu =>
        qu.ref.toLowerCase().includes(q) ||
        qu.customerName.toLowerCase().includes(q) ||
        qu.jobTypeName.toLowerCase().includes(q)
      )
      .slice(0, MAX_PER_CATEGORY)
      .map(qu => ({
        category: 'quote' as const,
        id: qu.id,
        primary: `${qu.ref} — ${qu.customerName}`,
        secondary: qu.jobTypeName,
        badge: qu.status,
        navigateTo: '/quote',
        queryParams: `?quoteId=${qu.id}`,
      }))
    all.push(...matchedQuotes)

    // Search invoices
    const matchedInvoices = invoices
      .filter(inv =>
        inv.ref.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q)
      )
      .slice(0, MAX_PER_CATEGORY)
      .map(inv => ({
        category: 'invoice' as const,
        id: inv.id,
        primary: `${inv.ref} — ${inv.customerName}`,
        secondary: `Due: ${inv.dueDate}`,
        badge: inv.status,
        navigateTo: '/jobs',
      }))
    all.push(...matchedInvoices)

    return all
  }, [query, customers, jobs, quotes, invoices])

  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {}
    for (const r of results) {
      if (!groups[r.category]) groups[r.category] = []
      groups[r.category].push(r)
    }
    return groups
  }, [results])

  const handleSelect = (result: SearchResult) => {
    onClose()
    const path = result.queryParams
      ? `${result.navigateTo}${result.queryParams}`
      : result.navigateTo
    navigate(path)
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  /* ── Styles ── */
  const s: Record<string, CSSProperties> = {
    overlay: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(4px)',
      zIndex: 300,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingTop: '12vh',
    },
    modal: {
      width: '100%',
      maxWidth: 600,
      margin: '0 16px',
      background: C.charcoal,
      borderRadius: 16,
      border: `1px solid ${C.steel}66`,
      boxShadow: '0 24px 64px rgba(0,0,0,.6)',
      overflow: 'hidden',
      maxHeight: '70vh',
      display: 'flex',
      flexDirection: 'column',
    },
    inputWrap: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '16px 20px',
      borderBottom: `1px solid ${C.steel}44`,
    },
    searchIcon: {
      color: C.steelLight || '#5A5F66',
      flexShrink: 0,
    },
    input: {
      flex: 1,
      fontSize: 18,
      fontWeight: 500,
      background: 'transparent',
      border: 'none',
      outline: 'none',
      color: C.white,
      fontFamily: 'inherit',
    },
    closeBtn: {
      background: 'transparent',
      border: 'none',
      color: C.silver,
      cursor: 'pointer',
      padding: 6,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 6,
      flexShrink: 0,
    },
    kbd: {
      fontSize: 11,
      fontWeight: 600,
      color: C.steelLight || '#5A5F66',
      background: `${C.steel}22`,
      border: `1px solid ${C.steel}44`,
      borderRadius: 4,
      padding: '2px 6px',
      marginLeft: 4,
    },
    results: {
      overflowY: 'auto',
      padding: '8px 0',
    },
    categoryHeader: {
      fontSize: 11,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: C.gold,
      padding: '12px 20px 6px',
    },
    resultItem: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 20px',
      cursor: 'pointer',
      transition: 'background-color 0.1s ease',
      borderRadius: 0,
    },
    resultIcon: {
      width: 32,
      height: 32,
      borderRadius: 8,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    resultText: {
      flex: 1,
      minWidth: 0,
    },
    resultPrimary: {
      fontSize: 14,
      fontWeight: 600,
      color: C.white,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    resultSecondary: {
      fontSize: 12,
      color: C.silver,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    badge: {
      fontSize: 10,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      padding: '3px 8px',
      borderRadius: 10,
      background: `${C.steel}33`,
      color: C.silver,
      flexShrink: 0,
      whiteSpace: 'nowrap',
    },
    empty: {
      padding: '32px 20px',
      textAlign: 'center',
      color: C.silver,
      fontSize: 14,
    },
    hint: {
      padding: '12px 20px',
      textAlign: 'center',
      color: `${C.steelLight || '#5A5F66'}`,
      fontSize: 13,
    },
  }

  const iconBgColors: Record<string, string> = {
    customer: `${C.gold}1A`,
    job: '#5B9BD51A',
    quote: '#6ABF8A1A',
    invoice: '#D4A05B1A',
  }

  const iconColors: Record<string, string> = {
    customer: C.gold,
    job: '#5B9BD5',
    quote: '#6ABF8A',
    invoice: '#D4A05B',
  }

  const categories = ['customer', 'job', 'quote', 'invoice'] as const

  return (
    <div ref={overlayRef} style={s.overlay} onClick={handleOverlayClick}>
      <div style={s.modal}>
        {/* Search input */}
        <div style={s.inputWrap}>
          <Search size={20} style={s.searchIcon} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search customers, jobs, quotes, invoices..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={s.input}
          />
          {query && (
            <button style={s.closeBtn} onClick={() => setQuery('')} title="Clear">
              <X size={16} />
            </button>
          )}
          <span style={s.kbd}>ESC</span>
        </div>

        {/* Results */}
        <div style={s.results}>
          {query.trim() === '' && (
            <div style={s.hint}>Type to search across all data...</div>
          )}

          {query.trim() !== '' && results.length === 0 && (
            <div style={s.empty}>No results found for "{query}"</div>
          )}

          {categories.map(cat => {
            const items = groupedResults[cat]
            if (!items || items.length === 0) return null
            const cfg = categoryConfig[cat]
            const Icon = cfg.icon

            return (
              <div key={cat}>
                <div style={s.categoryHeader}>{cfg.label}</div>
                {items.map(item => (
                  <div
                    key={item.id}
                    style={s.resultItem}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={e => {
                      ;(e.currentTarget as HTMLDivElement).style.backgroundColor = `${C.steel}22`
                    }}
                    onMouseLeave={e => {
                      ;(e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'
                    }}
                  >
                    <div
                      style={{
                        ...s.resultIcon,
                        background: iconBgColors[cat],
                      }}
                    >
                      <Icon size={16} color={iconColors[cat]} />
                    </div>
                    <div style={s.resultText}>
                      <div style={s.resultPrimary as CSSProperties}>{item.primary}</div>
                      {item.secondary && (
                        <div style={s.resultSecondary as CSSProperties}>{item.secondary}</div>
                      )}
                    </div>
                    {item.badge && <span style={s.badge as CSSProperties}>{item.badge}</span>}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
