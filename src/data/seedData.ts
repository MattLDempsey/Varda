// ---------------------------------------------------------------------------
// Varda  --  Seed Data
// 3 years of realistic data for a self-employed electrician in Essex/Suffolk/Norfolk
// Deterministic: no Math.random() at import time
// ---------------------------------------------------------------------------

import type {
  Customer,
  Quote,
  QuoteStatus,
  Job,
  JobStatus,
  Invoice,
  InvoiceStatus,
  ScheduleEvent,
  EventSlot,
  EventStatus,
  CommLog,
} from './DataContext'

// ── Seeded PRNG (mulberry32) ─────────────────────────────────────────────────

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(42)

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)]
}

function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min
}

function randFloat(min: number, max: number, decimals = 2): number {
  const v = min + rand() * (max - min)
  const f = Math.pow(10, decimals)
  return Math.round(v * f) / f
}

function uuid(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(3, '0')}`
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

// ── Job type definitions ─────────────────────────────────────────────────────

interface JobTypeDef {
  id: string
  name: string
  certRequired: boolean
  priceRange: [number, number]   // net total range
  hoursRange: [number, number]
  materialPct: number            // materials as % of net
  seasonal?: 'summer' | 'winter' // bias
}

const JOB_TYPES: JobTypeDef[] = [
  { id: 'consumer-unit', name: 'Consumer Unit Upgrade', certRequired: true, priceRange: [500, 800], hoursRange: [5, 8], materialPct: 0.45 },
  { id: 'ev-charger', name: 'EV Charger Install', certRequired: true, priceRange: [800, 1200], hoursRange: [4, 7], materialPct: 0.40 },
  { id: 'fault-finding', name: 'Fault Finding', certRequired: false, priceRange: [150, 350], hoursRange: [1, 3], materialPct: 0.05 },
  { id: 'rewire', name: 'Rewire (per room)', certRequired: true, priceRange: [2000, 5000], hoursRange: [16, 40], materialPct: 0.35, seasonal: 'winter' },
  { id: 'lighting', name: 'Lighting Install', certRequired: false, priceRange: [100, 500], hoursRange: [1, 4], materialPct: 0.30, seasonal: 'summer' },
  { id: 'eicr', name: 'EICR', certRequired: true, priceRange: [200, 350], hoursRange: [2, 4], materialPct: 0.02 },
  { id: 'smart-home', name: 'Smart Home Install', certRequired: false, priceRange: [400, 1200], hoursRange: [4, 8], materialPct: 0.40 },
  { id: 'ethernet', name: 'Ethernet Wiring', certRequired: false, priceRange: [150, 500], hoursRange: [2, 5], materialPct: 0.35 },
  { id: 'smoke-detectors', name: 'Smoke Detectors', certRequired: false, priceRange: [80, 250], hoursRange: [1, 2], materialPct: 0.40 },
  { id: 'minor-works', name: 'Minor Works', certRequired: false, priceRange: [80, 300], hoursRange: [1, 3], materialPct: 0.20 },
]

// Weighted distribution — more common job types get more weight
const JOB_TYPE_WEIGHTS: { id: string; weight: number }[] = [
  { id: 'consumer-unit', weight: 12 },
  { id: 'ev-charger', weight: 10 },
  { id: 'fault-finding', weight: 15 },
  { id: 'rewire', weight: 8 },
  { id: 'lighting', weight: 18 },
  { id: 'eicr', weight: 12 },
  { id: 'smart-home', weight: 5 },
  { id: 'ethernet', weight: 6 },
  { id: 'smoke-detectors', weight: 8 },
  { id: 'minor-works', weight: 15 },
]

function pickJobType(month: number): JobTypeDef {
  const isSummer = month >= 4 && month <= 8 // May-Sep (0-indexed)
  const weights = JOB_TYPE_WEIGHTS.map(w => {
    const jt = JOB_TYPES.find(j => j.id === w.id)!
    let weight = w.weight
    if (jt.seasonal === 'summer' && isSummer) weight *= 2
    if (jt.seasonal === 'summer' && !isSummer) weight *= 0.5
    if (jt.seasonal === 'winter' && !isSummer) weight *= 1.8
    if (jt.seasonal === 'winter' && isSummer) weight *= 0.4
    return { id: w.id, weight }
  })
  const total = weights.reduce((s, w) => s + w.weight, 0)
  let r = rand() * total
  for (const w of weights) {
    r -= w.weight
    if (r <= 0) return JOB_TYPES.find(j => j.id === w.id)!
  }
  return JOB_TYPES[0]
}

// ── Customers ────────────────────────────────────────────────────────────────

const FIRST_NAMES = [
  'James', 'Sarah', 'David', 'Emma', 'Michael', 'Rachel', 'Andrew', 'Claire',
  'Robert', 'Helen', 'Mark', 'Karen', 'Paul', 'Laura', 'Simon', 'Joanne',
  'Chris', 'Lisa', 'Daniel', 'Fiona', 'Stephen', 'Natalie', 'Peter', 'Julie',
  'Tom', 'Sophie', 'Richard', 'Hannah', 'Ian', 'Nicola',
]

const LAST_NAMES = [
  'Thompson', 'Clarke', 'Patel', 'Woodward', 'Harris', 'Mitchell', 'Brown',
  'Taylor', 'Walker', 'Cooper', 'Hughes', 'Green', 'Wright', 'Evans', 'King',
  'Baker', 'Scott', 'Robinson', 'Lewis', 'Adams', 'Turner', 'Phillips',
  'Campbell', 'Morris', 'Bennett', 'Ward', 'Collins', 'Murphy', 'Price', 'Reed',
]

const STREETS = [
  'High Street', 'Mill Lane', 'Church Road', 'Station Road', 'Park Avenue',
  'The Green', 'Manor Road', 'Victoria Street', 'Queens Road', 'King Street',
  'Orchard Close', 'Meadow Way', 'Oak Drive', 'Elm Close', 'Cedar Avenue',
  'Willow Lane', 'Beech Road', 'Ash Grove', 'Holly Close', 'Hazel Drive',
  'Bridge Street', 'Chapel Lane', 'School Road', 'New Road', 'London Road',
  'North Street', 'South Road', 'West End', 'East Lane', 'Cross Street',
]

interface TownDef {
  town: string
  county: string
  postcodePrefix: string
}

const TOWNS: TownDef[] = [
  { town: 'Colchester', county: 'Essex', postcodePrefix: 'CO' },
  { town: 'Ipswich', county: 'Suffolk', postcodePrefix: 'IP' },
  { town: 'Bury St Edmunds', county: 'Suffolk', postcodePrefix: 'IP' },
  { town: 'Thetford', county: 'Norfolk', postcodePrefix: 'IP' },
  { town: 'Diss', county: 'Norfolk', postcodePrefix: 'IP' },
  { town: 'Braintree', county: 'Essex', postcodePrefix: 'CM' },
  { town: 'Chelmsford', county: 'Essex', postcodePrefix: 'CM' },
  { town: 'Sudbury', county: 'Suffolk', postcodePrefix: 'CO' },
  { town: 'Stowmarket', county: 'Suffolk', postcodePrefix: 'IP' },
  { town: 'Hadleigh', county: 'Suffolk', postcodePrefix: 'IP' },
  { town: 'Manningtree', county: 'Essex', postcodePrefix: 'CO' },
  { town: 'Halstead', county: 'Essex', postcodePrefix: 'CO' },
  { town: 'Needham Market', county: 'Suffolk', postcodePrefix: 'IP' },
  { town: 'Woodbridge', county: 'Suffolk', postcodePrefix: 'IP' },
  { town: 'Felixstowe', county: 'Suffolk', postcodePrefix: 'IP' },
  { town: 'Norwich', county: 'Norfolk', postcodePrefix: 'NR' },
  { town: 'Clacton-on-Sea', county: 'Essex', postcodePrefix: 'CO' },
  { town: 'Witham', county: 'Essex', postcodePrefix: 'CM' },
  { town: 'Long Melford', county: 'Suffolk', postcodePrefix: 'CO' },
  { town: 'Framlingham', county: 'Suffolk', postcodePrefix: 'IP' },
]

function makePostcode(prefix: string): string {
  const num = randInt(1, 16)
  const suffix = `${randInt(1, 9)}${pick('ABCDEFGHJKLMNPRSTUVWXYZ'.split(''))}${pick('ABCDEFGHJKLMNPRSTUVWXYZ'.split(''))}`
  return `${prefix}${num} ${suffix}`
}

function makePhone(): string {
  return `07${randInt(700, 999)} ${randInt(100000, 999999)}`
}

function makeEmail(first: string, last: string): string {
  const domains = ['gmail.com', 'hotmail.co.uk', 'outlook.com', 'yahoo.co.uk', 'icloud.com', 'btinternet.com']
  const sep = pick(['.', '_', ''])
  return `${first.toLowerCase()}${sep}${last.toLowerCase()}@${pick(domains)}`
}

const customers: Customer[] = []

for (let i = 0; i < 30; i++) {
  const first = FIRST_NAMES[i]
  const last = LAST_NAMES[i]
  const town = TOWNS[i % TOWNS.length]
  const houseNum = randInt(1, 120)
  const street = STREETS[i % STREETS.length]

  // Stagger customer creation dates across the 3 years
  const monthOffset = Math.floor(i * 1.2) // spread across ~36 months
  const createdYear = 2023 + Math.floor(monthOffset / 12)
  const createdMonth = (3 + (monthOffset % 12)) % 12 // start from April
  const createdDay = randInt(1, Math.min(28, daysInMonth(createdYear, createdMonth)))
  const createdAt = `${createdYear}-${String(createdMonth + 1).padStart(2, '0')}-${String(createdDay).padStart(2, '0')}`

  customers.push({
    id: uuid('C', i + 1),
    name: `${first} ${last}`,
    phone: makePhone(),
    email: makeEmail(first, last),
    address1: `${houseNum} ${street}`,
    address2: '',
    city: town.town,
    postcode: makePostcode(town.postcodePrefix),
    notes: i < 5 ? pick([
      'Regular customer, always pays on time',
      'Referred by previous customer',
      'Found us on Google',
      'Prefers WhatsApp communication',
      'Has dogs — call before arriving',
    ]) : '',
    createdAt,
  })
}

// ── Revenue targets per year ─────────────────────────────────────────────────
// Year 1 (Apr 2023 - Mar 2024): ~£42k
// Year 2 (Apr 2024 - Mar 2025): ~£56k
// Year 3 (Apr 2025 - Mar 2026): ~£70k

interface MonthPlan {
  year: number
  month: number   // 0-indexed
  jobCount: number
  revenueTarget: number
}

function buildMonthlyPlan(): MonthPlan[] {
  const plans: MonthPlan[] = []

  const yearTargets = [
    { startYear: 2023, startMonth: 3, revenue: 42000 }, // Apr 2023
    { startYear: 2024, startMonth: 3, revenue: 56000 }, // Apr 2024
    { startYear: 2025, startMonth: 3, revenue: 70000 }, // Apr 2025
  ]

  // Seasonal weights by month (0=Jan to 11=Dec)
  const seasonalWeights = [0.7, 0.7, 0.85, 0.95, 1.1, 1.2, 1.3, 1.25, 1.15, 1.0, 0.85, 0.6]

  for (const yt of yearTargets) {
    const totalWeight = seasonalWeights.reduce((a, b) => a + b, 0)
    for (let m = 0; m < 12; m++) {
      const actualMonth = (yt.startMonth + m) % 12
      const actualYear = yt.startYear + Math.floor((yt.startMonth + m) / 12)

      // Don't generate data past April 2026
      if (actualYear > 2026) continue
      if (actualYear === 2026 && actualMonth > 3) continue

      const monthRevenue = (yt.revenue * seasonalWeights[actualMonth]) / totalWeight
      const avgJobValue = 350 + (yt.revenue / 42000 - 1) * 50 // slightly higher avg as business grows
      const jobCount = Math.max(3, Math.round(monthRevenue / avgJobValue))

      plans.push({
        year: actualYear,
        month: actualMonth,
        jobCount,
        revenueTarget: monthRevenue,
      })
    }
  }

  return plans
}

// ── Generate jobs, quotes, invoices ──────────────────────────────────────────

const quotes: Quote[] = []
const jobs: Job[] = []
const invoices: Invoice[] = []
const events: ScheduleEvent[] = []
const comms: CommLog[] = []

let quoteNum = 1001
let jobNum = 1
let invoiceNum = 1
let eventNum = 1
let commNum = 1

const today = '2026-04-07'

// Track which customers have been used, for repeat customers
const customerJobCounts: Record<string, number> = {}
// Repeat customers: indices 0-9 can be reused
const repeatCustomerIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

function pickCustomerForDate(dateStr: string): Customer {
  // 40% chance of picking a repeat customer
  if (rand() < 0.4 && repeatCustomerIndices.length > 0) {
    const idx = pick(repeatCustomerIndices)
    const c = customers[idx]
    // Only if customer was created before this date
    if (c.createdAt <= dateStr) {
      customerJobCounts[c.id] = (customerJobCounts[c.id] || 0) + 1
      return c
    }
  }
  // Otherwise pick any customer created before this date
  const eligible = customers.filter(c => c.createdAt <= dateStr)
  if (eligible.length === 0) return customers[0]
  const c = pick(eligible)
  customerJobCounts[c.id] = (customerJobCounts[c.id] || 0) + 1
  return c
}

const QUOTE_DESCRIPTIONS: Record<string, string[]> = {
  'consumer-unit': [
    'Replace old fuse board with 18th Edition consumer unit',
    'Upgrade consumer unit with RCBO protection',
    'Consumer unit replacement — current unit has no RCD protection',
    'New consumer unit with surge protection',
  ],
  'ev-charger': [
    'Install 7kW EV charger on driveway wall',
    'EV charge point installation — garage side wall',
    'Ohme Home Pro charger install with dedicated circuit',
    'Zappi V2 charger installation with solar diverter',
  ],
  'fault-finding': [
    'Intermittent tripping on lighting circuit',
    'Socket circuit dead — investigate and repair',
    'Buzzing noise from consumer unit',
    'Light switch arcing — diagnose and repair',
    'Power keeps tripping when using kitchen appliances',
  ],
  'rewire': [
    'Full rewire of 3-bed semi — 6 rooms',
    'Partial rewire — downstairs only (3 rooms)',
    'Full rewire of 2-bed bungalow — 5 rooms',
    'Rewire of 4-bed detached — 8 rooms',
    'Kitchen and bathroom rewire — 2 rooms',
  ],
  'lighting': [
    'Install 6x downlights in kitchen',
    'Garden lighting — 4 bollard lights and 2 wall lights',
    'Replace pendant lights with LED downlights in lounge',
    'Outdoor security lighting — 2x PIR floodlights',
    'Under-cabinet lighting in kitchen — LED strip',
    'Bathroom lighting upgrade — IP65 rated fittings',
  ],
  'eicr': [
    'EICR — landlord certificate for rental property',
    'Electrical condition report — pre-purchase survey',
    'EICR for insurance purposes',
    'Periodic inspection — 5-year check',
  ],
  'smart-home': [
    'Install Hive smart heating system',
    'Smart lighting setup — 12 Hue bulbs with bridge',
    'Ring doorbell and 2x security cameras',
    'Full smart home setup — lights, heating, and security',
  ],
  'ethernet': [
    'Run Cat6 to home office — 2 points',
    'Ethernet wiring to 4 rooms for home network',
    'Cat6a install to loft office and lounge',
    'Network point installation — 3 drops to ground floor',
  ],
  'smoke-detectors': [
    'Install 4x mains-wired smoke detectors',
    'Smoke and CO detector installation — 3 floors',
    'Replace smoke detectors — 5x units',
    'Fire alarm system upgrade — mains-wired with battery backup',
  ],
  'minor-works': [
    'Add double socket in home office',
    'Move light switch position in hallway',
    'Install outside socket for garden',
    'Add USB sockets in kitchen',
    'Replace damaged socket outlets in lounge',
    'Install towel rail in bathroom',
    'Add spur for new appliance in utility room',
  ],
}

const monthlyPlan = buildMonthlyPlan()

for (const mp of monthlyPlan) {
  const monthStr = `${mp.year}-${String(mp.month + 1).padStart(2, '0')}`
  const maxDay = daysInMonth(mp.year, mp.month)

  for (let j = 0; j < mp.jobCount; j++) {
    const day = randInt(1, maxDay)
    const dateStr = `${monthStr}-${String(day).padStart(2, '0')}`

    const customer = pickCustomerForDate(dateStr)
    const jobType = pickJobType(mp.month)
    const isEmergency = rand() < 0.05
    const isOutOfHours = isEmergency ? rand() < 0.5 : false

    // Pricing
    const netTotal = randFloat(jobType.priceRange[0], jobType.priceRange[1], 0)
    const materials = Math.round(netTotal * jobType.materialPct)
    const certFee = jobType.certRequired ? 85 : 0
    const labour = netTotal - materials - certFee
    const waste = Math.round(materials * 0.05)
    const subtotal = materials + labour + certFee + waste
    const adjustments = netTotal - subtotal
    const vat = Math.round(netTotal * 0.2 * 100) / 100
    const grandTotal = netTotal + vat
    const estHours = randFloat(jobType.hoursRange[0], jobType.hoursRange[1], 1)
    const margin = labour > 0 ? Math.round((labour / netTotal) * 100) / 100 : 0.3

    const difficulty = randInt(20, 80)
    const hassleFactor = randInt(10, 60)
    const quantity = jobType.id === 'rewire' ? randInt(2, 8) :
                     jobType.id === 'lighting' ? randInt(2, 8) :
                     jobType.id === 'ethernet' ? randInt(2, 4) :
                     jobType.id === 'smoke-detectors' ? randInt(3, 6) : 1

    const description = pick(QUOTE_DESCRIPTIONS[jobType.id] || ['General electrical work'])

    // Determine if this is a recent or historical job
    const isRecent = dateStr >= '2026-03-01'
    const isVeryRecent = dateStr >= '2026-04-01'
    const isFuture = dateStr > today

    // About 15% of quotes are lost (expired/declined)
    const isLostQuote = rand() < 0.15

    // Determine statuses
    let quoteStatus: QuoteStatus
    let jobStatus: JobStatus
    let invoiceStatus: InvoiceStatus | null = null

    if (isFuture) {
      quoteStatus = pick(['Accepted', 'Sent', 'Draft'])
      jobStatus = quoteStatus === 'Accepted' ? 'Scheduled' : quoteStatus === 'Sent' ? 'Quoted' : 'Lead'
    } else if (isLostQuote) {
      quoteStatus = rand() < 0.6 ? 'Expired' : 'Declined'
      jobStatus = 'Quoted' // stays at quoted
    } else if (isVeryRecent) {
      // Recent jobs in various stages
      const r = rand()
      if (r < 0.15) {
        quoteStatus = 'Draft'
        jobStatus = 'Lead'
      } else if (r < 0.3) {
        quoteStatus = 'Sent'
        jobStatus = 'Quoted'
      } else if (r < 0.45) {
        quoteStatus = 'Accepted'
        jobStatus = 'Accepted'
      } else if (r < 0.6) {
        quoteStatus = 'Accepted'
        jobStatus = 'Scheduled'
      } else if (r < 0.7) {
        quoteStatus = 'Accepted'
        jobStatus = 'In Progress'
      } else if (r < 0.85) {
        quoteStatus = 'Accepted'
        jobStatus = 'Complete'
        invoiceStatus = 'Draft'
      } else {
        quoteStatus = 'Accepted'
        jobStatus = 'Invoiced'
        invoiceStatus = 'Sent'
      }
    } else if (isRecent) {
      // March 2026 — most paid, some in progress
      const r = rand()
      if (r < 0.7) {
        quoteStatus = 'Accepted'
        jobStatus = 'Paid'
        invoiceStatus = 'Paid'
      } else if (r < 0.85) {
        quoteStatus = 'Accepted'
        jobStatus = 'Invoiced'
        invoiceStatus = rand() < 0.5 ? 'Sent' : 'Overdue'
      } else {
        quoteStatus = 'Accepted'
        jobStatus = 'Complete'
        invoiceStatus = 'Draft'
      }
    } else {
      // Historical — all paid
      quoteStatus = 'Accepted'
      jobStatus = 'Paid'
      invoiceStatus = 'Paid'
    }

    // Build quote
    const qId = uuid('Q', quoteNum)
    const qRef = `GH-Q${quoteNum}`
    quoteNum++

    const quoteCreatedAt = addDays(dateStr, -randInt(3, 14))
    const sentAt = quoteStatus !== 'Draft' ? addDays(quoteCreatedAt, randInt(0, 2)) : undefined
    const viewedAt = sentAt && quoteStatus !== 'Sent' ? addDays(sentAt, randInt(0, 3)) : undefined
    const acceptedAt = quoteStatus === 'Accepted' ? addDays(viewedAt || quoteCreatedAt, randInt(0, 5)) : undefined

    const quote: Quote = {
      id: qId,
      ref: qRef,
      customerId: customer.id,
      customerName: customer.name,
      jobTypeId: jobType.id,
      jobTypeName: jobType.name,
      description,
      quantity,
      difficulty,
      hassleFactor,
      emergency: isEmergency,
      outOfHours: isOutOfHours,
      certRequired: jobType.certRequired,
      customerSuppliesMaterials: false,
      notes: isEmergency ? 'Emergency callout — customer has no power' : '',
      materials,
      labour: Math.max(0, labour),
      certificates: certFee,
      waste,
      subtotal,
      adjustments: Math.round(adjustments),
      netTotal,
      vat,
      grandTotal: Math.round(grandTotal * 100) / 100,
      margin,
      estHours,
      status: quoteStatus,
      createdAt: quoteCreatedAt,
      sentAt,
      viewedAt,
      acceptedAt,
    }
    quotes.push(quote)

    // Build job (skip creating job for lost quotes)
    if (!isLostQuote) {
      const jId = uuid('J', jobNum)
      jobNum++

      const actualHours = jobStatus === 'Complete' || jobStatus === 'Invoiced' || jobStatus === 'Paid'
        ? randFloat(estHours * 0.8, estHours * 1.3, 1)
        : undefined

      let invoiceId: string | undefined

      // Build invoice if needed
      if (invoiceStatus) {
        const invId = uuid('INV', invoiceNum)
        const invRef = `GH-INV${String(invoiceNum).padStart(3, '0')}`
        invoiceNum++

        const invCreatedAt = jobStatus === 'Paid' ? addDays(dateStr, randInt(0, 3)) :
                             jobStatus === 'Invoiced' ? addDays(dateStr, randInt(0, 2)) :
                             dateStr
        const invSentAt = invoiceStatus !== 'Draft' ? addDays(invCreatedAt, randInt(0, 2)) : undefined
        const dueDate = addDays(invSentAt || invCreatedAt, 30)
        const paidAt = invoiceStatus === 'Paid' ? addDays(invSentAt || invCreatedAt, randInt(3, 28)) : undefined

        invoices.push({
          id: invId,
          ref: invRef,
          jobId: jId,
          quoteId: qId,
          customerId: customer.id,
          customerName: customer.name,
          jobTypeName: jobType.name,
          description,
          netTotal,
          vat,
          grandTotal: Math.round(grandTotal * 100) / 100,
          status: invoiceStatus,
          createdAt: invCreatedAt,
          sentAt: invSentAt,
          paidAt,
          dueDate,
        })

        invoiceId = invId

        // Comms for invoice
        if (invSentAt) {
          comms.push({
            id: uuid('CM', commNum++),
            customerId: customer.id,
            customerName: customer.name,
            templateName: 'Invoice Sent',
            channel: rand() < 0.6 ? 'email' : 'whatsapp',
            status: 'Delivered',
            date: invSentAt,
            body: `Invoice ${invRef} for £${grandTotal.toFixed(2)} has been sent. Payment due by ${dueDate}.`,
          })
        }

        if (paidAt) {
          comms.push({
            id: uuid('CM', commNum++),
            customerId: customer.id,
            customerName: customer.name,
            templateName: 'Payment Received',
            channel: 'email',
            status: 'Delivered',
            date: paidAt,
            body: `Payment of £${grandTotal.toFixed(2)} received for invoice ${invRef}. Thank you!`,
          })
        }
      }

      const job: Job = {
        id: jId,
        customerId: customer.id,
        customerName: customer.name,
        quoteId: qId,
        invoiceId,
        jobType: jobType.name,
        value: grandTotal,
        estimatedHours: estHours,
        actualHours,
        status: jobStatus,
        date: dateStr,
        notes: description,
        createdAt: quoteCreatedAt,
      }
      jobs.push(job)

      // Determine slot for scheduling
      const slot: EventSlot = estHours > 5 ? 'full' : rand() < 0.5 ? 'morning' : 'afternoon'

      // Schedule event for scheduled / in progress jobs
      if (jobStatus === 'Scheduled' || jobStatus === 'In Progress') {
        const evStatus: EventStatus = jobStatus === 'In Progress' ? 'In Progress' : 'Scheduled'

        events.push({
          id: uuid('E', eventNum++),
          jobId: jId,
          customerId: customer.id,
          customerName: customer.name,
          jobType: jobType.name,
          date: dateStr,
          slot,
          status: evStatus,
          notes: description,
        })
      }

      // Comms for quote sent
      if (sentAt) {
        comms.push({
          id: uuid('CM', commNum++),
          customerId: customer.id,
          customerName: customer.name,
          templateName: 'Quote Sent',
          channel: rand() < 0.5 ? 'email' : 'whatsapp',
          status: 'Delivered',
          date: sentAt,
          body: `Hi ${customer.name.split(' ')[0]}, your quote ${qRef} for ${jobType.name} (£${grandTotal.toFixed(2)} inc. VAT) is ready. Let me know if you have any questions.`,
        })
      }

      // Appointment reminders for recent scheduled jobs
      if ((jobStatus === 'Scheduled' || jobStatus === 'In Progress') && dateStr >= '2026-03-20') {
        const reminderDate = addDays(dateStr, -1)
        comms.push({
          id: uuid('CM', commNum++),
          customerId: customer.id,
          customerName: customer.name,
          templateName: 'Appointment Reminder',
          channel: 'whatsapp',
          status: rand() < 0.8 ? 'Read' : 'Delivered',
          date: reminderDate,
          body: `Hi ${customer.name.split(' ')[0]}, just a reminder about your ${jobType.name} appointment tomorrow. I'll be with you ${slot === 'morning' ? 'between 8-12' : slot === 'afternoon' ? 'between 12-5' : 'for the full day'}. Cheers, Matt`,
        })
      }

      // Job complete comms for recently completed jobs
      if (jobStatus === 'Complete' && dateStr >= '2026-03-15') {
        comms.push({
          id: uuid('CM', commNum++),
          customerId: customer.id,
          customerName: customer.name,
          templateName: 'Job Complete',
          channel: 'email',
          status: 'Delivered',
          date: dateStr,
          body: `Hi ${customer.name.split(' ')[0]}, your ${jobType.name} has been completed. ${jobType.certRequired ? 'Your electrical certificate will follow shortly. ' : ''}Thanks for choosing Grey Havens Electrical.`,
        })
      }
    } else {
      // Lost quote — still create quote sent comm
      if (sentAt) {
        comms.push({
          id: uuid('CM', commNum++),
          customerId: customer.id,
          customerName: customer.name,
          templateName: 'Quote Sent',
          channel: rand() < 0.5 ? 'email' : 'whatsapp',
          status: 'Delivered',
          date: sentAt,
          body: `Hi ${customer.name.split(' ')[0]}, your quote ${qRef} for ${jobType.name} (£${grandTotal.toFixed(2)} inc. VAT) is ready. Let me know if you have any questions.`,
        })
      }

      // Follow up comm for expired quotes
      if (quoteStatus === 'Expired') {
        const followUpDate = addDays(sentAt || quoteCreatedAt, randInt(7, 21))
        comms.push({
          id: uuid('CM', commNum++),
          customerId: customer.id,
          customerName: customer.name,
          templateName: 'Follow Up',
          channel: 'whatsapp',
          status: rand() < 0.6 ? 'Read' : 'Delivered',
          date: followUpDate,
          body: `Hi ${customer.name.split(' ')[0]}, just following up on the quote I sent over for ${jobType.name}. Happy to answer any questions or adjust if needed. Cheers, Matt`,
        })
      }
    }
  }
}

