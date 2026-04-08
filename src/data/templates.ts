export interface MessageTemplate {
  id: string
  name: string
  channel: 'email' | 'whatsapp' | 'sms'
  subject?: string
  body: string
}

export const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    id: 'quote',
    name: 'Send Quote',
    channel: 'email',
    subject: 'Your Quote from Grey Havens Electrical',
    body: `Hi {{customer}},

Thank you for your enquiry. Please find your quote below:

Job: {{jobType}}
Quote Reference: {{quoteRef}}
Total: {{total}} (inc. VAT)

This quote is valid for 30 days.

If you'd like to go ahead, simply reply to this email or call us on 07XXX XXX XXX.

Kind regards,
Grey Havens Electrical`,
  },
  {
    id: 'followup',
    name: 'Follow Up',
    channel: 'email',
    subject: 'Following up on your quote — Grey Havens',
    body: `Hi {{customer}},

Just checking in regarding the quote we sent on {{quoteDate}} for {{jobType}}.

If you have any questions or would like to discuss the work, please don't hesitate to get in touch.

Best regards,
Grey Havens Electrical`,
  },
  {
    id: 'confirmation',
    name: 'Booking Confirmation',
    channel: 'email',
    subject: 'Your booking is confirmed — Grey Havens',
    body: `Hi {{customer}},

This is to confirm your booking:

Job: {{jobType}}
Date: {{bookingDate}}
Time: {{bookingTime}}

Please ensure access to the property is available. If you need to reschedule, let us know at least 24 hours in advance.

See you then!
Grey Havens Electrical`,
  },
  {
    id: 'running-late',
    name: 'Running Late',
    channel: 'whatsapp',
    body: `Hi {{customer}}, it's Matt from Grey Havens Electrical. Just to let you know I'm running about {{delay}} minutes late today. Apologies for the inconvenience — I'll be with you as soon as I can.`,
  },
  {
    id: 'payment-reminder',
    name: 'Payment Reminder',
    channel: 'email',
    subject: 'Payment reminder — Invoice {{invoiceRef}}',
    body: `Hi {{customer}},

This is a friendly reminder that invoice {{invoiceRef}} for £{{amount}} is now overdue.

If you've already made payment, please disregard this message.

Payment can be made by bank transfer to:
Sort code: XX-XX-XX
Account: XXXXXXXX
Reference: {{invoiceRef}}

Thank you,
Grey Havens Electrical`,
  },
  {
    id: 'invoice',
    name: 'Send Invoice',
    channel: 'email',
    subject: 'Invoice {{invoiceRef}} — Grey Havens Electrical',
    body: `Hi {{customer}},

Please find attached your invoice for the recently completed work:

Job: {{jobType}}
Invoice: {{invoiceRef}}
Amount: £{{amount}} (inc. VAT)
Due date: {{dueDate}}

Payment can be made by bank transfer to:
Sort code: XX-XX-XX
Account: XXXXXXXX
Reference: {{invoiceRef}}

Thank you for choosing Grey Havens Electrical.

Kind regards,
Matt`,
  },
  {
    id: 'sms-reminder',
    name: 'Appointment Reminder',
    channel: 'sms',
    body: `Hi {{customer}}, reminder: your electrician from Grey Havens is visiting tomorrow morning (8am-12pm). Questions? Call 07XXX XXX XXX`,
  },
  {
    id: 'sms-quote',
    name: 'Quote Sent',
    channel: 'sms',
    body: `Hi {{customer}}, your quote {{quoteRef}} ({{total}} inc VAT) from Grey Havens Electrical has been emailed to you. Any questions, just reply to this text.`,
  },
  {
    id: 'sms-invoice',
    name: 'Invoice Sent',
    channel: 'sms',
    body: `Hi {{customer}}, invoice {{invoiceRef}} ({{total}}) from Grey Havens Electrical has been emailed to you. Any questions, just reply.`,
  },
]

const STORAGE_KEY = 'varda-templates'

/** Load templates, merging any user edits from localStorage over the defaults */
export function loadTemplates(): MessageTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_TEMPLATES
    const overrides: Record<string, Partial<MessageTemplate>> = JSON.parse(raw)
    return DEFAULT_TEMPLATES.map(t => {
      const o = overrides[t.id]
      return o ? { ...t, ...o } : t
    })
  } catch {
    return DEFAULT_TEMPLATES
  }
}

/** Save a single template edit to localStorage */
export function saveTemplate(id: string, updates: Partial<MessageTemplate>): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const overrides: Record<string, Partial<MessageTemplate>> = raw ? JSON.parse(raw) : {}
    overrides[id] = { ...overrides[id], ...updates }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
  } catch {
    // silently ignore
  }
}

/** Reset a single template back to its default */
export function resetTemplate(id: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const overrides: Record<string, Partial<MessageTemplate>> = JSON.parse(raw)
    delete overrides[id]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
  } catch {
    // silently ignore
  }
}
