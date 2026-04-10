/**
 * Quick Specs — 2-3 lightweight spec fields per job type that appear
 * inline in the QuickQuote page when the user selects a job type.
 *
 * These are the minimum questions needed to compute a defensible
 * ballpark price during a phone call. The full spec sheet (for post-
 * site-visit detailed quotes) is a future extension that builds on
 * these same fields.
 *
 * Each spec field affects the pricing via adjustments to the base
 * materials cost and/or labour hours — these adjustments are applied
 * BEFORE the difficulty/hassle/emergency multipliers.
 */

export interface QuickSpecField {
  key: string
  label: string
  type: 'number' | 'toggle' | 'select'
  /** Options for 'select' type */
  options?: { label: string; value: string }[]
  /** Default value */
  default: number | boolean | string
  /** For 'number' type: min/max range */
  min?: number
  max?: number
  /** Short hint shown below the field on mobile */
  hint?: string
  // ── Pricing contributions ──
  /** For number specs: £ added to materials PER UNIT of this spec */
  materialsPer?: number
  /** For number specs: minutes added to labour PER UNIT */
  labourMinsPer?: number
  /** For toggle specs: flat £ added to materials when ON */
  materialsAdder?: number
  /** For toggle specs: flat minutes added to labour when ON */
  labourMinsAdder?: number
  /** For select specs: map of option value → { materials, labourMins } adjustments */
  optionAdjustments?: Record<string, { materials?: number; labourMins?: number }>
}

export type QuickSpecValues = Record<string, number | boolean | string>

/**
 * Default quick specs per job type. Keyed by jobTypeId matching
 * the IDs in DEFAULT_JOB_TYPE_CONFIGS.
 */
