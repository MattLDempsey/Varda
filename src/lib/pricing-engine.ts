// ---------------------------------------------------------------------------
// Varda  --  Pricing Engine (pure TypeScript, zero React deps)
// ---------------------------------------------------------------------------

// ---- Types ----------------------------------------------------------------

export interface JobType {
  id: string;
  name: string;
  baseMaterialCost: number;
  baseHours: number;
  isPerUnit: boolean;
  certRequired: boolean;
  minCharge?: number;
}

export interface PricingRules {
  labourRatePerHour: number;
  marginTarget: number;
  vatRate: number;
  emergencyMultiplier: number;
  outOfHoursMultiplier: number;
  difficultyMin: number;
  difficultyMax: number;
  hassleMin: number;
  hassleMax: number;
  certFee: number;
  wastePct: number;
}

export interface QuoteInput {
  jobType: JobType;
  quantity: number;
  difficulty: number; // 0-100
  hassleFactor: number; // 0-100
  isEmergency: boolean;
  isOutOfHours: boolean;
  needsCertificate: boolean;
  customerSuppliesMaterials: boolean;
  customMaterialsCost?: number;
  notes?: string;
}

export interface QuoteLineItem {
  description: string;
  category: 'materials' | 'labour' | 'certs' | 'waste' | 'other';
  unitCost: number;
  quantity: number;
  total: number;
}

export interface QuoteOutput {
  lineItems: QuoteLineItem[];
  materialsTotal: number;
  labourTotal: number;
  certsTotal: number;
  wasteTotal: number;
  subtotal: number;
  difficultyAdjustment: number;
  hassleAdjustment: number;
  emergencyAdjustment: number;
  outOfHoursAdjustment: number;
  adjustmentsTotal: number;
  netTotal: number;
  vatAmount: number;
  grandTotal: number;
  marginPct: number;
  effectiveDayRate: number;
  estimatedHours: number;
  priceRange: { low: number; high: number };
}

// ---- Defaults -------------------------------------------------------------

export const DEFAULT_PRICING_RULES: PricingRules = {
  labourRatePerHour: 55,
  marginTarget: 0.3,
  vatRate: 0.2,
  emergencyMultiplier: 1.75,
  outOfHoursMultiplier: 1.5,
  difficultyMin: 1.0,
  difficultyMax: 2.0,
  hassleMin: 1.0,
  hassleMax: 1.6,
  certFee: 85,
  wastePct: 0.05,
};

export const DEFAULT_JOB_TYPES: JobType[] = [
  { id: 'consumer-unit', name: 'Consumer Unit Upgrade', baseMaterialCost: 320, baseHours: 6, isPerUnit: false, certRequired: true },
  { id: 'ev-charger', name: 'EV Charger Install', baseMaterialCost: 450, baseHours: 5, isPerUnit: false, certRequired: true },
  { id: 'fault-finding', name: 'Fault Finding', baseMaterialCost: 10, baseHours: 2, isPerUnit: false, certRequired: false, minCharge: 150 },
  { id: 'rewire', name: 'Rewire (per room)', baseMaterialCost: 180, baseHours: 8, isPerUnit: true, certRequired: true },
  { id: 'lighting', name: 'Lighting Install', baseMaterialCost: 15, baseHours: 0.5, isPerUnit: true, certRequired: false },
  { id: 'eicr', name: 'EICR', baseMaterialCost: 0, baseHours: 3, isPerUnit: false, certRequired: true },
  { id: 'smart-home', name: 'Smart Home Install', baseMaterialCost: 200, baseHours: 6, isPerUnit: false, certRequired: false },
  { id: 'ethernet', name: 'Ethernet Wiring', baseMaterialCost: 60, baseHours: 1.5, isPerUnit: true, certRequired: false },
  { id: 'smoke-detectors', name: 'Smoke Detectors', baseMaterialCost: 35, baseHours: 0.5, isPerUnit: true, certRequired: false },
  { id: 'emergency', name: 'Emergency Callout', baseMaterialCost: 0, baseHours: 1, isPerUnit: false, certRequired: false, minCharge: 150 },
  { id: 'minor-works', name: 'Minor Works', baseMaterialCost: 20, baseHours: 1, isPerUnit: false, certRequired: false },
  { id: 'cctv', name: 'CCTV Installation', baseMaterialCost: 150, baseHours: 4, isPerUnit: false, certRequired: false },
];

// ---- Helpers --------------------------------------------------------------

/** Linear interpolation between a and b by factor t (0-1). */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamp n between lo and hi. */
function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Round to 2 decimal places. */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---- Core calculation -----------------------------------------------------

