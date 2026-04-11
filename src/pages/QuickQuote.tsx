import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle, FileDown, Plus, Trash2, Lock, MapPin, ChevronDown, Send } from 'lucide-react'
import { useData } from '../data/DataContext'
import { useAuth } from '../auth/AuthContext'
import { useSubscription } from '../subscription/SubscriptionContext'
import { generateQuotePDF, settingsToBusinessInfo } from '../lib/pdf-generator'
import { validateEmail, validatePhone } from '../lib/validation'
import { sendEmail, buildFromName } from '../lib/send-email'
import { QUICK_SPECS, computeSpecAdjustments, type QuickSpecValues } from '../data/quick-specs'
import { buildQuoteEmail } from '../lib/email-templates'
import PricingSuggestion from '../components/PricingSuggestion'
import { estimateDistance, getDistanceHassleAdjustment } from '../lib/postcode-distance'
import { copyToClipboard } from '../lib/clipboard'
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
  /** Quick-spec values captured during quoting (e.g. { fittings: 6, newCircuit: true }) */
  specs?: Record<string, number | boolean | string>
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
  const { addQuote, updateQuote, updateJob, moveJob, addJob, addCustomer, quotes, jobs, customers, settings, getNextQuoteRef, awaitRealId, pricingConfig, jobTypeConfigs } = useData()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { canUse } = useSubscription()
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
  const canMultiLine = canUse('multiLineQuotes')

  // ── Pricing engine (uses DataContext values) ──
  const calculateLine = useCallback((
    jobTypeId: string, quantity: number, difficulty: number, hassleFactor: number,
    emergency: boolean, outOfHours: boolean, certRequired: boolean, customerSuppliesMaterials: boolean,
    manualMaterials?: number, manualHours?: number,
    specs?: QuickSpecValues,
  ): Omit<LineItem, 'id' | 'jobTypeId' | 'jobTypeName' | 'quantity' | 'difficulty' | 'hassleFactor' | 'emergency' | 'outOfHours' | 'certRequired' | 'customerSuppliesMaterials' | 'specs'> => {
    const jobType = jobTypeConfigs.find(j => j.id === jobTypeId)
    if (!jobType) return { materials: 0, labour: 0, certificates: 0, waste: 0, adjustments: 0, lineTotal: 0, estHours: 0 }

    const isManual = jobTypeId === 'other'
    const specDefs = QUICK_SPECS[jobTypeId]

    let materials: number
    let hours: number

    if (isManual) {
      // Manual entry — use the user's own numbers
      materials = customerSuppliesMaterials ? 0 : (manualMaterials || 0)
      hours = manualHours || 1
    } else if (specDefs && specs && Object.keys(specs).length > 0) {
      // Spec-driven pricing — specs define materials and labour
      const adj = computeSpecAdjustments(specDefs, specs)
      const qty = adj.coreQuantity ?? quantity
      // Base cost per unit from the job type config PLUS spec adjustments.
      // For spec-driven types the specAdjustments already include per-unit
      // costs so we only add the base when there's no core-quantity spec
      // (meaning the base cost is the whole-job flat rate, e.g. fault finding).
      const baseMat = adj.coreQuantity != null ? 0 : jobType.baseMaterialCost * qty
      const baseHrs = adj.coreQuantity != null ? 0 : jobType.baseHours * qty
      materials = customerSuppliesMaterials ? 0 : (baseMat + adj.materialsAdj)
      hours = baseHrs + adj.labourMinsAdj / 60
    } else {
      // Legacy path — no specs, use base costs × quantity
      const qty = quantity
      materials = customerSuppliesMaterials ? 0 : jobType.baseMaterialCost * qty
      hours = jobType.baseHours * qty
    }

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
  const [sendConfirmed, setSendConfirmed] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [sendVia, setSendVia] = useState<{ email: boolean; whatsapp: boolean; link: boolean }>({ email: false, whatsapp: false, link: false })
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newCustPhone, setNewCustPhone] = useState('')
  const [newCustEmail, setNewCustEmail] = useState('')
  const [newCustPostcode, setNewCustPostcode] = useState('')
  const [newCustErrors, setNewCustErrors] = useState<Record<string, string>>({})
  const [newCustIsBusiness, setNewCustIsBusiness] = useState(false)
  const [newCustContactName, setNewCustContactName] = useState('')
  // Collapsible sections — customer collapses once selected, notes starts collapsed
  const [sectionsOpen, setSectionsOpen] = useState({ customer: true, notes: false, jobDetails: true, addLine: true })
  const [activePanel, setActivePanel] = useState(0)
  const pageRef = useRef<HTMLDivElement>(null)

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
  // Quick-spec values for the currently-selected job type
  const [curSpecs, setCurSpecs] = useState<QuickSpecValues>({})
  const curSpecDefs = QUICK_SPECS[curJobTypeId] ?? []
  // When editing an existing line, this holds its ID. Null = adding new.
  const [editingLineId, setEditingLineId] = useState<number | null>(null)

  // ── Auto-add timer ──

  // ── Load existing quote ──
  useEffect(() => {
    if (existingQuote && !loaded) {
      setCustomerName(existingQuote.customerName)
      setDescription(existingQuote.description)
      setNotes(existingQuote.notes)
      setIsEmergency(existingQuote.emergency)
      setIsOutOfHours(existingQuote.outOfHours)
      // Restore specs from defaults for this job type. Future: store
      // specs on the quote so they round-trip exactly. For now, defaults
      // are close enough and the user can adjust via the edit flow.
      const specDefs = QUICK_SPECS[existingQuote.jobTypeId]
      const restoredSpecs: QuickSpecValues = {}
      if (specDefs) {
        for (const spec of specDefs) restoredSpecs[spec.key] = spec.default
        // Override the core quantity spec with the quote's actual quantity
        // so "6 fittings" restores correctly.
        const coreSpec = specDefs.find(s => s.type === 'number' && (s.materialsPer || s.labourMinsPer))
        if (coreSpec) restoredSpecs[coreSpec.key] = existingQuote.quantity
      }
      const calc = calculateLine(
        existingQuote.jobTypeId, existingQuote.quantity, existingQuote.difficulty,
        existingQuote.hassleFactor, existingQuote.emergency, existingQuote.outOfHours,
        existingQuote.certRequired, existingQuote.customerSuppliesMaterials,
        undefined, undefined, Object.keys(restoredSpecs).length > 0 ? restoredSpecs : undefined,
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
        specs: Object.keys(restoredSpecs).length > 0 ? restoredSpecs : undefined,
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

  // ── Auto-set cert + initialise quick specs when job type changes ──
  const handleJobTypeSelect = useCallback((id: string) => {
    setCurJobTypeId(id)
    const jt = jobTypeConfigs.find(j => j.id === id)
    if (jt) setCurCert(jt.certRequired)
    // Initialise quick specs with defaults for this job type
    const specDefs = QUICK_SPECS[id]
    if (specDefs) {
      const defaults: QuickSpecValues = {}
      for (const spec of specDefs) {
        defaults[spec.key] = spec.default
      }
      setCurSpecs(defaults)
    } else {
      setCurSpecs({})
    }
    // On mobile, collapse customer section so specs are immediately visible
    if (isMobile) {
      setSectionsOpen(p => ({ ...p, customer: false }))
    }
  }, [jobTypeConfigs, isMobile])


  // ── Load an existing line into the form for editing ──
  const editLine = useCallback((line: LineItem) => {
    setCurJobTypeId(line.jobTypeId)
    setCurQuantity(line.quantity)
    setCurDifficulty(line.difficulty)
    setCurHassle(line.hassleFactor)
    setCurCert(line.certRequired)
    setCurCustMaterials(line.customerSuppliesMaterials)
    if (line.jobTypeId === 'other') {
      setCurManualMaterials(line.materials)
      setCurManualHours(line.estHours)
    }
    if (line.specs && Object.keys(line.specs).length > 0) {
      setCurSpecs(line.specs)
    } else {
      const specDefs = QUICK_SPECS[line.jobTypeId]
      if (specDefs) {
        const defaults: QuickSpecValues = {}
        for (const spec of specDefs) defaults[spec.key] = spec.default
        setCurSpecs(defaults)
      } else {
        setCurSpecs({})
      }
    }
    setEditingLineId(line.id)
  }, [])

  // ── Add or update current line ──
  const addLine = useCallback(() => {
    const jt = jobTypeConfigs.find(j => j.id === curJobTypeId)
    if (!jt) return

    const calc = calculateLine(curJobTypeId, curQuantity, curDifficulty, curHassle, isEmergency, isOutOfHours, curCert, curCustMaterials, curManualMaterials, curManualHours, curSpecs)
    const lineData = {
      jobTypeId: curJobTypeId,
      jobTypeName: curJobTypeId === 'other' ? 'Other' : jt.name,
      quantity: curQuantity,
      difficulty: curDifficulty,
      hassleFactor: curHassle,
      emergency: isEmergency,
      outOfHours: isOutOfHours,
      certRequired: curCert,
      customerSuppliesMaterials: curCustMaterials,
      specs: Object.keys(curSpecs).length > 0 ? { ...curSpecs } : undefined,
      ...calc,
    }

    if (editingLineId != null) {
      // Update existing line in-place
      setLines(prev => prev.map(l => l.id === editingLineId ? { ...l, ...lineData } : l))
      setEditingLineId(null)
    } else {
      // Add new line
      setLines(prev => [...prev, { id: nextLineId++, ...lineData }])
    }

    // Reset form for next line
    setCurJobTypeId('')
    setCurQuantity(1)
    setCurDifficulty(25)
    setCurHassle(15)
    setCurCert(false)
    setCurCustMaterials(false)
    setCurManualMaterials(0)
    setCurManualHours(1)
    setCurSpecs({})
  }, [curJobTypeId, curQuantity, curDifficulty, curHassle, isEmergency, isOutOfHours, curCert, curCustMaterials, curManualMaterials, curManualHours, calculateLine, jobTypeConfigs])


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
    return calculateLine(curJobTypeId, curQuantity, curDifficulty, curHassle, isEmergency, isOutOfHours, curCert, curCustMaterials, curManualMaterials, curManualHours, curSpecs)
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
    if (!SR) { setSavedMsg('Voice input not supported in this browser'); setTimeout(() => setSavedMsg(''), 3000); return }
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
      customerName: customerName || 'New Lead',
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
        // If the quote was already sent, mark it as needing a resend
        // so the system prompts the user to notify the customer about
        // the updated pricing.
        const existingQ = quotes.find(q => q.id === activeQuoteIdRef.current)
        const markResend = existingQ && existingQ.status !== 'Draft'
        updateQuote(activeQuoteIdRef.current, {
          ...data,
          ...(markResend ? { needsResend: true } : {}),
        })
        if (activeJobIdRef.current) {
          updateJob(activeJobIdRef.current, {
            customerId: data.customerId,
            customerName: data.customerName,
            jobType: data.jobTypeName || 'TBC',
            value: Math.round(data.grandTotal),
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
            value: Math.round(data.grandTotal),
            estimatedHours: data.estHours,
            status: 'Lead',
            date: new Date().toISOString().split('T')[0],
            notes: data.description,
          })
          setActiveQuoteId(q.id)
          if (j && j.id) setActiveJobId(j.id)
          // Swap the temp IDs for the real Supabase IDs as soon as the
          // optimistic insert round-trips, so any URL we build (and any
          // updateQuote call we make) targets the persisted row.
          awaitRealId(q.id).then(realId => { if (realId !== q.id) setActiveQuoteId(realId) })
          if (j && j.id) {
            awaitRealId(j.id).then(realId => { if (realId !== j.id) setActiveJobId(realId) })
          }
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
      (c.businessName && c.businessName.toLowerCase().includes(term)) ||
      (c.contactName && c.contactName.toLowerCase().includes(term)) ||
      c.postcode.toLowerCase().includes(term) ||
      c.phone.includes(term)
    ).slice(0, 6)
  }, [customerName, customers])

  const hasLines = lines.length > 0
  const hasJobSelected = !!jobTypeConfigs.find(j => j.id === curJobTypeId)

  // ── Render ──
  return (
    <div className="qq-page" ref={pageRef} onScroll={() => {
      if (pageRef.current && isMobile) {
        const scrollLeft = pageRef.current.scrollLeft
        const width = pageRef.current.clientWidth
        setActivePanel(scrollLeft > width * 0.5 ? 1 : 0)
      }
    }}>
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
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-white)' }}>
                    {c.isBusiness && c.businessName ? c.businessName : c.name}
                    {c.isBusiness && <span style={{ fontSize: 10, marginLeft: 6, opacity: 0.6 }}>🏢</span>}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--color-steel-light)' }}>
                    {c.isBusiness && c.contactName ? `${c.contactName} · ` : ''}
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
              {/* Individual / Business toggle */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 10, background: 'var(--color-charcoal)', borderRadius: 16, padding: 2 }}>
                <button type="button" onClick={() => setNewCustIsBusiness(false)} style={{
                  flex: 1, padding: '5px', borderRadius: 14, border: 'none',
                  background: !newCustIsBusiness ? 'var(--color-charcoal-light)' : 'transparent',
                  color: !newCustIsBusiness ? 'var(--color-white)' : 'var(--color-steel)',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}>👤 Individual</button>
                <button type="button" onClick={() => setNewCustIsBusiness(true)} style={{
                  flex: 1, padding: '5px', borderRadius: 14, border: 'none',
                  background: newCustIsBusiness ? 'var(--color-charcoal-light)' : 'transparent',
                  color: newCustIsBusiness ? 'var(--color-white)' : 'var(--color-steel)',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}>🏢 Business</button>
              </div>
              {newCustIsBusiness && (
                <div style={{ marginBottom: 10 }}>
                  <span className="qq-label">Point of Contact</span>
                  <input className="qq-input" placeholder="e.g. Sarah Jones" value={newCustContactName} onChange={e => setNewCustContactName(e.target.value)} />
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
                <div>
                  <span className="qq-label">Phone</span>
                  <input className="qq-input" type="tel" inputMode="tel" placeholder="07XXX XXX XXX" value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)} />
                </div>
                <div>
                  <span className="qq-label">Email</span>
                  <input className="qq-input" type="email" inputMode="email" placeholder="email@example.com" value={newCustEmail} onChange={e => setNewCustEmail(e.target.value)} />
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
                    isBusiness: newCustIsBusiness,
                    businessName: newCustIsBusiness ? customerName.trim() : undefined,
                    contactName: newCustIsBusiness ? newCustContactName.trim() || undefined : undefined,
                  })
                  setSelectedCustomerId(c.id)
                  setShowNewCustomer(false)
                  setNewCustPhone('')
                  setNewCustEmail('')
                  setNewCustPostcode('')
                  setNewCustErrors({})
                  setNewCustIsBusiness(false)
                  setNewCustContactName('')
                  setSavedMsg('✓ Customer saved')
                  setTimeout(() => setSavedMsg(''), 2500)
                }}
              >
                Save Customer
              </button>
            </div>
          )}
        </div>

        {/* Job Site + Description row */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: '0 0 auto' }}>
            <span className="qq-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={12} /> Job Site
            </span>
            <input
              className="qq-input"
              type="text"
              placeholder="e.g. CO3 4QR"
              value={jobPostcode}
              onChange={e => {
                setJobPostcode(e.target.value.toUpperCase())
                setHassleManuallyOverridden(false)
              }}
              style={{ width: 110, textTransform: 'uppercase', fontSize: 13 }}
            />
          </div>
          {!isMobile && (
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
          )}
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
        {/* Emergency / Out of Hours — at the top so the user can flag
            these immediately when the customer says "it's urgent" without
            scrolling past the form. */}
        <div className="qq-field">
          <div className="qq-toggles-row">
            <Toggle label="Emergency" on={isEmergency} onToggle={() => setIsEmergency(!isEmergency)} />
            <Toggle label="Out of hours" on={isOutOfHours} onToggle={() => setIsOutOfHours(!isOutOfHours)} />
          </div>
        </div>

        </>}
        </div>{/* end qq-section: Customer & Job Info */}

        {/* ── SECTION 2: Line Items ── */}
        <div className="qq-section">
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: isMobile ? 'pointer' : 'default' }}
          onClick={() => { if (isMobile) setSectionsOpen(p => ({ ...p, jobDetails: !p.jobDetails })) }}
        >
          <div className="qq-section-header">Job Details</div>
          {isMobile && (
            <ChevronDown size={16} style={{ color: 'var(--color-steel)', transition: 'transform .2s', transform: sectionsOpen.jobDetails ? 'rotate(0)' : 'rotate(-90deg)' }} />
          )}
        </div>

        {/* ── Added Lines ── */}
        {(sectionsOpen.jobDetails || !isMobile) && lines.length > 0 && (
          <div className="qq-field">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {lines.map(line => {
                // Build a short spec summary (e.g. "6 fittings · Downlights · New circuit")
                const specSummary = line.specs ? Object.entries(line.specs)
                  .filter(([, v]) => v !== false && v !== '' && v !== 0)
                  .map(([, v]) => typeof v === 'boolean' ? '✓' : String(v))
                  .slice(0, 3).join(' · ') : ''
                const isEditing = editingLineId === line.id
                return (
                <div
                  key={line.id}
                  onClick={() => editLine(line)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: isEditing ? 'var(--color-gold)12' : 'var(--color-black)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 14px',
                    border: `1px solid ${isEditing ? 'var(--color-gold)' : 'var(--color-steel)'}`,
                    cursor: 'pointer',
                    transition: 'border-color .15s',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-white)' }}>
                      {line.jobTypeName}{line.quantity > 1 ? ` x${line.quantity}` : ''}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--color-steel-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {specSummary || `${line.estHours}h`}
                      {line.emergency ? ' · Emergency' : ''}{line.outOfHours ? ' · OOH' : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-gold)' }}>
                      £{fmt(line.lineTotal)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeLine(line.id) }}
                      style={{
                        background: 'transparent', border: 'none', color: 'var(--color-steel)',
                        cursor: 'pointer', padding: 4, display: 'flex',
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                )
              })}
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

          {/* Job Type Grid — hidden on mobile when a type is selected */}
          {(!isMobile || !curJobTypeId) && (
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
          )}

          {/* Selected job type config — on mobile replaces the grid */}
          {hasJobSelected && (
            <>
              {/* Mobile: show selected type header with change button */}
              {isMobile && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: 8,
                  background: 'var(--color-gold)', marginBottom: 4,
                }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-black)' }}>
                    {jobTypeConfigs.find(j => j.id === curJobTypeId)?.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setCurJobTypeId(''); setEditingLineId(null); setCurSpecs({}) }}
                    style={{
                      background: 'rgba(0,0,0,0.15)', border: 'none', borderRadius: 6,
                      padding: '4px 10px', fontSize: 12, fontWeight: 600,
                      color: 'var(--color-black)', cursor: 'pointer',
                    }}
                  >
                    Change
                  </button>
                </div>
              )}

              {/* On mobile, show specs FIRST (the key questions) before qty/options */}
              {isMobile && curSpecDefs.length > 0 && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                  gap: 8,
                  marginBottom: 4,
                }}>
                  {curSpecDefs.map(spec => {
                    const val = curSpecs[spec.key] ?? spec.default
                    if (spec.type === 'number') {
                      return (
                        <div key={spec.key} className="qq-field">
                          <span className="qq-label">{spec.label}</span>
                          <div className="qq-stepper">
                            <button
                              className="qq-stepper__btn" type="button"
                              onClick={() => setCurSpecs(prev => ({
                                ...prev,
                                [spec.key]: Math.max(spec.min ?? 1, (Number(prev[spec.key] ?? spec.default) || 0) - 1),
                              }))}
                            >&minus;</button>
                            <span className="qq-stepper__value">{val}</span>
                            <button
                              className="qq-stepper__btn" type="button"
                              onClick={() => setCurSpecs(prev => ({
                                ...prev,
                                [spec.key]: Math.min(spec.max ?? 99, (Number(prev[spec.key] ?? spec.default) || 0) + 1),
                              }))}
                            >+</button>
                          </div>
                          {spec.hint && <span style={{ fontSize: 10, color: 'var(--color-steel)', marginTop: 2 }}>{spec.hint}</span>}
                        </div>
                      )
                    }
                    if (spec.type === 'toggle') {
                      return (
                        <div key={spec.key} className="qq-field">
                          <span className="qq-label">{spec.label}</span>
                          <button
                            type="button"
                            onClick={() => setCurSpecs(prev => ({ ...prev, [spec.key]: !prev[spec.key] }))}
                            style={{
                              padding: '8px 12px', borderRadius: 8, border: 'none',
                              background: val ? 'var(--color-gold)' : 'var(--color-black)',
                              color: val ? 'var(--color-charcoal)' : 'var(--color-steel-light)',
                              fontSize: 12, fontWeight: 600, cursor: 'pointer',
                              minHeight: 38, width: '100%',
                              transition: 'background .15s',
                            }}
                          >
                            {val ? '✓ Yes' : 'No'}
                          </button>
                        </div>
                      )
                    }
                    if (spec.type === 'select' && spec.options) {
                      return (
                        <div key={spec.key} className="qq-field">
                          <span className="qq-label">{spec.label}</span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {spec.options.map(opt => {
                              const active = String(val) === opt.value
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setCurSpecs(prev => ({ ...prev, [spec.key]: opt.value }))}
                                  style={{
                                    flex: 1, minWidth: 0,
                                    padding: '6px 6px', borderRadius: 6,
                                    border: `1px solid ${active ? 'var(--color-gold)' : 'var(--color-steel)'}`,
                                    background: active ? 'var(--color-gold)' : 'transparent',
                                    color: active ? 'var(--color-charcoal)' : 'var(--color-white)',
                                    fontSize: 11, fontWeight: active ? 700 : 500,
                                    cursor: 'pointer', whiteSpace: 'nowrap',
                                    minHeight: 32,
                                  }}
                                >
                                  {opt.label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    }
                    return null
                  })}
                </div>
              )}

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

              {/* ── Quick Specs — inline fields specific to this job type.
                  Replace the abstract difficulty/hassle sliders with
                  concrete questions the electrician would ask the customer
                  on the phone. ── */}
              {/* Desktop specs (mobile shows them above qty) */}
              {!isMobile && curSpecDefs.length > 0 && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                  gap: 8,
                  marginBottom: 4,
                }}>
                  {curSpecDefs.map(spec => {
                    const val = curSpecs[spec.key] ?? spec.default
                    if (spec.type === 'number') {
                      return (
                        <div key={spec.key} className="qq-field">
                          <span className="qq-label">{spec.label}</span>
                          <div className="qq-stepper">
                            <button
                              className="qq-stepper__btn" type="button"
                              onClick={() => setCurSpecs(prev => ({
                                ...prev,
                                [spec.key]: Math.max(spec.min ?? 1, (Number(prev[spec.key] ?? spec.default) || 0) - 1),
                              }))}
                            >&minus;</button>
                            <span className="qq-stepper__value">{val}</span>
                            <button
                              className="qq-stepper__btn" type="button"
                              onClick={() => setCurSpecs(prev => ({
                                ...prev,
                                [spec.key]: Math.min(spec.max ?? 99, (Number(prev[spec.key] ?? spec.default) || 0) + 1),
                              }))}
                            >+</button>
                          </div>
                          {spec.hint && <span style={{ fontSize: 10, color: 'var(--color-steel)', marginTop: 2 }}>{spec.hint}</span>}
                        </div>
                      )
                    }
                    if (spec.type === 'toggle') {
                      return (
                        <div key={spec.key} className="qq-field">
                          <span className="qq-label">{spec.label}</span>
                          <button
                            type="button"
                            onClick={() => setCurSpecs(prev => ({ ...prev, [spec.key]: !prev[spec.key] }))}
                            style={{
                              padding: '8px 12px', borderRadius: 8, border: 'none',
                              background: val ? 'var(--color-gold)' : 'var(--color-black)',
                              color: val ? 'var(--color-charcoal)' : 'var(--color-steel-light)',
                              fontSize: 12, fontWeight: 600, cursor: 'pointer',
                              minHeight: 38, width: '100%',
                              transition: 'background .15s',
                            }}
                          >
                            {val ? '✓ Yes' : 'No'}
                          </button>
                          {spec.hint && <span style={{ fontSize: 10, color: 'var(--color-steel)', marginTop: 2 }}>{spec.hint}</span>}
                        </div>
                      )
                    }
                    if (spec.type === 'select' && spec.options) {
                      return (
                        <div key={spec.key} className="qq-field">
                          <span className="qq-label">{spec.label}</span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {spec.options.map(opt => {
                              const active = String(val) === opt.value
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setCurSpecs(prev => ({ ...prev, [spec.key]: opt.value }))}
                                  style={{
                                    flex: 1, minWidth: 0,
                                    padding: '6px 6px', borderRadius: 6,
                                    border: `1px solid ${active ? 'var(--color-gold)' : 'var(--color-steel)'}`,
                                    background: active ? 'var(--color-gold)' : 'transparent',
                                    color: active ? 'var(--color-charcoal)' : 'var(--color-white)',
                                    fontSize: 11, fontWeight: active ? 700 : 500,
                                    cursor: 'pointer', whiteSpace: 'nowrap',
                                    minHeight: 32,
                                  }}
                                >
                                  {opt.label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    }
                    return null
                  })}
                </div>
              )}

              {/* Difficulty / Hassle sliders — shown only when there are
                  no quick specs (i.e. legacy "Other" type or custom types
                  without spec definitions). When specs exist, difficulty
                  and hassle are left at their defaults since the specs
                  capture the concrete factors that affect pricing. */}
              {curSpecDefs.length === 0 && curJobTypeId !== 'other' && (
                <>
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
                </>
              )}

              {/* Toggles */}
              <div className="qq-field">
                <span className="qq-label">Options</span>
                <div className="qq-toggles-row">
                  <Toggle label="Certificate" on={curCert} onToggle={() => setCurCert(!curCert)} />
                  <Toggle label="Customer materials" on={curCustMaterials} onToggle={() => setCurCustMaterials(!curCustMaterials)} />
                </div>
              </div>

              {/* Add / Update Line Button */}
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {editingLineId != null && (
                    <button
                      className="qq-btn qq-btn--secondary"
                      type="button"
                      onClick={() => {
                        setEditingLineId(null)
                        setCurJobTypeId('')
                        setCurQuantity(1)
                        setCurDifficulty(25)
                        setCurHassle(15)
                        setCurCert(false)
                        setCurCustMaterials(false)
                        setCurSpecs({})
                      }}
                      aria-label="Cancel editing"
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    className="qq-btn qq-btn--primary"
                    type="button"
                    onClick={() => addLine()}
                    style={{ flex: editingLineId != null ? 2 : undefined, width: editingLineId != null ? undefined : '100%', marginTop: editingLineId != null ? 0 : 4 }}
                  >
                    {editingLineId != null ? (
                      <>✓ Update {jobTypeConfigs.find(j => j.id === curJobTypeId)?.name || 'Line'}</>
                    ) : (
                      <><Plus size={18} style={{ marginRight: 6 }} /> Add {jobTypeConfigs.find(j => j.id === curJobTypeId)?.name || 'Line'}</>
                    )}
                  </button>
                </div>
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
              // Warn if critical business details are still placeholder values
              const biz = settings.business
              if (!biz.businessName || biz.businessName === 'Grey Havens Electrical' || biz.phone === '07XXX XXX XXX' || !biz.email || biz.email === 'info@thegreyhavens.co.uk') {
                const ok = window.confirm('Your business details look incomplete (name, phone, or email are still default values). The customer will see these on the quote.\n\nContinue anyway, or update in Settings first?')
                if (!ok) return
              }
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
        // Guard against the optimistic temp ID — quotes that haven't finished
        // round-tripping to Supabase yet would otherwise produce a permanently
        // broken /q/tmp-... link in the customer's email.
        const idIsPending = activeQuoteId.startsWith('tmp-')
        const url = `${window.location.origin}/q/${activeQuoteId}`
        const anySelected = sendVia.email || sendVia.whatsapp || sendVia.link
        const optStyle = (on: boolean): React.CSSProperties => ({
          display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
          borderRadius: 12, background: on ? 'var(--color-gold)' + '12' : 'var(--color-black)',
          border: `1px solid ${on ? 'var(--color-gold)' : 'var(--color-steel)'}`,
          color: on ? 'var(--color-gold)' : 'var(--color-white)', cursor: 'pointer',
          fontSize: 14, fontWeight: 500, textAlign: 'left', transition: 'all .15s', width: '100%',
        })

        // Dispatches the chosen channels and auto-marks the quote as Sent on success.
        //   - Email: awaited via Resend Edge Function. If RESEND_API_KEY is configured the
        //     email is delivered server-side (no mail client opens). If not, falls back to
        //     mailto and we trust the user's intent.
        //   - WhatsApp: opens wa.me with pre-filled message. Auto-confirmed because there
        //     is no public API to send WhatsApp messages programmatically without Meta's
        //     Business API (enterprise tier, requires verification + approved templates).
        //   - Link: copied to clipboard. Auto-confirmed since copying is the user's intent
        //     to share manually.
        const handleSend = async () => {
          if (!activeQuoteId) return
          setIsSending(true)

          // Wait for the optimistic insert to round-trip if it hasn't yet,
          // then build the URL from the real Supabase ID. Without this the
          // customer would receive a /q/tmp-... link that never resolves.
          const realQuoteId = await awaitRealId(activeQuoteId)
          const safeUrl = `${window.location.origin}/q/${realQuoteId}`

          const usedMethods: string[] = []
          let emailMethod: 'edge' | 'mailto' | null = null
          let hadFailure = false

          if (sendVia.email) {
            const email = selectedCustomer?.email || ''
            const biz = settings.business
            const quoteEmailData = buildQuoteEmail({
              customerName,
              businessName: biz.businessName,
              quoteRef: activeQuote?.ref || '',
              total: `£${fmt(totals.grandTotal)}`,
              quoteUrl: safeUrl,
              validityDays: settings.quoteConfig.validityDays,
              businessPhone: biz.phone,
              businessEmail: biz.email,
            })
            try {
              const result = await sendEmail({
                to: email,
                subject: quoteEmailData.subject,
                htmlBody: quoteEmailData.html,
                textBody: quoteEmailData.text,
                replyTo: biz.email,
                fromName: buildFromName(biz),
                orgId: user?.orgId || '',
                customerId: selectedCustomer?.id,
                templateName: 'Send Quote',
              })
              if (result.success) {
                emailMethod = result.method
                usedMethods.push(result.method === 'edge' ? 'Email (delivered)' : 'Email (via your client)')
              } else {
                hadFailure = true
              }
            } catch {
              hadFailure = true
            }
          }

          if (sendVia.whatsapp) {
            const phone = selectedCustomer?.phone?.replace(/\s/g, '').replace(/^0/, '44') || ''
            const greetName = selectedCustomer?.isBusiness && selectedCustomer?.contactName ? selectedCustomer.contactName.split(' ')[0] : customerName.split(' ')[0]
            const text = `Hi ${greetName}, here's your quote from ${settings.business.businessName}:\n\n${safeUrl}\n\nTotal: £${fmt(totals.grandTotal)} (inc. VAT)\n\nLet me know if you'd like to go ahead!`
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank')
            usedMethods.push('WhatsApp')
          }

          if (sendVia.link) {
            try {
              await copyToClipboard(safeUrl)
              usedMethods.push('Link copied')
            } catch {
              hadFailure = true
            }
          }

          setIsSending(false)

          if (hadFailure || usedMethods.length === 0) {
            setSendMsg(`Couldn't send via ${[sendVia.email && 'Email', sendVia.whatsapp && 'WhatsApp', sendVia.link && 'Link'].filter(Boolean).join(' + ')}. Please try again.`)
            return
          }

          // Auto-mark as sent
          updateQuote(activeQuoteId, { status: 'Sent', sentAt: new Date().toISOString().split('T')[0] })
          if (activeJobId) moveJob(activeJobId, 'Quoted')
          setSendMsg(`Sent via ${usedMethods.join(' + ')}${emailMethod === 'mailto' ? ' — finish sending in your email client' : ''}`)
          setSendConfirmed(true)
        }

        return (
          <>
            <div
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 200 }}
              onClick={() => { setShowSendModal(false); setSendVia({ email: false, whatsapp: false, link: false }); setSendMsg(''); setSendConfirmed(false) }}
            />
            <div style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              background: 'var(--color-charcoal-light)', borderRadius: 20, padding: 'clamp(20px, 5vw, 32px)',
              width: 'min(420px, calc(100vw - 24px))', maxHeight: 'calc(100dvh - 24px)', overflowY: 'auto',
              zIndex: 210, boxShadow: '0 16px 48px rgba(0,0,0,.5)',
            }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-white)', marginBottom: 4 }}>
                Send Quote
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-steel-light)', marginBottom: 20 }}>
                {activeQuote?.ref} · £{fmt(totals.grandTotal)} · {customerName}
              </div>

              {sendMsg && !sendConfirmed ? (
                <>
                  {/* ── Send failed ── */}
                  <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>
                      <Send size={36} color="#D46A6A" />
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-white)', marginBottom: 4 }}>
                      Couldn't send
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--color-steel-light)' }}>
                      {sendMsg}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSendMsg('') }}
                    className="qq-btn qq-btn--primary"
                    style={{ width: '100%' }}
                  >
                    Try again
                  </button>
                </>
              ) : sendConfirmed ? (
                <>
                  {/* ── Post-send success ── */}
                  <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>
                      <CheckCircle size={40} color="#6ABF8A" />
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-white)', marginBottom: 4 }}>
                      Quote {activeQuote?.ref} sent to {customerName}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--color-steel-light)', marginBottom: 2 }}>
                      {sendMsg} · Moved to Quoted in Jobs.
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
                      onClick={() => { setShowSendModal(false); setSendVia({ email: false, whatsapp: false, link: false }); setSendMsg(''); setSendConfirmed(false); navigate('/jobs') }}
                      className="qq-btn qq-btn--primary"
                      style={{ flex: 1 }}
                    >
                      View in Jobs
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSendModal(false); setSendVia({ email: false, whatsapp: false, link: false }); setSendMsg(''); setSendConfirmed(false)
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
                disabled={!anySelected || isSending || idIsPending}
                className="qq-btn qq-btn--primary"
                style={{
                  width: '100%', opacity: anySelected && !isSending && !idIsPending ? 1 : 0.4,
                  cursor: anySelected && !isSending && !idIsPending ? 'pointer' : 'not-allowed',
                }}
              >
                {idIsPending
                  ? 'Saving quote…'
                  : isSending
                    ? 'Sending…'
                    : `Send${anySelected ? ` via ${[sendVia.email && 'Email', sendVia.whatsapp && 'WhatsApp', sendVia.link && 'Link'].filter(Boolean).join(' + ')}` : ''}`}
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

      {/* ── Mobile sticky bar: panel dots + total ── */}
      <div
        className="qq-mobile-sticky-total"
        style={{
          display: 'none',
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'var(--color-charcoal)',
          borderTop: '1px solid var(--color-steel)',
          padding: '6px 16px',
          paddingBottom: 'calc(6px + env(safe-area-inset-bottom, 0))',
          zIndex: 50,
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {/* Panel dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '2px 0' }}>
          {[0, 1].map(i => (
            <button
              key={i}
              onClick={() => {
                pageRef.current?.scrollTo({ left: i * (pageRef.current?.clientWidth ?? 0), behavior: 'smooth' })
              }}
              style={{
                width: activePanel === i ? 20 : 8, height: 8, borderRadius: 4,
                border: 'none', cursor: 'pointer', padding: 0,
                background: activePanel === i ? 'var(--color-gold)' : 'rgba(75,80,87,0.5)',
                transition: 'width .2s, background .2s',
              }}
            />
          ))}
        </div>
        {/* Total + send */}
        {hasLines && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-gold)' }}>
                £{fmt(totals.grandTotal)}
              </div>
              <div style={{ fontSize: 10, color: 'var(--color-steel-light)' }}>
                inc. VAT · {lines.length} line{lines.length > 1 ? 's' : ''}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowSendModal(true)}
              className="qq-btn qq-btn--primary"
              style={{ padding: '8px 20px', fontSize: 13 }}
            >
              Send
            </button>
          </div>
        )}
      </div>
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