export const QUICK_SPECS: Record<string, QuickSpecField[]> = {
  'lighting': [
    {
      key: 'fittings', label: 'Fittings', type: 'number',
      default: 4, min: 1, max: 30,
      hint: 'Number of light fittings',
      materialsPer: 15, labourMinsPer: 25,
    },
    {
      key: 'fittingType', label: 'Type', type: 'select',
      default: 'downlights',
      options: [
        { label: 'Downlights', value: 'downlights' },
        { label: 'Pendants', value: 'pendants' },
        { label: 'Wall Lights', value: 'wall' },
        { label: 'Outdoor', value: 'outdoor' },
        { label: 'LED Panels', value: 'panels' },
      ],
      optionAdjustments: {
        downlights: { materials: 0 },
        pendants: { materials: -5 },
        wall: { materials: 5 },
        outdoor: { materials: 20, labourMins: 15 },
        panels: { materials: 25, labourMins: 10 },
      },
    },
    {
      key: 'newCircuit', label: 'New circuit', type: 'toggle',
      default: false,
      hint: 'Requires running a new circuit from the board',
      materialsAdder: 60, labourMinsAdder: 90,
    },
  ],

  'consumer-unit': [
    {
      key: 'ways', label: 'Ways', type: 'select',
      default: '12',
      options: [
        { label: '6-way', value: '6' },
        { label: '8-way', value: '8' },
        { label: '12-way', value: '12' },
        { label: '16-way', value: '16' },
        { label: '20-way', value: '20' },
      ],
      optionAdjustments: {
        '6': { materials: -80 },
        '8': { materials: -40 },
        '12': { materials: 0 },
        '16': { materials: 60 },
        '20': { materials: 120, labourMins: 60 },
      },
    },
    {
      key: 'rcbos', label: 'RCBOs per circuit', type: 'toggle',
      default: false,
      hint: 'Individual protection per circuit (recommended)',
      // Cost scales with ways — approximated as flat adder
      materialsAdder: 144, labourMinsAdder: 30,
    },
    {
      key: 'scope', label: 'Scope', type: 'select',
      default: 'full',
      options: [
        { label: 'Full replacement', value: 'full' },
        { label: 'Upgrade existing', value: 'upgrade' },
      ],
      optionAdjustments: {
        full: {},
        upgrade: { labourMins: -120 },
      },
    },
  ],

  'ev-charger': [
    {
      key: 'rating', label: 'Rating', type: 'select',
      default: '7kw',
      options: [
        { label: '7kW', value: '7kw' },
        { label: '22kW', value: '22kw' },
      ],
      optionAdjustments: {
        '7kw': {},
        '22kw': { materials: 200, labourMins: 60 },
      },
    },
    {
      key: 'cableRun', label: 'Cable run (m)', type: 'number',
      default: 10, min: 1, max: 50,
      hint: 'Approximate metres from consumer unit',
      materialsPer: 3, labourMinsPer: 5,
    },
    {
      key: 'earthRod', label: 'Earth rod', type: 'toggle',
      default: false,
      hint: 'Required if no suitable earth at the board',
      materialsAdder: 65, labourMinsAdder: 45,
    },
  ],

  'rewire': [
    {
      key: 'bedrooms', label: 'Bedrooms', type: 'number',
      default: 3, min: 1, max: 8,
      hint: 'Number of bedrooms in the property',
      materialsPer: 80, labourMinsPer: 180,
    },
    {
      key: 'floors', label: 'Floors', type: 'select',
      default: '2',
      options: [
        { label: '1 floor', value: '1' },
        { label: '2 floors', value: '2' },
        { label: '3 floors', value: '3' },
      ],
      optionAdjustments: {
        '1': { labourMins: -240 },
        '2': {},
        '3': { labourMins: 240 },
      },
    },
    {
      key: 'includeCU', label: 'Include new CU', type: 'toggle',
      default: true,
      hint: 'New consumer unit as part of the rewire',
      materialsAdder: 320, labourMinsAdder: 240,
    },
  ],

  'eicr': [
    {
      key: 'propertyType', label: 'Property', type: 'select',
      default: 'house',
      options: [
        { label: 'Flat', value: 'flat' },
        { label: 'House', value: 'house' },
        { label: 'HMO', value: 'hmo' },
        { label: 'Commercial', value: 'commercial' },
      ],
      optionAdjustments: {
        flat: { labourMins: -60 },
        house: {},
        hmo: { labourMins: 60 },
        commercial: { labourMins: 90 },
      },
    },
    {
      key: 'circuits', label: 'Circuits', type: 'select',
      default: '10-20',
      options: [
        { label: '<10', value: '<10' },
        { label: '10–20', value: '10-20' },
        { label: '20+', value: '20+' },
      ],
      optionAdjustments: {
        '<10': { labourMins: -60 },
        '10-20': {},
        '20+': { labourMins: 90 },
      },
    },
  ],

  'fault-finding': [
    {
      key: 'issueType', label: 'Issue', type: 'select',
      default: 'tripping',
      options: [
        { label: 'Tripping', value: 'tripping' },
        { label: 'No power', value: 'nopower' },
        { label: 'Intermittent', value: 'intermittent' },
        { label: 'Burning smell', value: 'burning' },
        { label: 'Other', value: 'other' },
      ],
      optionAdjustments: {
        tripping: {},
        nopower: {},
        intermittent: { labourMins: 60 },
        burning: { labourMins: 30 },
        other: {},
      },
    },
    {
      key: 'circuitsAffected', label: 'Circuits', type: 'select',
      default: '1',
      options: [
        { label: '1 circuit', value: '1' },
        { label: '2–3', value: '2-3' },
        { label: 'Multiple', value: 'multiple' },
        { label: 'Whole property', value: 'whole' },
      ],
      optionAdjustments: {
        '1': {},
        '2-3': { labourMins: 30 },
        'multiple': { labourMins: 60 },
        'whole': { labourMins: 90 },
      },
    },
  ],

  'cctv': [
    {
      key: 'cameras', label: 'Cameras', type: 'number',
      default: 4, min: 1, max: 16,
      materialsPer: 60, labourMinsPer: 40,
    },
    {
      key: 'nvr', label: 'NVR/DVR included', type: 'toggle',
      default: true,
      hint: 'Recording unit for the cameras',
      materialsAdder: 120, labourMinsAdder: 60,
    },
    {
      key: 'resolution', label: 'Resolution', type: 'select',
      default: '4mp',
      options: [
        { label: '2MP', value: '2mp' },
        { label: '4MP', value: '4mp' },
        { label: '4K', value: '4k' },
      ],
      optionAdjustments: {
        '2mp': { materials: -15 },
        '4mp': {},
        '4k': { materials: 25 },
      },
    },
  ],

  'ethernet': [
    {
      key: 'points', label: 'Points', type: 'number',
      default: 4, min: 1, max: 24,
      materialsPer: 15, labourMinsPer: 35,
    },
    {
      key: 'cableGrade', label: 'Cable', type: 'select',
      default: 'cat6',
      options: [
        { label: 'Cat5e', value: 'cat5e' },
        { label: 'Cat6', value: 'cat6' },
        { label: 'Cat6a', value: 'cat6a' },
      ],
      optionAdjustments: {
        cat5e: { materials: -5 },
        cat6: {},
        cat6a: { materials: 10 },
      },
    },
  ],

  'smoke-detectors': [
    {
      key: 'units', label: 'Units', type: 'number',
      default: 4, min: 1, max: 12,
      materialsPer: 35, labourMinsPer: 25,
    },
    {
      key: 'wiring', label: 'Wiring', type: 'select',
      default: 'mains',
      options: [
        { label: 'Mains wired', value: 'mains' },
        { label: 'Battery', value: 'battery' },
      ],
      optionAdjustments: {
        mains: {},
        battery: { labourMins: -15 },
      },
    },
    {
      key: 'grade', label: 'Grade', type: 'select',
      default: 'd1',
      options: [
        { label: 'D1 (domestic)', value: 'd1' },
        { label: 'D2 (HMO/landlord)', value: 'd2' },
      ],
      optionAdjustments: {
        d1: {},
        d2: { materials: 15 },
      },
    },
  ],

  'smart-home': [
    {
      key: 'scope', label: 'Scope', type: 'select',
      default: 'lighting',
      options: [
        { label: 'Lighting only', value: 'lighting' },
        { label: 'Heating', value: 'heating' },
        { label: 'Security', value: 'security' },
        { label: 'Full integration', value: 'full' },
      ],
      optionAdjustments: {
        lighting: {},
        heating: { materials: 80, labourMins: 120 },
        security: { materials: 150, labourMins: 180 },
        full: { materials: 300, labourMins: 360 },
      },
    },
    {
      key: 'rooms', label: 'Rooms', type: 'number',
      default: 4, min: 1, max: 15,
      materialsPer: 30, labourMinsPer: 30,
    },
  ],

  'minor-works': [
    {
      key: 'workType', label: 'Work type', type: 'select',
      default: 'socket',
      options: [
        { label: 'Socket', value: 'socket' },
        { label: 'Switch', value: 'switch' },
        { label: 'Light fitting', value: 'light' },
        { label: 'Extractor fan', value: 'extractor' },
        { label: 'Outdoor socket', value: 'outdoor-socket' },
        { label: 'Cooker connection', value: 'cooker' },
        { label: 'Shower pull', value: 'shower-pull' },
        { label: 'Thermostat', value: 'thermostat' },
      ],
      optionAdjustments: {
        socket: {},
        switch: { materials: -10, labourMins: -15 },
        light: { materials: -5 },
        extractor: { materials: 40, labourMins: 30 },
        'outdoor-socket': { materials: 20, labourMins: 30 },
        cooker: { materials: 25, labourMins: 20 },
        'shower-pull': { materials: 5, labourMins: -10 },
        thermostat: { materials: 30, labourMins: 15 },
      },
    },
    {
      key: 'quantity', label: 'Quantity', type: 'number',
      default: 1, min: 1, max: 10,
      materialsPer: 0, labourMinsPer: 0,
      // Quantity is handled by the existing qty mechanism — this spec
      // just makes it visible in context. materialsPer/labourMinsPer
      // come from the job type base costs.
    },
    {
      key: 'newCircuit', label: 'New circuit', type: 'toggle',
      default: false,
      materialsAdder: 60, labourMinsAdder: 60,
    },
  ],

  // 'other' has no quick specs — uses the existing manual fields
}