export function calculateQuote(
  input: QuoteInput,
  rules: PricingRules = DEFAULT_PRICING_RULES,
): QuoteOutput {
  const { jobType, quantity, difficulty, hassleFactor } = input;
  const lineItems: QuoteLineItem[] = [];

  // 1. Materials
  const rawMaterialsCost =
    input.customMaterialsCost != null
      ? input.customMaterialsCost
      : jobType.baseMaterialCost * quantity;

  let materialsTotal = input.customerSuppliesMaterials ? 0 : rawMaterialsCost;

  if (materialsTotal > 0) {
    lineItems.push({
      description:
        input.customMaterialsCost != null
          ? 'Custom materials'
          : `${jobType.name} materials` +
            (quantity > 1 ? ` x${quantity}` : ''),
      category: 'materials',
      unitCost: r2(materialsTotal / quantity),
      quantity,
      total: r2(materialsTotal),
    });
  }

  // 2. Base hours & labour
  const baseHours = jobType.baseHours * quantity;

  // 4. Difficulty multiplier on labour
  const diffT = clamp(difficulty, 0, 100) / 100;
  const difficultyMultiplier = lerp(rules.difficultyMin, rules.difficultyMax, diffT);

  const baseLab = baseHours * rules.labourRatePerHour;
  const labourAfterDifficulty = baseLab * difficultyMultiplier;
  const difficultyAdjustment = r2(labourAfterDifficulty - baseLab);

  // 9. Emergency multiplier (applied to labour)
  let emergencyAdjustment = 0;
  let labourAfterEmergency = labourAfterDifficulty;
  if (input.isEmergency) {
    labourAfterEmergency = labourAfterDifficulty * rules.emergencyMultiplier;
    emergencyAdjustment = r2(labourAfterEmergency - labourAfterDifficulty);
  }

  // 10. Out-of-hours multiplier (applied to labour)
  let outOfHoursAdjustment = 0;
  let labourFinal = labourAfterEmergency;
  if (input.isOutOfHours) {
    labourFinal = labourAfterEmergency * rules.outOfHoursMultiplier;
    outOfHoursAdjustment = r2(labourFinal - labourAfterEmergency);
  }

  const labourTotal = r2(labourFinal);

  lineItems.push({
    description:
      `Labour – ${baseHours}h @ ${rules.labourRatePerHour}/h` +
      (difficultyMultiplier !== 1 ? ` (diff x${difficultyMultiplier.toFixed(2)})` : ''),
    category: 'labour',
    unitCost: rules.labourRatePerHour,
    quantity: r2(baseHours),
    total: labourTotal,
  });

  if (emergencyAdjustment !== 0) {
    lineItems.push({
      description: `Emergency call-out (x${rules.emergencyMultiplier})`,
      category: 'labour',
      unitCost: emergencyAdjustment,
      quantity: 1,
      total: emergencyAdjustment,
    });
  }

  if (outOfHoursAdjustment !== 0) {
    lineItems.push({
      description: `Out-of-hours (x${rules.outOfHoursMultiplier})`,
      category: 'labour',
      unitCost: outOfHoursAdjustment,
      quantity: 1,
      total: outOfHoursAdjustment,
    });
  }

  // 5. Cert fee
  let certsTotal = 0;
  if (input.needsCertificate || jobType.certRequired) {
    certsTotal = rules.certFee;
    lineItems.push({
      description: 'Certification / notification fee',
      category: 'certs',
      unitCost: rules.certFee,
      quantity: 1,
      total: rules.certFee,
    });
  }

  // 6. Waste
  const wasteTotal = r2(materialsTotal * rules.wastePct);
  if (wasteTotal > 0) {
    lineItems.push({
      description: `Waste & sundries (${(rules.wastePct * 100).toFixed(0)}%)`,
      category: 'waste',
      unitCost: wasteTotal,
      quantity: 1,
      total: wasteTotal,
    });
  }

  // 7. Subtotal (before hassle)
  const subtotal = r2(materialsTotal + labourTotal + certsTotal + wasteTotal);

  // 8. Hassle factor on subtotal
  const hassleT = clamp(hassleFactor, 0, 100) / 100;
  const hassleMultiplier = lerp(rules.hassleMin, rules.hassleMax, hassleT);
  const hassleAdjustment = r2(subtotal * (hassleMultiplier - 1));

  if (hassleAdjustment !== 0) {
    lineItems.push({
      description: `Hassle / access factor (x${hassleMultiplier.toFixed(2)})`,
      category: 'other',
      unitCost: hassleAdjustment,
      quantity: 1,
      total: hassleAdjustment,
    });
  }

  // Totals
  const adjustmentsTotal = r2(
    difficultyAdjustment + hassleAdjustment + emergencyAdjustment + outOfHoursAdjustment,
  );

  let netTotal = r2(subtotal + hassleAdjustment);

  // Enforce min charge
  if (jobType.minCharge != null && netTotal < jobType.minCharge) {
    netTotal = jobType.minCharge;
  }

  // 12. VAT
  const vatAmount = r2(netTotal * rules.vatRate);
  const grandTotal = r2(netTotal + vatAmount);

  // 13. Margin & day rate
  const totalCosts = materialsTotal + wasteTotal + certsTotal;
  const marginPct = netTotal > 0 ? r2((netTotal - totalCosts) / netTotal) : 0;
  const estimatedHours = baseHours;
  const effectiveDayRate = estimatedHours > 0 ? r2((netTotal - totalCosts) / (estimatedHours / 8)) : 0;

  // 14. Price range (+-10%)
  const priceRange = {
    low: r2(grandTotal * 0.9),
    high: r2(grandTotal * 1.1),
  };

  return {
    lineItems,
    materialsTotal: r2(materialsTotal),
    labourTotal,
    certsTotal: r2(certsTotal),
    wasteTotal,
    subtotal,
    difficultyAdjustment,
    hassleAdjustment,
    emergencyAdjustment,
    outOfHoursAdjustment,
    adjustmentsTotal,
    netTotal,
    vatAmount,
    grandTotal,
    marginPct,
    effectiveDayRate,
    estimatedHours,
    priceRange,
  };
}
