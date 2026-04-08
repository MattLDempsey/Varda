import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, X, ChevronRight, FileText } from 'lucide-react'
import { useTheme } from '../theme/ThemeContext'
import { useData } from '../data/DataContext'
import { useSubscription } from '../subscription/SubscriptionContext'
import { useUndo } from '../hooks/useUndo'
import { LimitWarning } from '../components/FeatureGate'
import LoadingSpinner from '../components/LoadingSpinner'
import { validateRequired, validateEmail } from '../lib/validation'
import type { CSSProperties } from 'react'
import type { Customer } from '../data/DataContext'

const emptyForm = {
  name: '', phone: '', email: '', address1: '', address2: '', city: '', postcode: '', notes: '',
}

export default function Customers() {
  const { C } = useTheme()
  const navigate = useNavigate()
  const { customers, jobs, addCustomer, deleteCustomer, isDataLoading } = useData()
  const { features, plan } = useSubscription()
  const { showUndo } = useUndo()

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Customer | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  /* ── derived data helpers ── */
  const jobCountMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const j of jobs) {
      map[j.customerId] = (map[j.customerId] || 0) + 1
    }
    return map
  }, [jobs])

  const lastActivityMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const j of jobs) {
      if (!map[j.customerId] || j.date > map[j.customerId]) {
        map[j.customerId] = j.date
      }
    }
    return map
  }, [jobs])

  const formatDate = (iso: string): string => {
    const d = new Date(iso + 'T00:00:00')
    const day = d.getDate()
    const month = d.toLocaleString('en-GB', { month: 'short' })
    const year = d.getFullYear()
    return `${day} ${month} ${year}`
  }

  const getJobCount = (c: Customer) => jobCountMap[c.id] || 0
  const getLastActivity = (c: Customer) => {
    const jobDate = lastActivityMap[c.id]
    const date = jobDate || c.createdAt
    return formatDate(date)
  }

  /* ── styles ── */
  const s: Record<string, CSSProperties> = {
    page: {
      padding: '32px',
      maxWidth: 1200,
      margin: '0 auto',
      position: 'relative',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 24,
      gap: 16,
      flexWrap: 'wrap',
    },
    heading: {
      fontSize: 28,
      fontWeight: 600,
      color: C.white,
    },
    searchWrap: {
      display: 'flex',
      alignItems: 'center',
      background: C.black,
      borderRadius: 10,
      padding: '0 14px',
      flex: '1 1 280px',
      maxWidth: 400,
      minHeight: 44,
    },
    searchInput: {
      background: 'transparent',
      border: 'none',
      outline: 'none',
      color: C.white,
      fontSize: 14,
      padding: '10px 8px',
      width: '100%',
    },
    addBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      background: C.gold,
      color: C.black,
      border: 'none',
      borderRadius: 10,
      padding: '10px 20px',
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer',
      minHeight: 44,
      transition: 'opacity .15s',
    },
    tableWrap: {
      borderRadius: 12,
      overflow: 'hidden',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse' as const,
      background: C.charcoalLight,
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
    },
    td: {
      padding: '14px 16px',
      fontSize: 14,
      color: C.white,
      borderBottom: `1px solid ${C.steel}1A`,
    },
    row: {
      cursor: 'pointer',
      transition: 'background .15s',
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
    input: {
      width: '100%',
      background: C.black,
      border: `1px solid ${C.steel}44`,
      borderRadius: 8,
      padding: '10px 14px',
      color: C.white,
      fontSize: 14,
      outline: 'none',
      marginBottom: 16,
      minHeight: 44,
      boxSizing: 'border-box' as const,
    },
    textarea: {
      width: '100%',
      background: C.black,
      border: `1px solid ${C.steel}44`,
      borderRadius: 8,
      padding: '10px 14px',
      color: C.white,
      fontSize: 14,
      outline: 'none',
      marginBottom: 16,
      minHeight: 80,
      resize: 'vertical' as const,
      boxSizing: 'border-box' as const,
    },
    submitBtn: {
      width: '100%',
      background: C.gold,
      color: C.black,
      border: 'none',
      borderRadius: 10,
      padding: '14px',
      fontSize: 15,
      fontWeight: 600,
      cursor: 'pointer',
      minHeight: 48,
    },
    fieldError: { fontSize: 12, color: '#D46A6A', marginTop: -12, marginBottom: 12 },
    detailRow: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12,
    },
  }

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.postcode.toLowerCase().includes(search.toLowerCase())
  )

  const closePanel = () => {
    setSelected(null)
    setShowForm(false)
  }

  const handleFormChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    const nameErr = validateRequired(form.name, 'Name')
    if (nameErr) errs.name = nameErr
    if (form.email.trim()) {
      const emailErr = validateEmail(form.email.trim())
      if (emailErr) errs.email = emailErr
    }
    setFormErrors(errs)
    if (Object.keys(errs).length > 0) return
    addCustomer({
      name: form.name,
      phone: form.phone,
      email: form.email,
      address1: form.address1,
      address2: form.address2,
      city: form.city,
      postcode: form.postcode,
      notes: form.notes,
    })
    setFormErrors({})
    closePanel()
  }

  const panelOpen = selected !== null || showForm

  if (isDataLoading) {
    return (
      <div style={s.page}>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: C.white }}>Customers</h1>
        <LoadingSpinner message="Loading customers..." />
      </div>
    )
  }

  return (
    <div style={s.page}>
      {/* header */}
      <div style={s.header}>
        <h1 style={s.heading}>Customers</h1>
        <div style={s.searchWrap}>
          <Search size={18} color={C.steel} />
          <input
            style={s.searchInput}
            placeholder="Search by name, email, or postcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          style={s.addBtn}
          onClick={() => {
            setSelected(null)
            setForm(emptyForm)
            setShowForm(true)
          }}
        >
          <Plus size={18} /> Add Customer
        </button>
      </div>

      {/* Customer limit warning */}
      <LimitWarning current={customers.length} max={features?.maxCustomers ?? null} label="customers" plan={plan} />

      {/* table */}
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Name</th>
              <th style={s.th}>Phone</th>
              <th style={s.th}>Email</th>
              <th style={s.th}>Postcode</th>
              <th style={s.th}>Jobs</th>
              <th style={s.th}>Last Activity</th>
              <th style={{ ...s.th, width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '48px 24px', color: C.steel, fontSize: 15 }}>
                  {customers.length === 0
                    ? "No customers yet. They'll appear here when you create quotes."
                    : 'No customers match your search.'}
                </td>
              </tr>
            )}
            {filtered.map((c) => (
              <tr
                key={c.id}
                style={s.row}
                onClick={() => {
                  setShowForm(false)
                  setSelected(c)
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = C.steel + '22')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ ...s.td, fontWeight: 500 }}>{c.name}</td>
                <td style={{ ...s.td, color: C.silver }}>{c.phone}</td>
                <td style={{ ...s.td, color: C.silver }}>{c.email}</td>
                <td style={s.td}>{c.postcode}</td>
                <td style={{ ...s.td, color: C.gold, fontWeight: 600 }}>{getJobCount(c)}</td>
                <td style={{ ...s.td, color: C.silver, fontSize: 13 }}>{getLastActivity(c)}</td>
                <td style={s.td}>
                  <ChevronRight size={16} color={C.steel} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ ...s.td, textAlign: 'center', color: C.steel, padding: 40 }}>
                  No customers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* slide-in panel */}
      {panelOpen && (
        <>
          <div style={s.overlay} onClick={closePanel} />
          <div style={s.panel}>
            <div style={s.panelHeader}>
              <span style={s.panelTitle}>
                {showForm ? 'Add Customer' : selected?.name}
              </span>
              <button style={s.closeBtn} onClick={closePanel}>
                <X size={22} />
              </button>
            </div>

            {/* detail view */}
            {selected && !showForm && (() => {
              const custJobs = jobs.filter(j => j.customerId === selected.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              const totalSpend = custJobs.reduce((s, j) => s + j.value, 0)

              const statusColors: Record<string, string> = {
                Lead: '#8A8F96', Quoted: '#9B7ED8', Accepted: '#6ABF8A', Scheduled: '#5B9BD5',
                'In Progress': '#C6A86A', Complete: '#6ABF8A', Invoiced: '#5BBFD4', Paid: '#4CAF50',
              }

              return (
                <div>
                  {/* Create Quote button */}
                  <button
                    onClick={() => navigate(`/quote?customer=${encodeURIComponent(selected.name)}`)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      width: '100%', padding: '10px 16px', borderRadius: 10, marginBottom: 16,
                      background: 'transparent', border: `1px solid ${C.gold}`,
                      color: C.gold, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      transition: 'background .15s', minHeight: 40,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${C.gold}15` }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <FileText size={15} /> Create Quote
                  </button>

                  <div style={s.detailRow}>
                    <div>
                      <span style={s.fieldLabel}>Phone</span>
                      <div style={s.fieldValue}>{selected.phone || '—'}</div>
                    </div>
                    <div>
                      <span style={s.fieldLabel}>Email</span>
                      <div style={s.fieldValue}>{selected.email || '—'}</div>
                    </div>
                  </div>
                  <span style={s.fieldLabel}>Address</span>
                  <div style={s.fieldValue}>
                    {selected.address1 || '—'}
                    {selected.address2 && <>, {selected.address2}</>}
                    {(selected.city || selected.postcode) && <><br />{selected.city}{selected.city && selected.postcode ? ', ' : ''}{selected.postcode}</>}
                  </div>

                  {/* Stats row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                    <div style={{ background: C.black, borderRadius: 10, padding: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: C.gold }}>{custJobs.length}</div>
                      <div style={{ fontSize: 11, color: C.steel }}>Jobs</div>
                    </div>
                    <div style={{ background: C.black, borderRadius: 10, padding: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: C.gold }}>£{totalSpend.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</div>
                      <div style={{ fontSize: 11, color: C.steel }}>Total Spend</div>
                    </div>
                    <div style={{ background: C.black, borderRadius: 10, padding: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: C.gold }}>{getLastActivity(selected)}</div>
                      <div style={{ fontSize: 11, color: C.steel }}>Last Active</div>
                    </div>
                  </div>

                  {selected.notes && (
                    <>
                      <span style={s.fieldLabel}>Notes</span>
                      <div style={{ ...s.fieldValue, fontStyle: 'italic', color: C.silver }}>{selected.notes}</div>
                    </>
                  )}

                  {/* Job list */}
                  {custJobs.length > 0 && (
                    <div style={{ borderTop: `1px solid ${C.steel}33`, paddingTop: 16, marginTop: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: C.white, display: 'block', marginBottom: 10 }}>Job History</span>
                      {custJobs.map(j => (
                        <div
                          key={j.id}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 8px', borderRadius: 8, marginBottom: 4,
                            cursor: 'default', borderBottom: `1px solid ${C.steel}1A`,
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, color: C.white }}>{j.jobType}</span>
                            <span style={{ fontSize: 11, color: C.silver }}>
                              {j.id} · {formatDate(j.date)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: C.gold }}>
                              £{j.value.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                            </span>
                            <span style={{
                              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 12,
                              color: statusColors[j.status] || C.steel,
                              background: (statusColors[j.status] || C.steel) + '1A',
                              textTransform: 'uppercase', letterSpacing: 0.5,
                            }}>
                              {j.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Delete Customer */}
                  {(() => {
                    const activeStatuses = ['Lead', 'Quoted', 'Accepted', 'Scheduled', 'In Progress', 'Complete', 'Invoiced']
                    const hasActiveJobs = custJobs.some(j => activeStatuses.includes(j.status))
                    return (
                      <div style={{ borderTop: `1px solid ${C.steel}33`, paddingTop: 16, marginTop: 16 }}>
                        {hasActiveJobs ? (
                          <div style={{
                            padding: '12px 16px', borderRadius: 10, fontSize: 13,
                            color: '#D46A6A', background: '#D46A6A11',
                            textAlign: 'center', opacity: 0.7,
                          }}>
                            Cannot delete — has active jobs
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              const custData = { ...selected }
                              deleteCustomer(selected.id)
                              closePanel()
                              showUndo({
                                message: `Deleted: ${custData.name}`,
                                undo: () => addCustomer({
                                  name: custData.name, phone: custData.phone, email: custData.email,
                                  address1: custData.address1, address2: custData.address2,
                                  city: custData.city, postcode: custData.postcode, notes: custData.notes,
                                }),
                              })
                            }}
                            style={{
                              width: '100%', padding: '12px 16px', borderRadius: 10,
                              fontSize: 13, fontWeight: 600, cursor: 'pointer',
                              color: '#D46A6A', background: '#D46A6A15',
                              border: `1px solid #D46A6A33`,
                              transition: 'opacity .15s',
                            }}
                          >
                            Delete Customer
                          </button>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )
            })()}

            {/* add form */}
            {showForm && (
              <form onSubmit={handleAddCustomer}>
                <label style={s.fieldLabel}>Name</label>
                <input style={{ ...s.input, ...(formErrors.name ? { borderColor: '#D46A6A' } : {}) }} value={form.name} onChange={(e) => handleFormChange('name', e.target.value)} />
                {formErrors.name && <div style={s.fieldError}>{formErrors.name}</div>}

                <div style={s.detailRow}>
                  <div>
                    <label style={s.fieldLabel}>Phone</label>
                    <input style={s.input} value={form.phone} onChange={(e) => handleFormChange('phone', e.target.value)} />
                  </div>
                  <div>
                    <label style={s.fieldLabel}>Email</label>
                    <input style={{ ...s.input, ...(formErrors.email ? { borderColor: '#D46A6A' } : {}) }} type="email" value={form.email} onChange={(e) => handleFormChange('email', e.target.value)} />
                    {formErrors.email && <div style={{ ...s.fieldError, marginTop: -12 }}>{formErrors.email}</div>}
                  </div>
                </div>

                <label style={s.fieldLabel}>Address Line 1</label>
                <input style={s.input} value={form.address1} onChange={(e) => handleFormChange('address1', e.target.value)} />

                <label style={s.fieldLabel}>Address Line 2</label>
                <input style={s.input} value={form.address2} onChange={(e) => handleFormChange('address2', e.target.value)} />

                <div style={s.detailRow}>
                  <div>
                    <label style={s.fieldLabel}>City</label>
                    <input style={s.input} value={form.city} onChange={(e) => handleFormChange('city', e.target.value)} />
                  </div>
                  <div>
                    <label style={s.fieldLabel}>Postcode</label>
                    <input style={s.input} value={form.postcode} onChange={(e) => handleFormChange('postcode', e.target.value)} />
                  </div>
                </div>

                <label style={s.fieldLabel}>Notes</label>
                <textarea style={s.textarea} value={form.notes} onChange={(e) => handleFormChange('notes', e.target.value)} />

                <button type="submit" style={s.submitBtn}>
                  Save Customer
                </button>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  )
}
