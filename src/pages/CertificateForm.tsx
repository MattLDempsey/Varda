import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileCheck, Save } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useTheme } from '../theme/ThemeContext'
import { useData } from '../data/DataContext'
import {
  generateEIC,
  generateMEIWC,
  generateEICR,
  generateCertNumber,
  settingsToCertBusinessInfo,
} from '../lib/cert-generator'

type CertType = 'EIC' | 'MEIWC' | 'EICR'

const CERT_LABELS: Record<CertType, string> = {
  EIC: 'Electrical Installation Certificate',
  MEIWC: 'Minor Electrical Installation Works Certificate',
  EICR: 'Electrical Installation Condition Report',
}

export default function CertificateForm() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { C } = useTheme()
  const { jobs, customers, settings, updateJob } = useData()

  const job = jobs.find(j => j.id === jobId)
  const customer = job ? customers.find(c => c.id === job.customerId) : undefined

  // Form state
  const [certType, setCertType] = useState<CertType>('EIC')
  const [certNumber, setCertNumber] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [description, setDescription] = useState('')
  const [completionDate, setCompletionDate] = useState('')
  const [circuitDetails, setCircuitDetails] = useState('')
  const [designedBy, setDesignedBy] = useState('')
  const [installedBy, setInstalledBy] = useState('')
  const [inspectedBy, setInspectedBy] = useState('')
  const [observations, setObservations] = useState('')
  const [overallCondition, setOverallCondition] = useState<'Satisfactory' | 'Unsatisfactory'>('Satisfactory')
  const [nextInspectionDate, setNextInspectionDate] = useState('')
  const [saved, setSaved] = useState(false)

  // Pre-populate from job & customer
  useEffect(() => {
    if (job) {
      setDescription(job.jobType === 'TBC' ? '' : job.jobType)
      setCompletionDate(job.date)
      // Auto-select cert type based on job type
      const jt = job.jobType.toLowerCase()
      if (jt.includes('eicr') || jt.includes('condition report') || jt.includes('inspection')) {
        setCertType('EICR')
      } else if (jt.includes('minor') || jt.includes('lighting') || jt.includes('smoke') || jt.includes('socket')) {
        setCertType('MEIWC')
      } else {
        setCertType('EIC')
      }
    }
    if (customer) {
      setCustomerName(customer.name)
      setCustomerAddress(
        [customer.address1, customer.address2, customer.city, customer.postcode]
          .filter(Boolean)
          .join(', ')
      )
    }
    // Default tester name from settings
    setDesignedBy(settings.business.ownerName)
    setInstalledBy(settings.business.ownerName)
    setInspectedBy(settings.business.ownerName)
  }, [job, customer, settings.business.ownerName])

  // Generate cert number on mount
  useEffect(() => {
    setCertNumber(generateCertNumber('CERT'))
  }, [])

  const handleGenerate = () => {
    const business = settingsToCertBusinessInfo(settings)
    const cust = { name: customerName, address: customerAddress }
    const jobInfo = { description, date: completionDate }

    switch (certType) {
      case 'EIC':
        generateEIC({ business, customer: cust, job: jobInfo, certNumber, circuitDetails, designedBy, installedBy, inspectedBy })
        break
      case 'MEIWC':
        generateMEIWC({ business, customer: cust, job: jobInfo, certNumber, circuitDetails, installedBy, inspectedBy })
        break
      case 'EICR':
        generateEICR({ business, customer: cust, job: jobInfo, certNumber, circuitDetails, inspectedBy, observations, overallCondition, nextInspectionDate: nextInspectionDate || undefined })
        break
    }
  }

  const handleSaveDraft = () => {
    if (!job) return
    const draftData = JSON.stringify({
      certType, certNumber, customerName, customerAddress, description, completionDate,
      circuitDetails, designedBy, installedBy, inspectedBy, observations, overallCondition, nextInspectionDate,
    })
    const existingNotes = job.notes || ''
    const certMarker = '[CERT_DRAFT]'
    const newNotes = existingNotes.includes(certMarker)
      ? existingNotes.replace(/\[CERT_DRAFT\].*?\[\/CERT_DRAFT\]/s, `${certMarker}${draftData}[/CERT_DRAFT]`)
      : `${existingNotes}\n${certMarker}${draftData}[/CERT_DRAFT]`
    updateJob(job.id, { notes: newNotes.trim() })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  /* ── Styles ── */
  const s: Record<string, CSSProperties> = {
    page: { padding: '24px 28px 80px', maxWidth: 720, margin: '0 auto' },
    header: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 },
    backBtn: {
      background: 'transparent', border: 'none', color: C.silver, cursor: 'pointer',
      padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 8, minWidth: 40, minHeight: 40,
    },
    title: { fontSize: 22, fontWeight: 700, color: C.white, fontFamily: "'Cinzel', serif" },
    subtitle: { fontSize: 13, color: C.silver, marginTop: 2 },
    card: {
      background: C.charcoal, borderRadius: 14, border: `1px solid ${C.steel}22`,
      padding: 20, marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 13, fontWeight: 700, color: C.gold, textTransform: 'uppercase' as const,
      letterSpacing: 1, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8,
    },
    fieldGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
    fieldFull: { gridColumn: '1 / -1' },
    label: { fontSize: 11, fontWeight: 600, color: C.steel, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 4, display: 'block' },
    input: {
      width: '100%', padding: '10px 14px', borderRadius: 10,
      background: C.black, border: `1px solid ${C.steel}33`,
      color: C.white, fontSize: 14, outline: 'none',
      boxSizing: 'border-box' as const,
    },
    select: {
      width: '100%', padding: '10px 14px', borderRadius: 10,
      background: C.black, border: `1px solid ${C.steel}33`,
      color: C.white, fontSize: 14, outline: 'none',
      cursor: 'pointer', appearance: 'none' as const,
      boxSizing: 'border-box' as const,
    },
    textarea: {
      width: '100%', padding: '10px 14px', borderRadius: 10,
      background: C.black, border: `1px solid ${C.steel}33`,
      color: C.white, fontSize: 14, outline: 'none',
      fontFamily: 'inherit', resize: 'vertical' as const, minHeight: 80,
      boxSizing: 'border-box' as const,
    },
    typeSelector: { display: 'flex', gap: 8, marginBottom: 14 },
    typeBtn: {
      flex: 1, padding: '10px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600,
      cursor: 'pointer', textAlign: 'center' as const, lineHeight: 1.3,
      minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    btnRow: { display: 'flex', gap: 10, marginTop: 8 },
    primaryBtn: {
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      padding: '12px 20px', borderRadius: 12, fontSize: 14, fontWeight: 600,
      cursor: 'pointer', minHeight: 48, background: C.gold, color: C.black, border: 'none',
    },
    secondaryBtn: {
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      padding: '12px 20px', borderRadius: 12, fontSize: 14, fontWeight: 500,
      cursor: 'pointer', minHeight: 48,
      background: 'transparent', color: C.silver, border: `1px solid ${C.steel}33`,
    },
    savedMsg: {
      fontSize: 13, color: '#6ABF8A', padding: '8px 14px', borderRadius: 8,
      background: '#6ABF8A11', textAlign: 'center' as const, marginTop: 8,
    },
    noJob: {
      textAlign: 'center' as const, padding: '60px 20px', color: C.silver, fontSize: 15,
    },
  }

  if (!job) {
    return (
      <div style={s.page}>
        <div style={s.header}>
          <button style={s.backBtn} onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
          <div><div style={s.title}>Certificate</div></div>
        </div>
        <div style={s.noJob}>Job not found. Please navigate here from the Jobs page.</div>
      </div>
    )
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
        <div>
          <div style={s.title}>Certificate</div>
          <div style={s.subtitle}>{job.customerName} &mdash; {job.jobType}</div>
        </div>
      </div>

      {/* Certificate Type */}
      <div style={s.card}>
        <div style={s.sectionTitle}>Certificate Type</div>
        <div style={s.typeSelector}>
          {(['EIC', 'MEIWC', 'EICR'] as CertType[]).map(t => (
            <button
              key={t}
              onClick={() => setCertType(t)}
              style={{
                ...s.typeBtn,
                border: `1px solid ${certType === t ? C.gold + '66' : C.steel + '33'}`,
                background: certType === t ? C.gold + '15' : 'transparent',
                color: certType === t ? C.gold : C.steel,
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 13, color: C.silver, padding: '0 4px' }}>{CERT_LABELS[certType]}</div>
      </div>

      {/* Customer & Job Info */}
      <div style={s.card}>
        <div style={s.sectionTitle}>Customer &amp; Installation</div>
        <div style={s.fieldGrid}>
          <div>
            <label style={s.label}>Customer Name</label>
            <input style={s.input} value={customerName} onChange={e => setCustomerName(e.target.value)} />
          </div>
          <div>
            <label style={s.label}>Certificate Number</label>
            <input style={s.input} value={certNumber} onChange={e => setCertNumber(e.target.value)} />
          </div>
          <div style={s.fieldFull}>
            <label style={s.label}>Installation Address</label>
            <input style={s.input} value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} />
          </div>
          <div style={s.fieldFull}>
            <label style={s.label}>Description of Work</label>
            <input style={s.input} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div>
            <label style={s.label}>Date of Completion</label>
            <input type="date" style={{ ...s.input, colorScheme: 'dark' }} value={completionDate} onChange={e => setCompletionDate(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Personnel */}
      <div style={s.card}>
        <div style={s.sectionTitle}>Personnel</div>
        <div style={s.fieldGrid}>
          {certType === 'EIC' && (
            <div>
              <label style={s.label}>Designed By</label>
              <input style={s.input} value={designedBy} onChange={e => setDesignedBy(e.target.value)} />
            </div>
          )}
          {certType !== 'EICR' && (
            <div>
              <label style={s.label}>Installed By</label>
              <input style={s.input} value={installedBy} onChange={e => setInstalledBy(e.target.value)} />
            </div>
          )}
          <div>
            <label style={s.label}>Inspected &amp; Tested By</label>
            <input style={s.input} value={inspectedBy} onChange={e => setInspectedBy(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Circuit Details */}
      <div style={s.card}>
        <div style={s.sectionTitle}>Technical Details</div>
        <div>
          <label style={s.label}>Circuit Details / Schedule</label>
          <textarea
            style={s.textarea}
            value={circuitDetails}
            onChange={e => setCircuitDetails(e.target.value)}
            placeholder="e.g. Circuit 1: Ring final — Kitchen sockets, Circuit 2: Radial — Lighting ground floor..."
          />
        </div>

        {/* EICR-specific fields */}
        {certType === 'EICR' && (
          <>
            <div style={{ marginTop: 12 }}>
              <label style={s.label}>Observations &amp; Recommendations</label>
              <textarea
                style={s.textarea}
                value={observations}
                onChange={e => setObservations(e.target.value)}
                placeholder="List any observations, code references (C1, C2, C3, FI)..."
              />
            </div>
            <div style={{ ...s.fieldGrid, marginTop: 12 }}>
              <div>
                <label style={s.label}>Overall Condition</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['Satisfactory', 'Unsatisfactory'] as const).map(c => (
                    <button
                      key={c}
                      onClick={() => setOverallCondition(c)}
                      style={{
                        flex: 1, padding: '8px 8px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                        cursor: 'pointer',
                        border: `1px solid ${overallCondition === c ? (c === 'Satisfactory' ? '#6ABF8A66' : '#D46A6A66') : C.steel + '33'}`,
                        background: overallCondition === c ? (c === 'Satisfactory' ? '#6ABF8A15' : '#D46A6A15') : 'transparent',
                        color: overallCondition === c ? (c === 'Satisfactory' ? '#6ABF8A' : '#D46A6A') : C.steel,
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={s.label}>Next Inspection Date</label>
                <input type="date" style={{ ...s.input, colorScheme: 'dark' }} value={nextInspectionDate} onChange={e => setNextInspectionDate(e.target.value)} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div style={s.btnRow}>
        <button style={s.secondaryBtn} onClick={handleSaveDraft}>
          <Save size={16} /> Save Draft
        </button>
        <button style={s.primaryBtn} onClick={handleGenerate}>
          <FileCheck size={16} /> Generate Certificate
        </button>
      </div>

      {saved && <div style={s.savedMsg}>Draft saved to job notes</div>}
    </div>
  )
}
