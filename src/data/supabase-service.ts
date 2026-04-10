import { supabase } from '../lib/supabase'
import type {
  Customer,
  Quote,
  QuoteStatus,
  Job,
  JobStatus,
  Invoice,
  ScheduleEvent,
  CommLog,
  Expense,
  AppSettings,
  PricingConfig,
  JobTypeConfig,
} from './DataContext'

/* ══════════════════════════════════════════════════════
   Case-conversion helpers
   ══════════════════════════════════════════════════════ */

/** Convert a camelCase string to snake_case */
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

/** Convert a snake_case string to camelCase */
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

/** Recursively convert all keys of an object from camelCase to snake_case */
export function toSnake<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map((item) => (typeof item === 'object' && item !== null ? toSnake(item as Record<string, unknown>) : item)) as any

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = camelToSnake(key)
    // Don't recurse into nested objects that are stored as JSONB — they keep camelCase internally
    result[snakeKey] = value
  }
  return result
}

/** Recursively convert all keys of an object from snake_case to camelCase */
export function toCamel<T>(obj: Record<string, unknown>): T {
  if (obj === null || obj === undefined) return obj as any
  if (Array.isArray(obj)) return obj.map((item) => (typeof item === 'object' && item !== null ? toCamel(item as Record<string, unknown>) : item)) as any

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = snakeToCamel(key)
    // Don't recurse into nested objects — top-level columns only
    result[camelKey] = value
  }
  return result as T
}

/** Convert a partial camelCase update object to snake_case for Supabase */
function toSnakePartial(obj: Record<string, unknown>): Record<string, unknown> {
  return toSnake(obj)
}

/* ══════════════════════════════════════════════════════
   Customers
   ══════════════════════════════════════════════════════ */

export async function fetchCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => toCamel<Customer>(row))
}

export async function insertCustomer(
  orgId: string,
  customer: Omit<Customer, 'id' | 'createdAt'>
): Promise<Customer> {
  const row = pickCols(toSnake(customer as unknown as Record<string, unknown>), CUSTOMER_COLS)
  const { data, error } = await supabase
    .from('customers')
    .insert({ org_id: orgId, ...row })
    .select()
    .single()
  if (error) throw error
  return toCamel<Customer>(data)
}

export async function updateCustomer(
  id: string,
  updates: Partial<Customer>
): Promise<Customer> {
  const row = pickCols(toSnakePartial(updates as Record<string, unknown>), CUSTOMER_COLS)
  const { data, error } = await supabase
    .from('customers')
    .update(row)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return toCamel<Customer>(data)
}

export async function deleteCustomer(id: string): Promise<void> {
  const { error } = await supabase.from('customers').delete().eq('id', id)
  if (error) throw error
}

/* ══════════════════════════════════════════════════════
   Quotes
   ══════════════════════════════════════════════════════ */

export async function fetchQuotes(): Promise<Quote[]> {
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => toCamel<Quote>(row))
}

// Whitelist of actual database columns — only these get sent to Supabase
// This prevents TypeScript-only fields (customerName, distanceMiles, etc.) from causing 400 errors
const QUOTE_COLS = new Set([
  'ref', 'customer_id', 'customer_name', 'job_type_id', 'job_type_name', 'description', 'quantity',
  'difficulty', 'hassle_factor', 'emergency', 'out_of_hours', 'cert_required',
  'customer_supplies_materials', 'notes', 'materials', 'labour', 'certificates',
  'waste', 'subtotal', 'adjustments', 'net_total', 'vat', 'grand_total', 'margin',
  'est_hours', 'status', 'sent_at', 'viewed_at', 'accepted_at', 'materials_breakdown',
  'job_postcode', 'distance_miles', 'needs_resend',
])
const JOB_COLS = new Set([
  'customer_id', 'customer_name', 'quote_id', 'invoice_id', 'job_type', 'value', 'estimated_hours',
  'actual_hours', 'status', 'date', 'notes',
  'is_recurring', 'recurrence_rule', 'recurrence_interval_months', 'next_recurrence_date', 'parent_job_id',
  'deleted_at', 'started_at',
])
const INVOICE_COLS = new Set([
  'ref', 'job_id', 'quote_id', 'customer_id', 'customer_name', 'job_type_name',
  'description', 'net_total', 'vat', 'grand_total', 'status', 'due_date',
  'sent_at', 'paid_at', 'invoice_type',
])
const EVENT_COLS = new Set([
  'job_id', 'customer_id', 'customer_name', 'job_type', 'date', 'slot', 'status', 'notes',
  'confirmation_sent_at', 'start_time', 'end_time', 'category',
  'confirmed_date', 'confirmed_start_time', 'confirmed_end_time',
])
const COMM_COLS = new Set([
  'customer_id', 'customer_name', 'template_name', 'channel', 'status', 'date', 'body',
])
const EXPENSE_COLS = new Set([
  'date', 'supplier', 'description', 'category', 'amount', 'vat', 'total', 'job_id', 'receipt',
])
const CUSTOMER_COLS = new Set([
  'name', 'phone', 'email', 'address1', 'address2', 'city', 'postcode', 'notes',
  'is_business', 'business_name', 'contact_name',
])

