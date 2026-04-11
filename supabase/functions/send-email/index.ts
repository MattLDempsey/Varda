// Supabase Edge Function: Send transactional email via Resend
// Deployed via: supabase functions deploy send-email
// Secrets required: RESEND_API_KEY

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RESEND_API_URL = 'https://api.resend.com/emails'
// All emails are sent from this verified Resend domain. The display name (the
// "Friendly Name" customers see in their inbox) is overridden per request via
// the `fromName` parameter, so quotes appear to come from the business owner.
const FROM_EMAIL = 'noreply@vardaapp.com'
const DEFAULT_FROM_NAME = 'Varda'

/**
 * Sanitize a user-supplied display name to make it safe for an RFC 5322
 * "Friendly Name <addr>" header. Strips CR/LF (header injection), angle
 * brackets and double quotes, and clamps to a reasonable length.
 */
function sanitizeDisplayName(input: string | undefined | null): string {
  if (!input) return DEFAULT_FROM_NAME
  const cleaned = String(input)
    .replace(/[\r\n]+/g, ' ')
    .replace(/["<>]/g, '')
    .trim()
    .slice(0, 80)
  return cleaned || DEFAULT_FROM_NAME
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return new Response(JSON.stringify({ success: false, error: 'Email service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Authenticate the user
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization')

    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse the request body
    const {
      to,
      subject,
      htmlBody,
      textBody,
      replyTo,
      fromName,
      attachments,
      orgId,
      customerId,
      templateName,
    } = await req.json() as {
      to: string
      subject: string
      htmlBody: string
      textBody?: string
      replyTo?: string
      fromName?: string
      attachments?: Array<{ filename: string; content: string; contentType?: string }>
      orgId: string
      customerId?: string
      templateName?: string
    }

    // Validate required fields
    if (!to || !subject || !htmlBody || !orgId) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields: to, subject, htmlBody, orgId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify user belongs to the org they're sending from
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.org_id !== orgId) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized: user does not belong to this organization' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build the From line so the customer sees the business owner's name
    // (e.g. "Matt Dempsey - Grey Havens Electrical <noreply@vardaos.app>")
    // while the actual address stays on our verified Resend domain.
    const displayName = sanitizeDisplayName(fromName)
    const fromHeader = `${displayName} <${FROM_EMAIL}>`

    // Send via Resend API
    const emailPayload: Record<string, unknown> = {
      from: fromHeader,
      to: [to],
      subject,
      html: htmlBody,
    }

    if (textBody) emailPayload.text = textBody
    if (replyTo) emailPayload.reply_to = replyTo
    // Resend accepts an array of { filename, content (base64) } objects.
    if (attachments && attachments.length > 0) {
      emailPayload.attachments = attachments.map(a => ({
        filename: a.filename,
        content: a.content,
        ...(a.contentType ? { contentType: a.contentType } : {}),
      }))
    }

    const resendRes = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    })

    const resendData = await resendRes.json()

    if (!resendRes.ok) {
      console.error('Resend API error:', resendData)
      return new Response(JSON.stringify({
        success: false,
        error: resendData.message || 'Failed to send email',
      }), {
        status: resendRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Log the communication in the communications table
    if (customerId || templateName) {
      try {
        await supabase.from('communications').insert({
          org_id: orgId,
          customer_id: customerId || null,
          customer_name: null, // caller can update separately
          template_name: templateName || 'Custom',
          channel: 'email',
          status: 'Sent',
          date: new Date().toISOString(),
          body: subject,
          resend_id: resendData.id || null,
        })
      } catch (logErr) {
        // Don't fail the whole request if logging fails
        console.error('Failed to log communication:', logErr)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      messageId: resendData.id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Send email error:', err)
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