/**
 * Compute the materials and labour adjustments from a set of spec values.
 * Returns ADDITIONAL materials (£) and labour (minutes) to add on top of
 * the base job-type costs.
 *
 * For 'number' specs: value × materialsPer / labourMinsPer
 * For 'toggle' specs: if true, add materialsAdder / labourMinsAdder
 * For 'select' specs: look up optionAdjustments[value]
 *
 * Note: for job types where the spec defines the CORE quantity (e.g.
 * lighting "fittings" or CCTV "cameras"), the base cost in JobTypeConfig
 * is per-unit. The spec quantity should REPLACE the line item's quantity
 * field, not add to it.
 */
export function computeSpecAdjustments(
  specDefs: QuickSpecField[],
  specValues: QuickSpecValues,
): { materialsAdj: number; labourMinsAdj: number; coreQuantity: number | null } {
  let materialsAdj = 0
  let labourMinsAdj = 0
  let coreQuantity: number | null = null

  for (const spec of specDefs) {
    const val = specValues[spec.key] ?? spec.default

    if (spec.type === 'number') {
      const n = Number(val) || 0
      // If this is the first number spec for the job type, treat it
      // as the core quantity (replaces the line's qty field).
      if (coreQuantity === null && (spec.materialsPer || spec.labourMinsPer)) {
        coreQuantity = n
      }
      if (spec.materialsPer) materialsAdj += n * spec.materialsPer
      if (spec.labourMinsPer) labourMinsAdj += n * spec.labourMinsPer
    }

    if (spec.type === 'toggle' && val === true) {
      if (spec.materialsAdder) materialsAdj += spec.materialsAdder
      if (spec.labourMinsAdder) labourMinsAdj += spec.labourMinsAdder
    }

    if (spec.type === 'select' && spec.optionAdjustments) {
      const adj = spec.optionAdjustments[String(val)]
      if (adj) {
        if (adj.materials) materialsAdj += adj.materials
        if (adj.labourMins) labourMinsAdj += adj.labourMins
      }
    }
  }

  return { materialsAdj, labourMinsAdj, coreQuantity }
}
