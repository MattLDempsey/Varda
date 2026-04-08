/**
 * SMS template builder — generates plain-text SMS messages.
 *
 * Single SMS = 160 chars, concatenated = 320 chars.
 * These templates aim for single SMS where possible.
 */

export interface AppointmentReminderParams {
  customerName: string
  businessName: string
  date: string       // e.g. "tomorrow", "Monday 14th"
  slot: string       // e.g. "morning (8am-12pm)", "afternoon (12pm-5pm)"
  businessPhone: string
}

export interface QuoteSentParams {
  customerName: string
  businessName: string
  quoteRef: string
  total: string      // e.g. "£450.00"
}

export interface InvoiceSentParams {
  customerName: string
  businessName: string
  invoiceRef: string
  total: string      // e.g. "£450.00"
  invoiceUrl?: string
}

export function buildAppointmentReminderSMS(params: AppointmentReminderParams): string {
  const firstName = params.customerName.split(' ')[0]
  return `Hi ${firstName}, reminder: your electrician from ${params.businessName} is visiting ${params.date} ${params.slot}. Questions? Call ${params.businessPhone}`
}

export function buildQuoteSentSMS(params: QuoteSentParams): string {
  const firstName = params.customerName.split(' ')[0]
  return `Hi ${firstName}, your quote ${params.quoteRef} (${params.total} inc VAT) from ${params.businessName} has been emailed to you. Any questions, just reply to this text.`
}

export function buildInvoiceSentSMS(params: InvoiceSentParams): string {
  const firstName = params.customerName.split(' ')[0]
  if (params.invoiceUrl) {
    return `Hi ${firstName}, invoice ${params.invoiceRef} (${params.total}) from ${params.businessName} is ready. Pay online: ${params.invoiceUrl}`
  }
  return `Hi ${firstName}, invoice ${params.invoiceRef} (${params.total}) from ${params.businessName} has been emailed to you. Any questions, just reply.`
}

/**
 * Helper: open the native SMS app with pre-filled message.
 * On mobile this opens the SMS composer; on desktop it may not work,
 * so callers should offer a "Copy SMS text" fallback.
 */
export function buildSMSLink(phoneNumber: string, body: string): string {
  // Normalise UK mobile: 07xxx -> +447xxx
  let phone = phoneNumber.replace(/\s+/g, '')
  if (phone.startsWith('0')) {
    phone = '+44' + phone.slice(1)
  } else if (!phone.startsWith('+')) {
    phone = '+44' + phone
  }
  return `sms:${phone}?body=${encodeURIComponent(body)}`
}

/**
 * Detect whether the user is likely on a mobile device (for SMS link vs copy fallback).
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}