function pickCols(row: Record<string, unknown>, allowed: Set<string>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (!allowed.has(key) || value === undefined) continue
    // Skip temp IDs — they're not valid UUIDs and will cause FK errors
    if (typeof value === 'string' && value.startsWith('tmp-') && key.endsWith('_id')) continue
    // Skip empty string IDs for UUID FK fields
    if (typeof value === 'string' && value === '' && key.endsWith('_id')) continue
    result[key] = value
  }
  return result
}

export async function insertQuote(
  orgId: string,
  quote: Omit<Quote, 'id' | 'createdAt'>
): Promise<Quote> {
  const row = pickCols(toSnake(quote as unknown as Record<string, unknown>), QUOTE_COLS)
  const { data, error } = await supabase
    .from('quotes')
    .insert({ org_id: orgId, ...row })
    .select()
    .single()
  if (error) throw error
  return toCamel<Quote>(data)
}

export async function updateQuote(
  id: string,
  updates: Partial<Quote>
): Promise<Quote> {
  const row = pickCols(toSnakePartial(updates as Record<string, unknown>), QUOTE_COLS)
  const { data, error } = await supabase
    .from('quotes')
    .update(row)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return toCamel<Quote>(data)
}

/* ══════════════════════════════════════════════════════
   Jobs
   ══════════════════════════════════════════════════════ */

export async function fetchJobs(): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => toCamel<Job>(row))
}

export async function insertJob(
  orgId: string,
  job: Omit<Job, 'id' | 'createdAt'>
): Promise<Job> {
  const row = pickCols(toSnake(job as unknown as Record<string, unknown>), JOB_COLS)
  const { data, error } = await supabase
    .from('jobs')
    .insert({ org_id: orgId, ...row })
    .select()
    .single()
  if (error) throw error
  return toCamel<Job>(data)
}

export async function updateJob(
  id: string,
  updates: Partial<Job>
): Promise<Job> {
  const row = pickCols(toSnakePartial(updates as Record<string, unknown>), JOB_COLS)
  const { data, error } = await supabase
    .from('jobs')
    .update(row)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return toCamel<Job>(data)
}

/** Convenience: move a job to a new status */
export async function moveJob(
  id: string,
  status: JobStatus
): Promise<Job> {
  return updateJob(id, { status } as Partial<Job>)
}

/* ══════════════════════════════════════════════════════
   Invoices
   ══════════════════════════════════════════════════════ */

export async function fetchInvoices(): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => toCamel<Invoice>(row))
}

export async function insertInvoice(
  orgId: string,
  invoice: Omit<Invoice, 'id' | 'createdAt'>
): Promise<Invoice> {
  const row = pickCols(toSnake(invoice as unknown as Record<string, unknown>), INVOICE_COLS)
  const { data, error } = await supabase
    .from('invoices')
    .insert({ org_id: orgId, ...row })
    .select()
    .single()
  if (error) throw error
  return toCamel<Invoice>(data)
}

export async function updateInvoice(
  id: string,
  updates: Partial<Invoice>
): Promise<Invoice> {
  const row = pickCols(toSnakePartial(updates as Record<string, unknown>), INVOICE_COLS)
  const { data, error } = await supabase
    .from('invoices')
    .update(row)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return toCamel<Invoice>(data)
}

export async function deleteInvoice(id: string): Promise<void> {
  const { error } = await supabase.from('invoices').delete().eq('id', id)
  if (error) throw error
}

/* ══════════════════════════════════════════════════════
   Schedule Events
   ══════════════════════════════════════════════════════ */

export async function fetchEvents(): Promise<ScheduleEvent[]> {
  const { data, error } = await supabase
    .from('schedule_events')
    .select('*')
    .order('date', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row) => toCamel<ScheduleEvent>(row))
}

export async function insertEvent(
  orgId: string,
  event: Omit<ScheduleEvent, 'id'>
): Promise<ScheduleEvent> {
  const row = pickCols(toSnake(event as unknown as Record<string, unknown>), EVENT_COLS)
  const { data, error } = await supabase
    .from('schedule_events')
    .insert({ org_id: orgId, ...row })
    .select()
    .single()
  if (error) throw error
  return toCamel<ScheduleEvent>(data)
}

