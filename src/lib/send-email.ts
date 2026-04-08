/**
 * Client-side helper to send emails via the Supabase Edge Function.
 *
 * Falls back to `mailto:` if the Edge Function is unavailable (not deployed,
 * no API key, network error, etc.).
 */

import { supabase } from './supabase'

export interface SendEmailParams {
  to: string
  subject: string
  htmlBody: string
  textBody?: string
  replyTo?: string
  orgId: string
  customerId?: string
  templateName?: string
}

export interface SendEmailResult {
  success: boolean
  /** 'edge' if sent via Edge Function, 'mailto' if fell back to mailto */
  method: 'edge' | 'mailto'
  error?: string
}

/**
 * Attempt to send an email via the Supabase Edge Function (Resend).
 * If the Edge Function is unreachable or fails, opens a mailto: link as fallback.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { to, subject, htmlBody, textBody, replyTo, orgId, customerId, templateName } = params

  try {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.access_token) {
      // No session — fall back to mailto
      openMailto(to, subject, textBody || '')
      return { success: true, method: 'mailto', error: 'No active session — opened email client instead' }
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    if (!supabaseUrl) {
      openMailto(to, subject, textBody || '')
      return { success: true, method: 'mailto', error: 'Supabase URL not configured' }
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        to,
        subject,
        htmlBody,
        textBody,
        replyTo,
        orgId,
        customerId,
        templateName,
      }),
    })

    const data = await res.json()

    if (data.success) {
      return { success: true, method: 'edge' }
    }

    // Edge function returned an error — fall back to mailto
    console.warn('Edge function send-email failed, falling back to mailto:', data.error)
    openMailto(to, subject, textBody || '')
    return { success: true, method: 'mailto', error: data.error }
  } catch (err) {
    // Network error or Edge Function not deployed — fall back to mailto
    console.warn('Email send failed, falling back to mailto:', err)
    openMailto(to, subject, textBody || '')
    return { success: true, method: 'mailto', error: String(err) }
  }
}

/** Opens a mailto: link as a fallback for email sending. */
function openMailto(to: string, subject: string, body: string): void {
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  window.open(mailto, '_blank')
}
