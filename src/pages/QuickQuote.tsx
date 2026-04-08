import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle, FileDown, Plus, Trash2, Lock, MapPin, ChevronDown } from 'lucide-react'
import { useData } from '../data/DataContext'
import { useAuth } from '../auth/AuthContext'
import { useSubscription } from '../subscription/SubscriptionContext'
import { generateQuotePDF, settingsToBusinessInfo } from '../lib/pdf-generator'
import { validateEmail, validatePhone } from '../lib/validation'
import { sendEmail } from '../lib/send-email'
import { buildQuoteEmail } from '../lib/email-templates'
import PricingSuggestion from '../components/PricingSuggestion'
import { estimateDistance, getDistanceHassleAdjustment } from '../lib/postcode-distance'
import './QuickQuote.css'

/* ──────────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────────── */

interface LineItem {
  id: number
  jobTypeId: string
  jobTypeName: string
  quantity: number
  difficulty: number
  hassleFactor: number
  emergency: boolean
  outOfHours: boolean
  certRequired: boolean
  customerSuppliesMaterials: boolean
  // calculated
  materials: number
  labour: number
  certificates: number
  waste: number
  adjustments: number
  lineTotal: number
  estHours: number
}

/* ──────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────── */

function fmt(n: number): string {
  return n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function AnimatedValue({ value, prefix = '' }: { value: number; prefix?: string }) {
  const [flash, setFlash] = useState(false)
  const prev = useRef(value)
  useEffect(() => {
    if (prev.current !== value) {
      setFlash(true)
      prev.current = value
      const timer = setTimeout(() => setFlash(false), 350)
      return () => clearTimeout(timer)
    }
  }, [value])
  return (
    <span className={flash ? 'qq-breakdown__value qq-breakdown__value--flash' : 'qq-breakdown__value'}>
      {prefix}{fmt(value)}
    </span>
  )
}

/* ──────────────────────────────────────────────────────
   Component
   ────────────────────────────────────────────────────── */

let nextLineId = 1

export default function QuickQuote() {
  const { addQuote, updateQuote, updateJob, moveJob, addJob, addCustomer, quotes, jobs, customers, settings, getNextQuoteRef, pricingConfig, jobTypeConfigs } = useData()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { canUse } = useSubscription()
  const canMultiLine = canUse('multiLineQuotes')

  // ── Pricing engine (uses DataContext values) ──
  const calculateLine = useCallback((
    jobTypeId: string, quantity: number, difficulty: number, hassleFactor: number,
    emergency: boolean, outOfHours: boolean, certRequired: boolean, customerSuppliesMaterials: boolean,
    manualMaterials?: number, manualHours?: number,
  ): Omit<LineItem, 'id' | 'jobTypeId' | 'jobTypeName' | 'quantity' | 'difficulty' | 'hassleFactor' | 'emergency' | 'outOfHours' | 'certRequired' | 'customerSuppliesMaterials'> => {
    const jobType = jobTypeConfigs.find(j => j.id === jobTypeId)
    if (!jobType) return { materials: 0, labour: 0, certificates: 0, waste: 0, adjustments: 0, lineTotal: 0, estHours: 0 }

    const isManual = jobTypeId === 'other'
    const qty = quantity
    const baseMat = isManual ? (manualMaterials || 0) : jobType.baseMaterialCost
    const baseHrs = isManual ? (manualHours || 1) : jobType.baseHours
    const materials = customerSuppliesMaterials ? 0 : baseMat * qty
    const hours = baseHrs * qty
    const labour = hours * pricingConfig.labourRate
    const certificates = certRequired ? pricingConfig.certFee : 0
    const waste = materials * pricingConfig.wastePct
    const subtotal = materials + labour + certificates + waste

    const diffMult = 1 + (difficulty / 100) * 0.5
    const hassleMult = 1 + (hassleFactor / 100) * 0.3
    const emergencyMult = emergency ? pricingConfig.emergencyMult : 1
    const oohMult = outOfHours ? pricingConfig.outOfHoursMult : 1

    const adjustments = subtotal * (diffMult - 1) + subtotal * (hassleMult - 1) + subtotal * (emergencyMult - 1) + subtotal * (oohMult - 1)
    let lineTotal = subtotal + adjustments

    if (jobType.minCharge && lineTotal < jobType.minCharge) lineTotal = jobType.minCharge
    if (emergency && lineTotal < pricingConfig.emergencyMinCharge) lineTotal = pricingConfig.emergencyMinCharge

    return { materials, labour, certificates, waste, adjustments, lineTotal, estHours: hours }
  }, [pricingConfig, jobTypeConfigs])
  const [searchParams] = useSearchParams()
  const editQuoteId = searchParams.get('quoteId')
  const editJobId = searchParams.get('jobId')
  const duplicateFromId = searchParams.get('duplicateFrom')
  const existingQuote = editQuoteId ? quotes.find(q => q.id === editQuoteId) : undefined
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const existingJob = editJobId ? jobs.find(j => j.id === editJobId) : undefined
  const duplicateSource = duplicateFromId ? quotes.find(q => q.id === duplicateFromId) : undefined

  // ── Quote-level state ──
  const [customerName, setCustomerName] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [isEmergency, setIsEmergency] = useState(false)
  const [isOutOfHours, setIsOutOfHours] = useState(false)
  const [lines, setLines] = useState<LineItem[]>([])
  const [savedMsg, setSavedMsg] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const recognitionRef = useRef<any>(null)
  const [loaded, setLoaded] = useState(false)
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(editQuoteId)
  const [activeJobId, setActiveJobId] = useState<string | null>(editJobId)
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [showSendModal, setShowSendModal] = useState(false)
  const [sendMsg, setSendMsg] = useState('')
  const [sendVia, setSendVia] = useState<{ email: boolean; whatsapp: boolean; link: boolean }>({ email: false, whatsapp: false, link: false })
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newCustPhone, setNewCustPhone] = useState('')
  const [newCustEmail, setNewCustEmail] = useState('')
  const [newCustPostcode, setNewCustPostcode] = useState('')
  const [newCustErrors, setNewCustErrors] = useState<Record<string, string>>({})
  // Collapsible sections — customer collapses once selected, notes starts collapsed
  const [sectionsOpen, setSectionsOpen] = useState({ customer: true, notes: false })

  // ── Job site postcode & distance pricing ──
  const [jobPostcode, setJobPostcode] = useState('')
  const [distanceMiles, setDistanceMiles] = useState<number | null>(null)
  const [distanceHassleAdj, setDistanceHassleAdj] = useState(0)
  const [hassleManuallyOverridden, setHassleManuallyOverridden] = useState(false)

  // ── Current line being built ──
  const [curJobTypeId, setCurJobTypeId] = useState('')
  const [curQuantity, setCurQuantity] = useState(1)
  const [curDifficulty, setCurDifficulty] = useState(25)
  const [curHassle, setCurHassle] = useState(15)
  const [curCert, setCurCert] = useState(false)
  const [curCustMaterials, setCurCustMaterials] = useState(false)
  const [curManualMaterials, setCurManualMaterials] = useState(0)
  const [curManualHours, setCurManualHours] = useState(1)

  // ── Auto-add timer ──
  const autoAddTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [autoAddCountdown, setAutoAddCountdown] = useState<number | null>(null)
  const [autoAddedMsg, setAutoAddedMsg] = useState(false)
  const autoAddCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Load existing quote ──
  useEffect(() => {
    if (existingQuote && !loaded) {
      setCustomerName(existingQuote.customerName)
      setDescription(existingQuote.description)
      setNotes(existingQuote.notes)
      setIsEmergency(existingQuote.emergency)
      setIsOutOfHours(existingQuote.outOfHours)
      // Load as a single line (legacy quotes are single-line)
      const calc = calculateLine(
        existingQuote.jobTypeId, existingQuote.quantity, existingQuote.difficulty,
        existingQuote.hassleFactor, existingQuote.emergency, existingQuote.outOfHours,
        existingQuote.certRequired, existingQuote.customerSuppliesMaterials,
      )
      setLines([{
        id: nextLineId++,
        jobTypeId: existingQuote.jobTypeId,
        jobTypeName: existingQuote.jobTypeName,
        quantity: existingQuote.quantity,
        difficulty: existingQuote.difficulty,
        hassleFactor: existingQuote.hassleFactor,
        emergency: existingQuote.emergency,
        outOfHours: existingQuote.outOfHours,
        certRequired: existingQuote.certRequired,
        customerSuppliesMaterials: existingQuote.customerSuppliesMaterials,
        ...calc,
      }])
      setLoaded(true)
    }
  }, [existingQuote, loaded])

  // ── Load duplicate source (pre-fill form but create a NEW quote) ──
  useEffect(() => {
    if (duplicateSource && !loaded && !editQuoteId) {
      setCustomerName(duplicateSource.customerName)
      setSelectedCustomerId(duplicateSource.customerId || null)
      setDescription(duplicateSource.description)
      setNotes(duplicateSource.notes)
      setIsEmergency(duplicateSource.emergency)
      setIsOutOfHours(duplicateSource.outOfHours)
      const calc = calculateLine(
        duplicateSource.jobTypeId, duplicateSource.quantity, duplicateSource.difficulty,
        duplicateSource.hassleFactor, duplicateSource.emergency, duplicateSource.outOfHours,
        duplicateSource.certRequired, duplicateSource.customerSuppliesMaterials,
      )
      setLines([{
        id: nextLineId++,
        jobTypeId: duplicateSource.jobTypeId,
        jobTypeName: duplicateSource.jobTypeName,
        quantity: duplicateSource.quantity,
        difficulty: duplicateSource.difficulty,
        hassleFactor: duplicateSource.hassleFactor,
        emergency: duplicateSource.emergency,
        outOfHours: duplicateSource.outOfHours,
        certRequired: duplicateSource.certRequired,
        customerSuppliesMaterials: duplicateSource.customerSuppliesMaterials,
        ...calc,
      }])
      // Do NOT set activeQuoteId — this creates a fresh quote
      setLoaded(true)
    }
  }, [duplicateSource, loaded, editQuoteId])

  // ── Pre-fill customer from URL param ──
  const customerParam = searchParams.get('customer')
  useEffect(() => {
    if (customerParam && !loaded && !editQuoteId && !duplicateFromId) {
      setCustomerName(customerParam)
      const match = customers.find(c => c.name.toLowerCase() === customerParam.toLowerCase())
      if (match) setSelectedCustomerId(match.id)
    }
  }, [customerParam, loaded, editQuoteId, duplicateFromId, customers])

  // ── Auto-set cert when job type changes ──
  const handleJobTypeSelect = useCallback((id: string) => {
    setCurJobTypeId(id)
    const jt = jobTypeConfigs.find(j => j.id === id)
    if (jt) setCurCert(jt.certRequired)
  }, [jobTypeConfigs])

  // ── Auto-add helpers ──
  const clearAutoAdd = useCallback(() => {
    if (autoAddTimerRef.current) { clearTimeout(autoAddTimerRef.current); autoAddTimerRef.current = null }
    if (autoAddCountdownRef.current) { clearInterval(autoAddCountdownRef.current); autoAddCountdownRef.current = null }
    setAutoAddCountdown(null)
  }, [])

  // ── Add current line to quote ──
  const addLine = useCallback(() => {
    clearAutoAdd()
    const jt = jobTypeConfigs.find(j => j.id === curJobTypeId)
    if (!jt) return

    const calc = calculateLine(curJobTypeId, curQuantity, curDifficulty, curHassle, isEmergency, isOutOfHours, curCert, curCustMaterials, curManualMaterials, curManualHours)
    setLines(prev => [...prev, {
      id: nextLineId++,
      jobTypeId: curJobTypeId,
      jobTypeName: curJobTypeId === 'other' ? 'Other' : jt.name,
      quantity: curQuantity,
      difficulty: curDifficulty,
      hassleFactor: curHassle,
      emergency: isEmergency,
      outOfHours: isOutOfHours,
      certRequired: curCert,
      customerSuppliesMaterials: curCustMaterials,
      ...calc,
    }])

    // Reset form for next line
    setCurJobTypeId('')
    setCurQuantity(1)
    setCurDifficulty(25)
    setCurHassle(15)
    setCurCert(false)
    setCurCustMaterials(false)
    setCurManualMaterials(0)
    setCurManualHours(1)
  }, [curJobTypeId, curQuantity, curDifficulty, curHassle, isEmergency, isOutOfHours, curCert, curCustMaterials, curManualMaterials, curManualHours, calculateLine, jobTypeConfigs, clearAutoAdd])

  // ── Wire auto-add timer: start when job type selected, clear/restart on config changes ──
  const addLineRef = useRef(addLine)
  addLineRef.current = addLine

  useEffect(() => {
    if (curJobTypeId) {
      // Start auto-add countdown
      clearAutoAdd()
      setAutoAddedMsg(false)
      setAutoAddCountdown(3)
      autoAddCountdownRef.current = setInterval(() => {
        setAutoAddCountdown(prev => (prev !== null && prev > 1) ? prev - 1 : prev)
      }, 1000)
      autoAddTimerRef.current = setTimeout(() => {
        if (autoAddCountdownRef.current) { clearInterval(autoAddCountdownRef.current); autoAddCountdownRef.current = null }
        setAutoAddCountdown(null)
        addLineRef.current()
        setAutoAddedMsg(true)
        setTimeout(() => setAutoAddedMsg(false), 1500)
      }, 3000)
    } else {
      clearAutoAdd()
    }
    return () => clearAutoAdd()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curJobTypeId, curQuantity, curDifficulty, curHassle, curCert, curCustMaterials, curManualMaterials, curManualHours])

  const removeLine = useCallback((id: number) => {
    setLines(prev => prev.filter(l => l.id !== id))
  }, [])

  // ── Combined totals ──
  const totals = useMemo(() => {
    const materials = lines.reduce((s, l) => s + l.materials, 0)
    const labour = lines.reduce((s, l) => s + l.labour, 0)
    const certificates = lines.reduce((s, l) => s + l.certificates, 0)
    const waste = lines.reduce((s, l) => s + l.waste, 0)
    const adjustments = lines.reduce((s, l) => s + l.adjustments, 0)
    const netTotal = lines.reduce((s, l) => s + l.lineTotal, 0)
    const vat = netTotal * pricingConfig.vatRate
    const grandTotal = netTotal + vat
    const estHours = lines.reduce((s, l) => s + l.estHours, 0)
    const margin = netTotal > 0 ? ((netTotal - materials) / netTotal) * 100 : 0
    const dayRate = estHours > 0 ? (netTotal / estHours) * 8 : 0
    return { materials, labour, certificates, waste, adjustments, netTotal, vat, grandTotal, estHours, margin, dayRate }
  }, [lines])

  // ── Recalculate all lines when emergency/OOH changes ──
  const prevEmergency = useRef(isEmergency)
  const prevOOH = useRef(isOutOfHours)
  useEffect(() => {
    if (prevEmergency.current !== isEmergency || prevOOH.current !== isOutOfHours) {
      prevEmergency.current = isEmergency
      prevOOH.current = isOutOfHours
      if (lines.length > 0) {
        setLines(prev => prev.map(l => {
          const calc = calculateLine(l.jobTypeId, l.quantity, l.difficulty, l.hassleFactor, isEmergency, isOutOfHours, l.certRequired, l.customerSuppliesMaterials)
          return { ...l, ...calc, emergency: isEmergency, outOfHours: isOutOfHours }
        }))
      }
    }
  }, [isEmergency, isOutOfHours, lines.length])

  // ── Current line preview ──
  const curPreview = useMemo(() => {
    if (!curJobTypeId) return null
    return calculateLine(curJobTypeId, curQuantity, curDifficulty, curHassle, isEmergency, isOutOfHours, curCert, curCustMaterials, curManualMaterials, curManualHours)
  }, [curJobTypeId, curQuantity, curDifficulty, curHassle, isEmergency, isOutOfHours, curCert, curCustMaterials, curManualMaterials, curManualHours, calculateLine])

  // ── Grand total including current unsaved line ──
  const grandWithPreview = totals.grandTotal + (curPreview ? (curPreview.lineTotal * (1 + pricingConfig.vatRate)) : 0)

  // ── Flash on total change ──
  const [totalFlash, setTotalFlash] = useState(false)
  const prevTotal = useRef(grandWithPreview)
  useEffect(() => {
    if (prevTotal.current !== grandWithPreview) {
      setTotalFlash(true)
      prevTotal.current = grandWithPreview
      const timer = setTimeout(() => setTotalFlash(false), 400)
      return () => clearTimeout(timer)
    }
  }, [grandWithPreview])

  // ── Voice Input ──
  const toggleVoice = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('Speech recognition not supported.'); return }
    if (isRecording && recognitionRef.current) { recognitionRef.current.stop(); setIsRecording(false); return }
    const recognition = new SR()
    recognition.lang = 'en-GB'; recognition.continuous = true; recognition.interimResults = false
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results as any).map((r: any) => r[0].transcript).join(' ')
      setNotes(prev => (prev ? prev + ' ' : '') + transcript)
    }
    recognition.onerror = () => setIsRecording(false)
    recognition.onend = () => setIsRecording(false)
    recognitionRef.current = recognition; recognition.start(); setIsRecording(true)
  }, [isRecording])

  // ── Save helpers ──
  const buildQuoteData = () => {
    const customer = selectedCustomerId ? customers.find(c => c.id === selectedCustomerId) : customers.find(c => c.name.toLowerCase().includes(customerName.toLowerCase()))
    // For the data model, use first line as primary job type (multi-line stored in description)
    const primaryLine = lines[0]
    const allJobNames = lines.map(l => `${l.jobTypeName}${l.quantity > 1 ? ` x${l.quantity}` : ''}`).join(' + ')
    return {
      customerId: customer?.id || '',
      customerName: customerName || 'Walk-in',
      jobTypeId: primaryLine?.jobTypeId || '',
      jobTypeName: allJobNames || '',
      description,
      quantity: 1,
      difficulty: primaryLine?.difficulty || 25,
      hassleFactor: primaryLine?.hassleFactor || 15,
      emergency: lines.some(l => l.emergency),
      outOfHours: lines.some(l => l.outOfHours),
      certRequired: lines.some(l => l.certRequired),
      customerSuppliesMaterials: lines.every(l => l.customerSuppliesMaterials),
      notes,
      materials: totals.materials,
      labour: totals.labour,
      certificates: totals.certificates,
      waste: totals.waste,
      subtotal: totals.netTotal,
      adjustments: totals.adjustments,
      netTotal: totals.netTotal,
      vat: totals.vat,
      grandTotal: totals.grandTotal,
      margin: totals.margin,
      estHours: totals.estHours,
      jobPostcode: jobPostcode.trim() || undefined,
      distanceMiles: distanceMiles ?? undefined,
    }
  }

  // ── Auto-save: debounced to avoid infinite loops ──
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeQuoteIdRef = useRef(activeQuoteId)
  const activeJobIdRef = useRef(activeJobId)
  activeQuoteIdRef.current = activeQuoteId
  activeJobIdRef.current = activeJobId

  const triggerAutoSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      if (!customerName && lines.length === 0) return
      const data = buildQuoteData()

      if (activeQuoteIdRef.current) {
        updateQuote(activeQuoteIdRef.current, data)
        if (activeJobIdRef.current) {
          updateJob(activeJobIdRef.current, {
            customerId: data.customerId,
            customerName: data.customerName,
            jobType: data.jobTypeName || 'TBC',
            value: Math.round(data.netTotal),
            estimatedHours: data.estHours,
            notes: data.description,
          })
        }
      } else {
        // Always starts as Lead — moves to Quoted only when sent
        const q = addQuote(data)
        if (q && q.id) {
          const j = addJob({
            customerId: data.customerId,
            customerName: data.customerName || 'Unknown',
            quoteId: q.id,
            jobType: data.jobTypeName || 'TBC',
            value: Math.round(data.netTotal),
            estimatedHours: data.estHours,
            status: 'Lead',
            date: new Date().toISOString().split('T')[0],
            notes: data.description,
          })
          setActiveQuoteId(q.id)
          if (j && j.id) setActiveJobId(j.id)
        }
      }
    }, 800)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, customerName, description, notes, totals, isEmergency, isOutOfHours])

  // Trigger auto-save when customer name, lines, or key fields change
  const prevLinesLen = useRef(lines.length)
  const prevCustomer = useRef(customerName)
  const prevDesc = useRef(description)
  const prevNotes = useRef(notes)
  useEffect(() => {
    const changed = lines.length !== prevLinesLen.current
      || customerName !== prevCustomer.current
      || description !== prevDesc.current
      || notes !== prevNotes.current
    prevLinesLen.current = lines.length
    prevCustomer.current = customerName
    prevDesc.current = description
    prevNotes.current = notes
    // Save when we have a customer name OR lines
    // Only auto-save when we have lines (not just a partial name)
    if (changed && lines.length > 0) triggerAutoSave()
  }, [lines.length, customerName, description, notes, isEmergency, isOutOfHours, triggerAutoSave])

  const activeQuote = activeQuoteId ? quotes.find(q => q.id === activeQuoteId) : undefined
  const selectedCustomer = selectedCustomerId ? customers.find(c => c.id === selectedCustomerId) : undefined

  // ── Inherit postcode from selected customer ──
  useEffect(() => {
    if (selectedCustomer?.postcode && !jobPostcode) {
      setJobPostcode(selectedCustomer.postcode)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomerId])

  // ── Calculate distance when job postcode or base postcode changes ──
  useEffect(() => {
    const basePostcode = settings.business.postcode
    if (!basePostcode || !jobPostcode || jobPostcode.trim().length < 2) {
      setDistanceMiles(null)
      setDistanceHassleAdj(0)
      return
    }
    const dist = estimateDistance(basePostcode, jobPostcode)
    setDistanceMiles(dist)
    const adj = dist !== null ? getDistanceHassleAdjustment(dist) : 0
    setDistanceHassleAdj(adj)
    // Auto-adjust hassle slider if not manually overridden
    if (!hassleManuallyOverridden && adj > 0) {
      setCurHassle(prev => {
        // Strip any previous distance adjustment, then add new one
        const base = Math.max(0, prev - distanceHassleAdj)
        return Math.min(100, base + adj)
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobPostcode, settings.business.postcode])

  // ── Customer search matches ──
  const customerMatches = useMemo(() => {
    if (!customerName || customerName.length < 2) return []
    const term = customerName.toLowerCase()
    return customers.filter(c =>
      c.name.toLowerCase().includes(term) ||
      c.postcode.toLowerCase().includes(term) ||
      c.phone.includes(term)
    ).slice(0, 6)
  }, [customerName, customers])

  const hasLines = lines.length > 0
  const hasJobSelected = !!jobTypeConfigs.find(j => j.id === curJobTypeId)

  // ── Render ──
  return (
    <div className="qq-page">
      {/* ─── LEFT PANEL: Build Quote ─────────────────── */}
      <div className="qq-panel">

        {/* ── SECTION 1: Customer & Job Info (collapsible) ── */}
        <div className="qq-section">
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: sectionsOpen.customer ? 12 : 0 }}
          onClick={() => setSectionsOpen(p => ({ ...p, customer: !p.customer }))}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="qq-section-header" style={{ marginBottom: 0 }}>Customer & Job</span>
            {!sectionsOpen.customer && selectedCustomer && (
              <span style={{ fontSize: 12, color: 'var(--color-silver)', fontWeight: 400 }}>— {selectedCustomer.name}</span>
            )}
          </div>
          <ChevronDown size={16} style={{ color: 'var(--color-steel)', transition: 'transform .2s', transform: sectionsOpen.customer ? 'rotate(0)' : 'rotate(-90deg)' }} />
        </div>
        {sectionsOpen.customer && <>
        {/* Customer search */}
        <div className="qq-field" style={{ position: 'relative' }}>
          <span className="qq-label">Customer</span>
          <input
            className="qq-input"
            type="text"
            placeholder="Search by name, postcode, or phone..."
            value={customerName}
            onChange={e => {
              setCustomerName(e.target.value)
              setSelectedCustomerId(null)
              setShowCustomerDropdown(true)
            }}
            onFocus={() => setShowCustomerDropdown(true)}
            onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
          />
          {/* Autocomplete dropdown */}
          {showCustomerDropdown && customerMatches.length > 0 && !selectedCustomerId && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              background: 'var(--color-charcoal)', border: '1px solid var(--color-steel)',
              borderRadius: '0 0 var(--radius-md) var(--radius-md)', overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(0,0,0,.4)',
            }}>
              {customerMatches.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={e => {
                    e.preventDefault()
                    setCustomerName(c.name)
                    setSelectedCustomerId(c.id)
                    setShowCustomerDropdown(false)
                  }}
                  style={{
                    width: '100%', display: 'flex', flexDirection: 'column', gap: 2,
                    padding: '10px 14px', background: 'transparent', border: 'none',
                    cursor: 'pointer', textAlign: 'left', transition: 'background .1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-charcoal-light)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-white)' }}>{c.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-steel-light)' }}>
                    {c.postcode}{c.city ? ` · ${c.city}` : ''}{c.phone ? ` · ${c.phone}` : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
          {/* No match — offer to create new customer */}
          {showCustomerDropdown && customerName.length >= 2 && customerMatches.length === 0 && !selectedCustomerId && !showNewCustomer && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              background: 'var(--color-charcoal)', border: '1px solid var(--color-steel)',
              borderRadius: '0 0 var(--radius-md) var(--radius-md)', overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(0,0,0,.4)',
            }}>
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); setShowNewCustomer(true); setShowCustomerDropdown(false) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '12px 14px', background: 'transparent', border: 'none',
                  cursor: 'pointer', textAlign: 'left', color: 'var(--color-gold)', fontSize: 14, fontWeight: 500,
                }}
              >
                + Add "{customerName}" as new customer
              </button>
            </div>
          )}
          {/* Selected customer info */}
          {selectedCustomer && (
            <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 12 }}>
              {selectedCustomer.postcode && (
                <span style={{ padding: '4px 10px', background: 'var(--color-black)', borderRadius: 6, color: 'var(--color-silver)' }}>
                  📍 {selectedCustomer.postcode}
                </span>
              )}
              {selectedCustomer.phone && (
                <span style={{ padding: '4px 10px', background: 'var(--color-black)', borderRadius: 6, color: 'var(--color-silver)' }}>
                  📞 {selectedCustomer.phone}
                </span>
              )}
              {selectedCustomer.email && (
                <span style={{ padding: '4px 10px', background: 'var(--color-black)', borderRadius: 6, color: 'var(--color-steel)' }}>
                  ✉ {selectedCustomer.email}
                </span>
              )}
              {selectedCustomer.city && (
                <span style={{ padding: '4px 10px', background: 'var(--color-black)', borderRadius: 6, color: 'var(--color-steel)' }}>
                  {selectedCustomer.city}
                </span>
              )}
            </div>
          )}
          {/* New customer inline form */}
          {showNewCustomer && !selectedCustomerId && (
            <div style={{
              marginTop: 6, padding: '14px', background: 'var(--color-black)',
              borderRadius: 'var(--radius-md)', border: '1px solid var(--color-steel)',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <span className="qq-label">Phone</span>
                  <input className="qq-input" type="tel" placeholder="07XXX XXX XXX" value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)} />
                </div>
                <div>
                  <span className="qq-label">Email</span>
                  <input className="qq-input" type="email" placeholder="email@example.com" value={newCustEmail} onChange={e => setNewCustEmail(e.target.value)} />
                </div>
                <div>
                  <span className="qq-label">Postcode</span>
                  <input className="qq-input" placeholder="CO3 4QR" value={newCustPostcode} onChange={e => setNewCustPostcode(e.target.value)} />
                </div>
              </div>
              {newCustErrors.email && <div style={{ fontSize: 12, color: '#D46A6A', marginTop: -8, marginBottom: 8 }}>{newCustErrors.email}</div>}
              {newCustErrors.phone && <div style={{ fontSize: 12, color: '#D46A6A', marginTop: -8, marginBottom: 8 }}>{newCustErrors.phone}</div>}
              <button
                type="button"
                className="qq-btn qq-btn--primary"
                style={{ width: '100%' }}
                onClick={() => {
                  const errs: Record<string, string> = {}
                  if (newCustEmail.trim()) {
                    const emailErr = validateEmail(newCustEmail.trim())
                    if (emailErr) errs.email = emailErr
                  }
                  if (newCustPhone.trim()) {
                    const phoneErr = validatePhone(newCustPhone.trim())
                    if (phoneErr) errs.phone = phoneErr
                  }
                  setNewCustErrors(errs)
                  if (Object.keys(errs).length > 0) return
                  const c = addCustomer({
                    name: customerName.trim(),
                    phone: newCustPhone.trim(),
                    email: newCustEmail.trim(),
                    address1: '',
                    address2: '',
                    city: '',
                    postcode: newCustPostcode.trim().toUpperCase(),
                    notes: '',
                  })
                  setSelectedCustomerId(c.id)
                  setShowNewCustomer(false)
                  setNewCustPhone('')
                  setNewCustEmail('')
                  setNewCustPostcode('')
                  setNewCustErrors({})
                  setSavedMsg('✓ Customer saved')
                  setTimeout(() => setSavedMsg(''), 2500)
                }}
              >
                Save Customer
              </button>
            </div>
          )}
        </div>

        {/* Job Site + Description in one row */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: '0 0 auto' }}>
            <span className="qq-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={12} /> Job Site
            </span>
            <input
              className="qq-input"
              type="text"
              placeholder="Postcode"
              value={jobPostcode}
              onChange={e => {
                setJobPostcode(e.target.value.toUpperCase())
                setHassleManuallyOverridden(false)
              }}
              style={{ width: 110, textTransform: 'uppercase', fontSize: 13 }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <span className="qq-label">Job Description</span>
            <input
              className="qq-input"
              type="text"
              placeholder="Brief overview of the work..."
              value={description}
            onChange={e => setDescription(e.target.value)}
          />
          </div>
        </div>
        {distanceMiles !== null && (
          <div style={{ fontSize: 11, color: 'var(--color-steel-light)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            📍 ~{distanceMiles} miles from base
            {distanceHassleAdj > 0 && (
              <span style={{ fontSize: 10, color: 'var(--color-gold)', background: 'var(--color-gold)15', padding: '1px 6px', borderRadius: 4, fontWeight: 500 }}>
                +{distanceHassleAdj} hassle
              </span>
            )}
          </div>
        )}
        </>}
        </div>{/* end qq-section: Customer & Job Info */}

        {/* ── SECTION 2: Line Items ── */}
        <div className="qq-section">
        <div className="qq-section-header">Job Details</div>

        {/* Quote-level options */}
        <div className="qq-field">
          <div className="qq-toggles-row">
            <Toggle label="Emergency" on={isEmergency} onToggle={() => setIsEmergency(!isEmergency)} />
            <Toggle label="Out of hours" on={isOutOfHours} onToggle={() => setIsOutOfHours(!isOutOfHours)} />
          </div>
        </div>

        {/* ── Added Lines ── */}
        {lines.length > 0 && (
          <div className="qq-field">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {lines.map(line => (
                <div
                  key={line.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'var(--color-black)', borderRadius: 'var(--radius-md)',
                    padding: '10px 14px', border: '1px solid var(--color-steel)',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-white)' }}>
                      {line.jobTypeName}{line.quantity > 1 ? ` x${line.quantity}` : ''}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--color-steel-light)' }}>
                      {line.estHours}h · Diff {line.difficulty} · Hassle {line.hassleFactor}
                      {line.emergency ? ' · Emergency' : ''}{line.outOfHours ? ' · OOH' : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-gold)' }}>
                      £{fmt(line.lineTotal)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      style={{
                        background: 'transparent', border: 'none', color: 'var(--color-steel)',
                        cursor: 'pointer', padding: 4, display: 'flex',
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>{/* end qq-section: Job Configuration */}

        {/* ── SECTION 3: Add Line Item ── */}
        {lines.length > 0 && !canMultiLine ? (
          <div className="qq-section">
            <div className="qq-section-header">Add Line Item</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '16px 20px', borderRadius: 10, background: 'var(--color-gold, #C6A86A)15', border: '1px solid var(--color-gold, #C6A86A)33', color: 'var(--color-gold, #C6A86A)', fontSize: 13, lineHeight: 1.5 }}>
                <Lock size={14} style={{ flexShrink: 0 }} />
                <span>Multi-line quotes require a Pro plan. <a href="/pricing" style={{ color: 'inherit', fontWeight: 600 }}>Upgrade to add more line items.</a></span>
              </div>
            </div>
          </div>
        ) : (
        <div className={`qq-section${!curJobTypeId ? ' qq-section--faded' : ''}`}>
          <div className="qq-section-header">
            {lines.length > 0 ? 'Add Another Line' : 'Add Line Item'}
          </div>

          {/* Job Type Grid */}
          <div className="qq-field">
            <div className="qq-job-grid">
              {jobTypeConfigs.map(jt => (
                <button
                  key={jt.id}
                  className={`qq-job-btn${curJobTypeId === jt.id ? ' qq-job-btn--active' : ''}`}
                  onClick={() => handleJobTypeSelect(jt.id)}
                  type="button"
                >
                  {jt.name}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity */}
          {hasJobSelected && (
            <>
              <div className="qq-qty-desc-row">
                <div className="qq-field">
                  <span className="qq-label">Qty</span>
                  <div className="qq-stepper">
                    <button className="qq-stepper__btn" onClick={() => setCurQuantity(q => Math.max(1, q - 1))} type="button">&minus;</button>
                    <span className="qq-stepper__value">{curQuantity}</span>
                    <button className="qq-stepper__btn" onClick={() => setCurQuantity(q => q + 1)} type="button">+</button>
                  </div>
                </div>
                {curPreview && (
                  <div className="qq-field" style={{ textAlign: 'right', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-gold)' }}>£{fmt(curPreview.lineTotal)}</span>
                    <span style={{ fontSize: 11, color: 'var(--color-steel-light)' }}>{curPreview.estHours}h</span>
                  </div>
                )}
              </div>

              {/* Manual pricing for "Other" */}
              {curJobTypeId === 'other' && (
                <div className="qq-qty-desc-row">
                  <div className="qq-field">
                    <span className="qq-label">Materials (£)</span>
                    <input
                      className="qq-input"
                      type="number"
                      min={0}
                      step={5}
                      value={curManualMaterials}
                      onChange={e => setCurManualMaterials(Number(e.target.value))}
                    />
                  </div>
                  <div className="qq-field">
                    <span className="qq-label">Hours</span>
                    <input
                      className="qq-input"
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={curManualHours}
                      onChange={e => setCurManualHours(Number(e.target.value))}
                    />
                  </div>
                </div>
              )}

              {/* Difficulty */}
              <div className="qq-field">
                <div className="qq-slider-wrap">
                  <div className="qq-slider-header">
                    <span className="qq-label">Difficulty</span>
                    <span className="qq-slider-value">{curDifficulty}</span>
                  </div>
                  <input className="qq-slider" type="range" min={0} max={100} value={curDifficulty} onChange={e => setCurDifficulty(Number(e.target.value))} />
                  <div className="qq-slider-labels"><span>Easy</span><span>Hard</span></div>
                </div>
              </div>

              {/* Hassle */}
              <div className="qq-field">
                <div className="qq-slider-wrap">
                  <div className="qq-slider-header">
                    <span className="qq-label">Hassle Factor</span>
                    <span className="qq-slider-value">{curHassle}</span>
                  </div>
                  <input className="qq-slider" type="range" min={0} max={100} value={curHassle} onChange={e => { setCurHassle(Number(e.target.value)); setHassleManuallyOverridden(true) }} />
                  <div className="qq-slider-labels"><span>Straightforward</span><span>Complex</span></div>
                </div>
              </div>

              {/* Toggles */}
              <div className="qq-field">
                <span className="qq-label">Options</span>
                <div className="qq-toggles-row">
                  <Toggle label="Certificate" on={curCert} onToggle={() => setCurCert(!curCert)} />
                  <Toggle label="Customer materials" on={curCustMaterials} onToggle={() => setCurCustMaterials(!curCustMaterials)} />
                </div>
              </div>

              {/* Add Line Button */}
              <div style={{ position: 'relative' }}>
                <button
                  className="qq-btn qq-btn--primary"
                  type="button"
                  onClick={() => { clearAutoAdd(); addLine() }}
                  style={{ width: '100%', marginTop: 4 }}
                >
                  {autoAddedMsg ? (
                    <><CheckCircle size={18} style={{ marginRight: 6 }} /> Added</>
                  ) : (
                    <><Plus size={18} style={{ marginRight: 6 }} /> Add {jobTypeConfigs.find(j => j.id === curJobTypeId)?.name || 'Line'}</>
                  )}
                </button>
                {autoAddCountdown !== null && (
                  <div style={{
                    textAlign: 'center', fontSize: 11, color: 'var(--color-steel-light)',
                    marginTop: 4, opacity: 0.7, transition: 'opacity .3s',
                  }}>
                    Auto-adding in {autoAddCountdown}s...
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        )}

        {/* ── SECTION 4: Notes (collapsible, starts closed) ── */}
        <div className="qq-section">
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: sectionsOpen.notes ? 12 : 0 }}
          onClick={() => setSectionsOpen(p => ({ ...p, notes: !p.notes }))}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="qq-section-header" style={{ marginBottom: 0 }}>Notes</span>
            {!sectionsOpen.notes && notes && (
              <span style={{ fontSize: 12, color: 'var(--color-steel)', fontWeight: 400, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{notes}</span>
            )}
          </div>
          <ChevronDown size={16} style={{ color: 'var(--color-steel)', transition: 'transform .2s', transform: sectionsOpen.notes ? 'rotate(0)' : 'rotate(-90deg)' }} />
        </div>
        {sectionsOpen.notes && <div className="qq-field">
          <div className="qq-notes-wrap">
            <textarea
              className="qq-input qq-textarea"
              placeholder="Additional notes..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
            <button
              className={`qq-voice-btn${isRecording ? ' qq-voice-btn--recording' : ''}`}
              onClick={toggleVoice}
              title={isRecording ? 'Stop recording' : 'Start voice input'}
              type="button"
            >
              <MicIcon />
            </button>
          </div>
        </div>}
        </div>{/* end qq-section: Notes */}

      </div>

      {/* ─── RIGHT PANEL: Live Output ───────────────── */}
      <div className="qq-panel qq-panel--output">
        {/* Grand Total */}
        <div className="qq-total">
          <div className="qq-total__range" style={{ marginBottom: 4 }}>
            {hasLines || curPreview ? 'from' : ''}
          </div>
          <div className={`qq-total__amount${totalFlash ? ' qq-total__amount--flash' : ''}`}>
            {hasLines || curPreview ? `£${fmt(grandWithPreview)}` : '£—.——'}
          </div>
          {hasLines ? (
            <div className="qq-total__range">
              {lines.length} line item{lines.length !== 1 ? 's' : ''} · {totals.estHours}h total · inc. VAT
            </div>
          ) : (
            <div className="qq-total__range">Add line items to build your quote</div>
          )}
        </div>

        <div className="qq-sep" />

        {/* Line items breakdown */}
        {lines.length > 0 && (
          <div className="qq-breakdown">
            {lines.map(line => (
              <div key={line.id} className="qq-breakdown__row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 500 }}>{line.jobTypeName}{line.quantity > 1 ? ` x${line.quantity}` : ''}</span>
                  <AnimatedValue value={line.lineTotal} prefix="£" />
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-steel-light)' }}>
                  Mat £{fmt(line.materials)} · Lab £{fmt(line.labour)} ({line.estHours}h)
                  {line.certificates > 0 ? ` · Cert £${fmt(line.certificates)}` : ''}
                </div>
              </div>
            ))}

            {curPreview && curJobTypeId && (
              <div className="qq-breakdown__row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 2, opacity: 0.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontStyle: 'italic' }}>{jobTypeConfigs.find(j => j.id === curJobTypeId)?.name} (unsaved)</span>
                  <span className="qq-breakdown__value">£{fmt(curPreview.lineTotal)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {!hasLines && curPreview && curJobTypeId && (
          <div className="qq-breakdown">
            <div className="qq-breakdown__row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 2, opacity: 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontStyle: 'italic' }}>{jobTypeConfigs.find(j => j.id === curJobTypeId)?.name} (click Add to confirm)</span>
                <span className="qq-breakdown__value">£{fmt(curPreview.lineTotal)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="qq-sep" />

        {/* Totals */}
        <div className="qq-breakdown">
          <div className="qq-breakdown__row">
            <span>Materials</span><AnimatedValue value={totals.materials} prefix="£" />
          </div>
          <div className="qq-breakdown__row">
            <span>Labour ({totals.estHours}h @ £{pricingConfig.labourRate}/h)</span><AnimatedValue value={totals.labour} prefix="£" />
          </div>
          {totals.certificates > 0 && (
            <div className="qq-breakdown__row">
              <span>Certificates</span><AnimatedValue value={totals.certificates} prefix="£" />
            </div>
          )}
          {totals.waste > 0 && (
            <div className="qq-breakdown__row">
              <span>Waste</span><AnimatedValue value={totals.waste} prefix="£" />
            </div>
          )}
          {totals.adjustments > 0 && (
            <div className="qq-breakdown__row">
              <span>Adjustments</span><AnimatedValue value={totals.adjustments} prefix="+ £" />
            </div>
          )}

          <div className="qq-sep" />

          <div className="qq-breakdown__row">
            <span>Net Total</span><AnimatedValue value={totals.netTotal} prefix="£" />
          </div>
          <div className="qq-breakdown__row">
            <span>VAT ({Math.round(pricingConfig.vatRate * 100)}%)</span><AnimatedValue value={totals.vat} prefix="£" />
          </div>
          <div className="qq-breakdown__row qq-breakdown__row--total">
            <span>Grand Total</span><AnimatedValue value={totals.grandTotal} prefix="£" />
          </div>
        </div>

        <div className="qq-sep" />

        {/* Metrics */}
        <div className="qq-metrics">
          <div className="qq-metric">
            <div className="qq-metric__label">Margin</div>
            <div className="qq-metric__value">{Math.round(totals.margin)}%</div>
            <div className="qq-metric__bar">
              <div className="qq-metric__bar-fill" style={{ width: `${Math.min(100, Math.max(0, totals.margin))}%` }} />
            </div>
          </div>
          <div className="qq-metric">
            <div className="qq-metric__label">Day Rate</div>
            <div className="qq-metric__value">£{Math.round(totals.dayRate)}</div>
          </div>
          <div className="qq-metric">
            <div className="qq-metric__label">Est. Hours</div>
            <div className="qq-metric__value">{totals.estHours.toFixed(1)}</div>
          </div>
        </div>

        {/* Pricing Insight */}
        {lines.length > 0 && lines[0].jobTypeId && (
          <PricingSuggestion
            jobTypeId={lines[0].jobTypeId}
            currentTotal={totals.netTotal}
          />
        )}

        {/* Saved feedback */}
        {savedMsg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', color: '#6ABF8A', fontSize: 14, fontWeight: 500 }}>
            <CheckCircle size={16} /> {savedMsg}
          </div>
        )}

        {/* Auto-save indicator */}
        {activeQuote && (
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-steel-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span>{activeQuote.ref} · Lead · Auto-saved</span>
            <span
              onClick={() => navigate('/jobs')}
              style={{ color: 'var(--color-gold)', cursor: 'pointer', fontWeight: 500 }}
            >
              View in Jobs →
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="qq-actions">
          <button
            className="qq-btn qq-btn--primary"
            type="button"
            onClick={() => {
              if (!hasLines) { setSavedMsg('Add at least one line item'); setTimeout(() => setSavedMsg(''), 2500); return }
              if (!customerName) { setSavedMsg('Enter a customer name first'); setTimeout(() => setSavedMsg(''), 2500); return }
              setShowSendModal(true)
            }}
          >
            Send to Customer
          </button>
          <button
            className="qq-btn qq-btn--secondary"
            type="button"
            style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => {
              if (!hasLines) { setSavedMsg('Add at least one line item'); setTimeout(() => setSavedMsg(''), 2500); return }
              const data = buildQuoteData()
              generateQuotePDF({
                id: activeQuoteId || '', ref: activeQuote?.ref || getNextQuoteRef(),
                ...data, status: 'Draft', createdAt: activeQuote?.createdAt || new Date().toISOString().split('T')[0],
              }, settingsToBusinessInfo(settings))
            }}
          >
            <FileDown size={16} /> PDF
          </button>
        </div>
      </div>

      {/* ─── Send Modal ─────────────────────────────── */}
      {showSendModal && activeQuoteId && (() => {
        const url = `${window.location.origin}/q/${activeQuoteId}`
        const anySelected = sendVia.email || sendVia.whatsapp || sendVia.link
        const optStyle = (on: boolean): React.CSSProperties => ({
          display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
          borderRadius: 12, background: on ? 'var(--color-gold)' + '12' : 'var(--color-black)',
          border: `1px solid ${on ? 'var(--color-gold)' : 'var(--color-steel)'}`,
          color: on ? 'var(--color-gold)' : 'var(--color-white)', cursor: 'pointer',
          fontSize: 14, fontWeight: 500, textAlign: 'left', transition: 'all .15s', width: '100%',
        })

        const handleSend = () => {
          if (!activeQuoteId) return
          updateQuote(activeQuoteId, { status: 'Sent', sentAt: new Date().toISOString().split('T')[0] })
          // Move job from Lead to Quoted now that the quote has been sent
          if (activeJobId) moveJob(activeJobId, 'Quoted')

          if (sendVia.email) {
            const email = selectedCustomer?.email || ''
            const biz = settings.business
            const quoteEmailData = buildQuoteEmail({
              customerName,
              businessName: biz.businessName,
              quoteRef: activeQuote?.ref || '',
              total: `£${fmt(totals.grandTotal)}`,
              quoteUrl: url,
              validityDays: settings.quoteConfig.validityDays,
              businessPhone: biz.phone,
              businessEmail: biz.email,
            })
            // Try real email, falls back to mailto automatically
            sendEmail({
              to: email,
              subject: quoteEmailData.subject,
              htmlBody: quoteEmailData.html,
              textBody: quoteEmailData.text,
              replyTo: biz.email,
              orgId: user?.orgId || '',
              customerId: selectedCustomer?.id,
              templateName: 'Send Quote',
            })
          }
          if (sendVia.whatsapp) {
            const phone = selectedCustomer?.phone?.replace(/\s/g, '').replace(/^0/, '44') || ''
            const text = `Hi ${customerName}, here's your quote from Grey Havens Electrical:\n\n${url}\n\nTotal: £${fmt(totals.grandTotal)} (inc. VAT)\n\nLet me know if you'd like to go ahead!`
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank')
          }
          if (sendVia.link) {
            navigator.clipboard.writeText(url)
          }

          const methods = [sendVia.email && 'Email', sendVia.whatsapp && 'WhatsApp', sendVia.link && 'Link copied'].filter(Boolean)
          setSendMsg(`Sent via ${methods.join(' + ')}`)
        }

        return (
          <>
            <div
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 200 }}
              onClick={() => { setShowSendModal(false); setSendVia({ email: false, whatsapp: false, link: false }) }}
            />
            <div style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              background: 'var(--color-charcoal-light)', borderRadius: 20, padding: '32px 28px',
              width: 420, maxWidth: '90vw', zIndex: 210, boxShadow: '0 16px 48px rgba(0,0,0,.5)',
            }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-white)', marginBottom: 4 }}>
                Send Quote
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-steel-light)', marginBottom: 20 }}>
                {activeQuote?.ref} · £{fmt(totals.grandTotal)} · {customerName}
              </div>

              {sendMsg ? (
                <>
                  {/* ── Post-send confirmation ── */}
                  <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>
                      <CheckCircle size={40} color="#6ABF8A" />
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-white)', marginBottom: 4 }}>
                      Quote {activeQuote?.ref} sent to {customerName}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--color-steel-light)', marginBottom: 2 }}>
                      {sendMsg}
                    </div>
                  </div>

                  <div style={{
                    padding: '16px', borderRadius: 10, background: 'var(--color-black)',
                    marginBottom: 20, border: '1px solid var(--color-steel)',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-silver)', marginBottom: 10 }}>
                      What happens next:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--color-steel-light)' }}>
                        <span style={{ flexShrink: 0 }}>&#8226;</span>
                        <span>We'll notify you when they view it</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--color-steel-light)' }}>
                        <span style={{ flexShrink: 0 }}>&#8226;</span>
                        <span>If they accept, the job moves to "Accepted"</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--color-steel-light)' }}>
                        <span style={{ flexShrink: 0 }}>&#8226;</span>
                        <span>You can track it in Jobs</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => { setShowSendModal(false); setSendVia({ email: false, whatsapp: false, link: false }); setSendMsg(''); navigate('/jobs') }}
                      className="qq-btn qq-btn--primary"
                      style={{ flex: 1 }}
                    >
                      View in Jobs
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSendModal(false); setSendVia({ email: false, whatsapp: false, link: false }); setSendMsg('')
                        // Reset for new quote
                        setCustomerName(''); setDescription(''); setNotes(''); setLines([])
                        setCurJobTypeId(''); setIsEmergency(false); setIsOutOfHours(false)
                        setActiveQuoteId(null); setActiveJobId(null); setSelectedCustomerId(null)
                        setJobPostcode(''); setLoaded(false)
                      }}
                      className="qq-btn qq-btn--secondary"
                      style={{ flex: 1 }}
                    >
                      Create Another Quote
                    </button>
                  </div>
                </>
              ) : (
                <>
              <div style={{ fontSize: 12, color: 'var(--color-steel-light)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>
                Select send methods
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                <button type="button" onClick={() => setSendVia(p => ({ ...p, email: !p.email }))} style={optStyle(sendVia.email)}>
                  <span style={{ fontSize: 20 }}>📧</span>
                  <div style={{ flex: 1 }}>
                    <div>Email</div>
                    <div style={{ fontSize: 12, color: 'var(--color-steel-light)' }}>
                      {selectedCustomer?.email || 'Opens email client'}
                    </div>
                  </div>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6,
                    border: `2px solid ${sendVia.email ? 'var(--color-gold)' : 'var(--color-steel)'}`,
                    background: sendVia.email ? 'var(--color-gold)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all .15s', flexShrink: 0,
                  }}>
                    {sendVia.email && <CheckCircle size={14} color="var(--color-black)" />}
                  </div>
                </button>

                <button type="button" onClick={() => setSendVia(p => ({ ...p, whatsapp: !p.whatsapp }))} style={optStyle(sendVia.whatsapp)}>
                  <span style={{ fontSize: 20 }}>💬</span>
                  <div style={{ flex: 1 }}>
                    <div>WhatsApp</div>
                    <div style={{ fontSize: 12, color: 'var(--color-steel-light)' }}>
                      {selectedCustomer?.phone || 'Opens WhatsApp'}
                    </div>
                  </div>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6,
                    border: `2px solid ${sendVia.whatsapp ? 'var(--color-gold)' : 'var(--color-steel)'}`,
                    background: sendVia.whatsapp ? 'var(--color-gold)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all .15s', flexShrink: 0,
                  }}>
                    {sendVia.whatsapp && <CheckCircle size={14} color="var(--color-black)" />}
                  </div>
                </button>

                <button type="button" onClick={() => setSendVia(p => ({ ...p, link: !p.link }))} style={optStyle(sendVia.link)}>
                  <span style={{ fontSize: 20 }}>🔗</span>
                  <div style={{ flex: 1 }}>
                    <div>Copy Link</div>
                    <div style={{ fontSize: 12, color: 'var(--color-steel-light)' }}>
                      Copy to clipboard
                    </div>
                  </div>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6,
                    border: `2px solid ${sendVia.link ? 'var(--color-gold)' : 'var(--color-steel)'}`,
                    background: sendVia.link ? 'var(--color-gold)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all .15s', flexShrink: 0,
                  }}>
                    {sendVia.link && <CheckCircle size={14} color="var(--color-black)" />}
                  </div>
                </button>
              </div>

              <button
                type="button"
                onClick={handleSend}
                disabled={!anySelected}
                className="qq-btn qq-btn--primary"
                style={{
                  width: '100%', opacity: anySelected ? 1 : 0.4,
                  cursor: anySelected ? 'pointer' : 'not-allowed',
                }}
              >
                Send{anySelected ? ` via ${[sendVia.email && 'Email', sendVia.whatsapp && 'WhatsApp', sendVia.link && 'Link'].filter(Boolean).join(' + ')}` : ''}
              </button>

              <button
                type="button"
                onClick={() => { setShowSendModal(false); setSendVia({ email: false, whatsapp: false, link: false }) }}
                style={{
                  width: '100%', marginTop: 8, padding: '10px', borderRadius: 10,
                  background: 'transparent', border: 'none',
                  color: 'var(--color-steel)', cursor: 'pointer', fontSize: 13,
                }}
              >
                Cancel
              </button>
                </>
              )}
            </div>
          </>
        )
      })()}
    </div>
  )
}

/* ──────────────────────────────────────────────────────
   Sub-components
   ────────────────────────────────────────────────────── */

function Toggle({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button className={`qq-toggle${on ? ' qq-toggle--on' : ''}`} onClick={onToggle} type="button">
      <span className="qq-toggle__indicator" />
      {label}
    </button>
  )
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  )
}

declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}