export async function updateEvent(
  id: string,
  updates: Partial<ScheduleEvent>
): Promise<ScheduleEvent> {
  const row = pickCols(toSnakePartial(updates as Record<string, unknown>), EVENT_COLS)
  const { data, error } = await supabase
    .from('schedule_events')
    .update(row)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return toCamel<ScheduleEvent>(data)
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('schedule_events').delete().eq('id', id)
  if (error) throw error
}

/* ══════════════════════════════════════════════════════
   Communications
   ══════════════════════════════════════════════════════ */

export async function fetchComms(): Promise<CommLog[]> {
  const { data, error } = await supabase
    .from('communications')
    .select('*')
    .order('date', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => toCamel<CommLog>(row))
}

export async function insertComm(
  orgId: string,
  comm: Omit<CommLog, 'id'>
): Promise<CommLog> {
  const row = pickCols(toSnake(comm as unknown as Record<string, unknown>), COMM_COLS)
  const { data, error } = await supabase
    .from('communications')
    .insert({ org_id: orgId, ...row })
    .select()
    .single()
  if (error) throw error
  return toCamel<CommLog>(data)
}

/* ══════════════════════════════════════════════════════
   Expenses
   ══════════════════════════════════════════════════════ */

export async function fetchExpenses(): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .order('date', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => toCamel<Expense>(row))
}

export async function insertExpense(
  orgId: string,
  expense: Omit<Expense, 'id'>
): Promise<Expense> {
  const row = pickCols(toSnake(expense as unknown as Record<string, unknown>), EXPENSE_COLS)
  const { data, error } = await supabase
    .from('expenses')
    .insert({ org_id: orgId, ...row })
    .select()
    .single()
  if (error) throw error
  return toCamel<Expense>(data)
}

export async function updateExpense(
  id: string,
  updates: Partial<Expense>
): Promise<Expense> {
  const row = pickCols(toSnakePartial(updates as Record<string, unknown>), EXPENSE_COLS)
  const { data, error } = await supabase
    .from('expenses')
    .update(row)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return toCamel<Expense>(data)
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw error
}

/* ══════════════════════════════════════════════════════
   Settings (single JSONB row per org)
   ══════════════════════════════════════════════════════ */

export async function fetchSettings(): Promise<AppSettings | null> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('settings_json')
    .single()
  if (error) {
    // PGRST116 = no rows — org has no settings yet
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data.settings_json as AppSettings
}

export async function upsertSettings(
  orgId: string,
  settings: AppSettings
): Promise<AppSettings> {
  const { data, error } = await supabase
    .from('app_settings')
    .upsert({ org_id: orgId, settings_json: settings }, { onConflict: 'org_id' })
    .select('settings_json')
    .single()
  if (error) throw error
  return data.settings_json as AppSettings
}

/* ══════════════════════════════════════════════════════
   Pricing Config (single JSONB row per org)
   ══════════════════════════════════════════════════════ */

export async function fetchPricingConfig(): Promise<PricingConfig | null> {
  const { data, error } = await supabase
    .from('pricing_config')
    .select('config_json')
    .single()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data.config_json as PricingConfig
}

export async function upsertPricingConfig(
  orgId: string,
  config: PricingConfig
): Promise<PricingConfig> {
  const { data, error } = await supabase
    .from('pricing_config')
    .upsert({ org_id: orgId, config_json: config }, { onConflict: 'org_id' })
    .select('config_json')
    .single()
  if (error) throw error
  return data.config_json as PricingConfig
}

/* ══════════════════════════════════════════════════════
   Job Type Configs (individual rows per job type per org)
   ══════════════════════════════════════════════════════ */

export async function fetchJobTypeConfigs(): Promise<JobTypeConfig[]> {
  const { data, error } = await supabase
    .from('job_type_configs')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row) => toCamel<JobTypeConfig>(row))
}

/**
 * Batch upsert: delete all existing rows for the org, then insert the full set.
 * This keeps the logic simple — the caller always sends the complete list.
 */
export async function upsertJobTypeConfigs(
  orgId: string,
  configs: JobTypeConfig[]
): Promise<JobTypeConfig[]> {
  // Delete existing rows (RLS scopes this to the user's org)
  const { error: deleteError } = await supabase
    .from('job_type_configs')
    .delete()
    .neq('id', '___never_matches___') // delete all rows visible via RLS
  if (deleteError) throw deleteError

  // Insert the new set
  const rows = configs.map((cfg) => ({
    ...toSnake(cfg as unknown as Record<string, unknown>),
    org_id: orgId,
  }))
  const { data, error } = await supabase
    .from('job_type_configs')
    .insert(rows)
    .select()
  if (error) throw error
  return (data ?? []).map((row) => toCamel<JobTypeConfig>(row))
}
