/**
 * Email template builder — generates branded HTML emails for transactional use cases.
 *
 * Design tokens (matching Varda/app dark theme):
 *   Background:  #1A1C20
 *   Card:        #2B2E34
 *   Gold accent:  #C6A86A
 *   Text primary: #F5F5F3
 *   Text muted:   #C9CDD2
 *   Text faint:   #6B7280
 *   Divider:      #3A3D44
 */

/**
 * All email params accept an optional `greetingName` for "Hi X,".
 * For business customers this should be the point-of-contact's first
 * name (e.g. "Sarah"), not the company name (e.g. "Acme Property Mgmt").
 * Falls back to the first word of `customerName` if not provided.
 */

// ─── Shared layout helpers ──────────────────────────────────────────────────

const COLORS = {
  bg: '#1A1C20',
  card: '#2B2E34',
  gold: '#C6A86A',
  white: '#F5F5F3',
  silver: '#C9CDD2',
  muted: '#6B7280',
  divider: '#3A3D44',
  black: '#1A1C20',
} as const

function wrapLayout(businessName: string, bodyRows: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(businessName)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${COLORS.bg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${COLORS.bg}; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width: 520px; width: 100%; background-color: ${COLORS.card}; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 36px 40px 0 40px; text-align: center;">
              <h1 style="margin: 0 0 8px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: 700; color: ${COLORS.gold}; letter-spacing: 2px;">${esc(businessName)}</h1>
            </td>
          </tr>
          ${bodyRows}
          <!-- Footer -->
          <tr>
            <td style="padding: 28px 40px 36px 40px;">
              <hr style="border: none; border-top: 1px solid ${COLORS.divider}; margin: 0 0 20px 0;" />
              <p style="margin: 0; font-size: 12px; color: ${COLORS.muted}; text-align: center;">${esc(businessName)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function ctaButton(label: string, url: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td align="center" style="padding: 4px 0 0 0;">
      <a href="${esc(url)}" target="_blank" style="display: inline-block; width: 100%; max-width: 400px; background-color: ${COLORS.gold}; color: ${COLORS.black}; text-align: center; padding: 14px 24px; border-radius: 10px; text-decoration: none; font-size: 16px; font-weight: 600; box-sizing: border-box;">${esc(label)}</a>
    </td>
  </tr>
</table>`
}

function detailRow(label: string, value: string): string {
  return `<tr>
  <td style="padding: 6px 0; font-size: 14px; color: ${COLORS.muted}; width: 120px;">${esc(label)}</td>
  <td style="padding: 6px 0; font-size: 14px; color: ${COLORS.white}; font-weight: 600; text-align: right;">${esc(value)}</td>
</tr>`
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ─── Quote Email ────────────────────────────────────────────────────────────

export interface QuoteEmailParams {
  customerName: string
  greetingName?: string
  businessName: string
  quoteRef: string
  total: string
  quoteUrl: string
  validityDays?: number
  businessPhone: string
  businessEmail: string
}

export function buildQuoteEmail(params: QuoteEmailParams): { subject: string; html: string; text: string } {
  const { customerName, greetingName, businessName, quoteRef, total, quoteUrl, validityDays, businessPhone, businessEmail } = params
  const greeting = greetingName || customerName.split(' ')[0]
  const subject = `Your quote from ${businessName} — ${quoteRef}`

  const bodyRows = `
  <tr>
    <td style="padding: 24px 40px 0 40px;">
      <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 600; color: ${COLORS.white};">Hi ${esc(greeting || customerName.split(' ')[0])},</h2>
      <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: ${COLORS.silver};">
        Here's your quote from ${esc(businessName)}. You can view the full breakdown and approve it online.
      </p>
    </td>
  </tr>
  <tr>
    <td style="padding: 0 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${COLORS.bg}; border-radius: 10px; padding: 16px 20px;">
        ${detailRow('Reference', quoteRef)}
        ${detailRow('Total', total)}
        ${validityDays ? detailRow('Valid for', `${validityDays} days`) : ''}
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding: 24px 40px 0 40px;">
      ${ctaButton('View Quote', quoteUrl)}
    </td>
  </tr>
  <tr>
    <td style="padding: 20px 40px 0 40px;">
      <p style="margin: 0; font-size: 13px; line-height: 1.5; color: ${COLORS.muted};">
        Questions? Reply to this email or call ${esc(businessPhone)}.
      </p>
    </td>
  </tr>`

  const text = `Hi ${greeting || customerName.split(' ')[0]},

Here's your quote from ${businessName}.

Reference: ${quoteRef}
Total: ${total}
${validityDays ? `Valid for: ${validityDays} days` : ''}

View your quote: ${quoteUrl}

Questions? Call ${businessPhone} or email ${businessEmail}.

${businessName}`

  return { subject, html: wrapLayout(businessName, bodyRows), text }
}

// ─── Invoice Email ──────────────────────────────────────────────────────────

export interface InvoiceEmailParams {
  customerName: string
  greetingName?: string
  businessName: string
  invoiceRef: string
  total: string
  dueDate?: string
  invoiceUrl: string
  businessPhone: string
  businessEmail: string
}

export function buildInvoiceEmail(params: InvoiceEmailParams): { subject: string; html: string; text: string } {
  const { customerName, greetingName: greeting, businessName, invoiceRef, total, dueDate, invoiceUrl, businessPhone, businessEmail } = params
  const subject = `Invoice ${invoiceRef} from ${businessName}`

  const bodyRows = `
  <tr>
    <td style="padding: 24px 40px 0 40px;">
      <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 600; color: ${COLORS.white};">Hi ${esc(greeting || customerName.split(' ')[0])},</h2>
      <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: ${COLORS.silver};">
        Please find your invoice from ${esc(businessName)} below. Click the button to view and pay online.
      </p>
    </td>
  </tr>
  <tr>
    <td style="padding: 0 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${COLORS.bg}; border-radius: 10px; padding: 16px 20px;">
        ${detailRow('Invoice', invoiceRef)}
        ${detailRow('Amount Due', total)}
        ${dueDate ? detailRow('Due Date', dueDate) : ''}
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding: 24px 40px 0 40px;">
      ${ctaButton('View Invoice', invoiceUrl)}
    </td>
  </tr>
  <tr>
    <td style="padding: 20px 40px 0 40px;">
      <p style="margin: 0; font-size: 13px; line-height: 1.5; color: ${COLORS.muted};">
        Questions? Reply to this email or call ${esc(businessPhone)}.
      </p>
    </td>
  </tr>`

  const text = `Hi ${greeting || customerName.split(' ')[0]},

Please find your invoice from ${businessName}.

Invoice: ${invoiceRef}
Amount Due: ${total}
${dueDate ? `Due Date: ${dueDate}` : ''}

View your invoice: ${invoiceUrl}

Questions? Call ${businessPhone} or email ${businessEmail}.

${businessName}`

  return { subject, html: wrapLayout(businessName, bodyRows), text }
}

// ─── Booking Confirmation Email ─────────────────────────────────────────────

export interface BookingConfirmationEmailParams {
  customerName: string
  greetingName?: string
  businessName: string
  jobTitle: string
  date: string
  time?: string
  address?: string
  bookingUrl?: string
  businessPhone: string
  businessEmail: string
}

export function buildBookingConfirmationEmail(params: BookingConfirmationEmailParams): { subject: string; html: string; text: string } {
  const { customerName, greetingName: greeting, businessName, jobTitle, date, time, address, bookingUrl, businessPhone, businessEmail } = params
  const subject = `Your booking with ${businessName} — ${jobTitle}`

  const bodyRows = `
  <tr>
    <td style="padding: 24px 40px 0 40px;">
      <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 600; color: ${COLORS.white};">Hi ${esc(greeting || customerName.split(' ')[0])},</h2>
      <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: ${COLORS.silver};">
        I've got you booked in with ${esc(businessName)} for the work below. <strong style="color: ${COLORS.white};">Please reply to this email or give me a call if any of these dates don't work</strong> — otherwise I'll see you then.
      </p>
    </td>
  </tr>
  <tr>
    <td style="padding: 0 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${COLORS.bg}; border-radius: 10px; padding: 16px 20px;">
        ${detailRow('Job', jobTitle)}
        ${detailRow('Date', date)}
        ${time ? detailRow('Time', time) : ''}
        ${address ? detailRow('Address', address) : ''}
      </table>
    </td>
  </tr>
  ${bookingUrl ? `<tr>
    <td style="padding: 24px 40px 0 40px;">
      ${ctaButton('View Booking', bookingUrl)}
    </td>
  </tr>` : ''}
  <tr>
    <td style="padding: 20px 40px 0 40px;">
      <p style="margin: 0; font-size: 13px; line-height: 1.5; color: ${COLORS.muted};">
        Need to change anything? Call ${esc(businessPhone)} or reply to this email and I'll sort it out.
      </p>
    </td>
  </tr>`

  const text = `Hi ${greeting || customerName.split(' ')[0]},

I've got you booked in with ${businessName} for the work below. Please reply or give me a call if any of these dates don't work — otherwise I'll see you then.

Job: ${jobTitle}
Date: ${date}
${time ? `Time: ${time}` : ''}
${address ? `Address: ${address}` : ''}
${bookingUrl ? `\nView booking: ${bookingUrl}` : ''}

Need to change anything? Call ${businessPhone} or email ${businessEmail}.

${businessName}`

  return { subject, html: wrapLayout(businessName, bodyRows), text }
}

// ─── Payment Reminder Email ─────────────────────────────────────────────────

export interface PaymentReminderEmailParams {
  customerName: string
  greetingName?: string
  businessName: string
  invoiceRef: string
  total: string
  dueDate: string
  daysOverdue: number
  invoiceUrl: string
  businessPhone: string
  businessEmail: string
}

export function buildPaymentReminderEmail(params: PaymentReminderEmailParams): { subject: string; html: string; text: string } {
  const { customerName, greetingName: greeting, businessName, invoiceRef, total, dueDate, daysOverdue, invoiceUrl, businessPhone, businessEmail } = params
  const subject = `Payment reminder — Invoice ${invoiceRef}`

  const overdueNote = daysOverdue > 0
    ? `This invoice was due on ${esc(dueDate)} (${daysOverdue} day${daysOverdue === 1 ? '' : 's'} ago).`
    : `This invoice is due on ${esc(dueDate)}.`

  const bodyRows = `
  <tr>
    <td style="padding: 24px 40px 0 40px;">
      <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 600; color: ${COLORS.white};">Hi ${esc(greeting || customerName.split(' ')[0])},</h2>
      <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: ${COLORS.silver};">
        This is a friendly reminder regarding an outstanding invoice from ${esc(businessName)}. ${overdueNote}
      </p>
    </td>
  </tr>
  <tr>
    <td style="padding: 0 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${COLORS.bg}; border-radius: 10px; padding: 16px 20px;">
        ${detailRow('Invoice', invoiceRef)}
        ${detailRow('Amount Due', total)}
        ${detailRow('Due Date', dueDate)}
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding: 24px 40px 0 40px;">
      ${ctaButton('Pay Now', invoiceUrl)}
    </td>
  </tr>
  <tr>
    <td style="padding: 20px 40px 0 40px;">
      <p style="margin: 0; font-size: 13px; line-height: 1.5; color: ${COLORS.muted};">
        Already paid? Please disregard this reminder. Questions? Call ${esc(businessPhone)}.
      </p>
    </td>
  </tr>`

  const text = `Hi ${greeting || customerName.split(' ')[0]},

This is a friendly reminder regarding an outstanding invoice from ${businessName}.

Invoice: ${invoiceRef}
Amount Due: ${total}
Due Date: ${dueDate}

${daysOverdue > 0 ? `This invoice is ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue.` : ''}

Pay now: ${invoiceUrl}

Already paid? Please disregard this reminder. Questions? Call ${businessPhone} or email ${businessEmail}.

${businessName}`

  return { subject, html: wrapLayout(businessName, bodyRows), text }
}

// ─── Follow-Up Email ────────────────────────────────────────────────────────

export interface FollowUpEmailParams {
  customerName: string
  greetingName?: string
  businessName: string
  quoteRef?: string
  customMessage?: string
  quoteUrl?: string
  businessPhone: string
  businessEmail: string
}

export function buildFollowUpEmail(params: FollowUpEmailParams): { subject: string; html: string; text: string } {
  const { customerName, greetingName: greeting, businessName, quoteRef, customMessage, quoteUrl, businessPhone, businessEmail } = params
  const subject = quoteRef ? `Following up on your quote ${quoteRef}` : `Following up — ${businessName}`

  const message = customMessage
    || `Just checking in to see if you had any questions about ${quoteRef ? `quote ${quoteRef}` : 'our recent conversation'}. I'm happy to help with anything you need.`

  const bodyRows = `
  <tr>
    <td style="padding: 24px 40px 0 40px;">
      <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 600; color: ${COLORS.white};">Hi ${esc(greeting || customerName.split(' ')[0])},</h2>
      <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: ${COLORS.silver};">
        ${esc(message)}
      </p>
    </td>
  </tr>
  ${quoteUrl ? `<tr>
    <td style="padding: 0 40px;">
      ${ctaButton('View Quote', quoteUrl)}
    </td>
  </tr>` : ''}
  <tr>
    <td style="padding: 20px 40px 0 40px;">
      <p style="margin: 0; font-size: 13px; line-height: 1.5; color: ${COLORS.muted};">
        Call ${esc(businessPhone)} or reply to this email — happy to help.
      </p>
    </td>
  </tr>`

  const text = `Hi ${greeting || customerName.split(' ')[0]},

${message}
${quoteUrl ? `\nView your quote: ${quoteUrl}` : ''}

Call ${businessPhone} or email ${businessEmail} — happy to help.

${businessName}`

  return { subject, html: wrapLayout(businessName, bodyRows), text }
}