// ── Add a few future schedule events (next 2 weeks) ──────────────────────────

const futureJobTypes = [
  { name: 'Consumer Unit Upgrade', hours: 6 },
  { name: 'EV Charger Install', hours: 5 },
  { name: 'EICR', hours: 3 },
  { name: 'Lighting Install', hours: 3 },
  { name: 'Minor Works', hours: 2 },
]

for (let d = 1; d <= 10; d++) {
  const dateStr = addDays(today, d)
  const dayOfWeek = new Date(dateStr + 'T00:00:00Z').getUTCDay()
  if (dayOfWeek === 0 || dayOfWeek === 6) continue // skip weekends

  const jt = futureJobTypes[d % futureJobTypes.length]
  const customer = customers[d % customers.length]
  const slot: EventSlot = jt.hours > 5 ? 'full' : d % 2 === 0 ? 'morning' : 'afternoon'

  events.push({
    id: uuid('E', eventNum++),
    jobId: jobs.length > d ? jobs[jobs.length - d]?.id : undefined,
    customerId: customer.id,
    customerName: customer.name,
    jobType: jt.name,
    date: dateStr,
    slot,
    status: 'Scheduled',
    notes: `Booked ${jt.name} for ${customer.name}`,
  })
}

// ── Sort everything by date ──────────────────────────────────────────────────

quotes.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
jobs.sort((a, b) => a.date.localeCompare(b.date))
invoices.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
events.sort((a, b) => a.date.localeCompare(b.date))
comms.sort((a, b) => a.date.localeCompare(b.date))

// ── Exports ──────────────────────────────────────────────────────────────────

export const seedCustomers: Customer[] = customers
export const seedQuotes: Quote[] = quotes
export const seedJobs: Job[] = jobs
export const seedInvoices: Invoice[] = invoices
export const seedEvents: ScheduleEvent[] = events
export const seedComms: CommLog[] = comms

// Counters for DataContext to continue numbering from
export const seedCounters = {
  nextQuoteNum: quoteNum,
  nextJobNum: jobNum,
  nextInvoiceNum: invoiceNum,
  nextEventNum: eventNum,
  nextCommNum: commNum,
  nextCustomerNum: 31,
}
