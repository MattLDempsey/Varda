import React, { useState, useMemo, useCallback } from 'react'
import { Mail, MessageCircle, Send, Clock, CheckCircle2, Copy, ChevronRight, X, Search, Filter, Smartphone } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useTheme } from '../theme/ThemeContext'
import { useData } from '../data/DataContext'
import { buildSMSLink, isMobileDevice } from '../lib/sms-templates'
import { useIsMobile } from '../hooks/useIsMobile'

import FeatureGate from '../components/FeatureGate'
import type { Customer, Quote, CommLog } from '../data/DataContext'

/* ── types ── */
type Channel = 'email' | 'whatsapp' | 'sms'
type TemplateId = 'quote' | 'followup' | 'confirmation' | 'running-late' | 'payment-reminder' | 'invoice' | 'sms-reminder' | 'sms-quote' | 'sms-invoice'
type TabId = 'templates' | 'compose' | 'history'

interface Template {
  id: TemplateId
  name: string
  channel: Channel
  subject?: string
  body: string
}

/* ── templates ── */
const templates: Template[] = [
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

/* ── date formatter ── */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatCommDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const day = d.getDate()
  const mon = MONTHS[d.getMonth()]
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${day} ${mon}, ${hh}:${mm}`
}

/* ── interpolation helper ── */
function interpolateBody(body: string, customer?: Customer, latestQuote?: Quote): string {
  let result = body
  if (customer) {
    result = result.replace(/\{\{customer\}\}/g, customer.name.split(' ')[0])
  }
  if (latestQuote) {
    result = result.replace(/\{\{quoteRef\}\}/g, latestQuote.ref)
    result = result.replace(/\{\{jobType\}\}/g, latestQuote.jobTypeName)
    result = result.replace(/\{\{total\}\}/g, `£${latestQuote.grandTotal.toFixed(2)}`)
    result = result.replace(/\{\{amount\}\}/g, latestQuote.grandTotal.toFixed(2))
    result = result.replace(/\{\{quoteDate\}\}/g, latestQuote.createdAt ? new Date(latestQuote.createdAt).toLocaleDateString('en-GB') : '')
  }
  return result
}

function interpolateSubject(subject: string, _customer?: Customer, latestQuote?: Quote): string {
  let result = subject
  if (latestQuote) {
    result = result.replace(/\{\{invoiceRef\}\}/g, latestQuote.ref)
  }
  return result
}

export default function Comms() {
  const { C } = useTheme()
  const { customers, quotes, comms, addComm } = useData()
  const isMobile = useIsMobile()

  /* ── state ── */
  const [activeTab, setActiveTab] = useState<TabId>('templates')
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('quote')
  const [copied, setCopied] = useState(false)

  // Compose state
  const [composeCustomerId, setComposeCustomerId] = useState<string>('')
  const [composeChannel, setComposeChannel] = useState<Channel>('email')
  const [composeTemplateId, setComposeTemplateId] = useState<TemplateId | ''>('')
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [composeSent, setComposeSent] = useState(false)

  // History state
  const [historyFilter, setHistoryFilter] = useState<'all' | Channel>('all')
  const [historySearch, setHistorySearch] = useState('')
  const [selectedComm, setSelectedComm] = useState<CommLog | null>(null)

  /* ── derived ── */
  const template = templates.find(t => t.id === selectedTemplate)!
  const emailTemplates = templates.filter(t => t.channel === 'email')
  const waTemplates = templates.filter(t => t.channel === 'whatsapp')
  const smsTemplates = templates.filter(t => t.channel === 'sms')

  const composeCustomer = useMemo(() => customers.find(c => c.id === composeCustomerId), [customers, composeCustomerId])
  const composeLatestQuote = useMemo(() => {
    if (!composeCustomerId) return undefined
    const cQuotes = quotes
      .filter(q => q.customerId === composeCustomerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return cQuotes[0]
  }, [quotes, composeCustomerId])

  const sortedCustomers = useMemo(() =>
    [...customers].sort((a, b) => a.name.localeCompare(b.name)),
    [customers]
  )

  const filteredComms = useMemo(() => {
    let list = [...comms].sort((a, b) => b.date.localeCompare(a.date))
    if (historyFilter !== 'all') {
      list = list.filter(c => c.channel === historyFilter)
    }
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase()
      list = list.filter(c => c.customerName.toLowerCase().includes(q))
    }
    return list
  }, [comms, historyFilter, historySearch])

  /* ── handlers ── */
  const handleUseTemplate = useCallback((tpl: Template) => {
    setComposeTemplateId(tpl.id)
    setComposeChannel(tpl.channel)
    setComposeSubject(tpl.subject || '')
    setComposeBody(tpl.body)
    setComposeSent(false)
    setActiveTab('compose')
  }, [])

  // When customer changes, re-interpolate if a template is loaded
  const handleCustomerChange = useCallback((customerId: string) => {
    setComposeCustomerId(customerId)
    setComposeSent(false)
    if (composeTemplateId) {
      const tpl = templates.find(t => t.id === composeTemplateId)
      if (tpl) {
        const cust = customers.find(c => c.id === customerId)
        const cQuotes = quotes
          .filter(q => q.customerId === customerId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        const latestQ = cQuotes[0]
        setComposeBody(interpolateBody(tpl.body, cust, latestQ))
        if (tpl.subject) {
          setComposeSubject(interpolateSubject(tpl.subject, cust, latestQ))
        }
      }
    }
  }, [composeTemplateId, customers, quotes])

  const handleComposeTemplateChange = useCallback((templateId: TemplateId | '') => {
    setComposeTemplateId(templateId)
    setComposeSent(false)
    if (templateId) {
      const tpl = templates.find(t => t.id === templateId)
      if (tpl) {
        setComposeChannel(tpl.channel)
        const cust = composeCustomerId ? customers.find(c => c.id === composeCustomerId) : undefined
        const cQuotes = composeCustomerId
          ? quotes.filter(q => q.customerId === composeCustomerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          : []
        setComposeBody(interpolateBody(tpl.body, cust, cQuotes[0]))
        setComposeSubject(tpl.subject ? interpolateSubject(tpl.subject, cust, cQuotes[0]) : '')
      }
    }
  }, [composeCustomerId, customers, quotes])

  const [smsCopied, setSmsCopied] = useState(false)

  const handleSend = useCallback(() => {
    if (!composeCustomer || !composeBody.trim()) return

    const phone = composeCustomer.phone.replace(/\s+/g, '').replace(/^0/, '44')

    if (composeChannel === 'email') {
      const mailtoUrl = `mailto:${encodeURIComponent(composeCustomer.email)}?subject=${encodeURIComponent(composeSubject)}&body=${encodeURIComponent(composeBody)}`
      window.open(mailtoUrl, '_blank')
    } else if (composeChannel === 'sms') {
      if (isMobileDevice()) {
        const smsUrl = buildSMSLink(composeCustomer.phone, composeBody)
        window.open(smsUrl, '_self')
      } else {
        // Desktop: copy to clipboard instead
        navigator.clipboard.writeText(composeBody)
        setSmsCopied(true)
        setTimeout(() => setSmsCopied(false), 3000)
      }
    } else {
      const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(composeBody)}`
      window.open(waUrl, '_blank')
    }

    // Log the communication
    addComm({
      customerId: composeCustomer.id,
      customerName: composeCustomer.name,
      templateName: composeTemplateId ? (templates.find(t => t.id === composeTemplateId)?.name || 'Custom') : 'Custom',
      channel: composeChannel,
      status: 'Sent',
      date: new Date().toISOString(),
      body: composeBody,
    })

    setComposeSent(true)
  }, [composeCustomer, composeChannel, composeSubject, composeBody, composeTemplateId, addComm])

  /* ── status display helpers ── */
  const statusIcon: Record<string, React.ReactNode> = {
    Sent: <Clock size={14} />,
    Delivered: <CheckCircle2 size={14} />,
    Read: <CheckCircle2 size={14} />,
    Failed: <Clock size={14} />,
  }

  const statusColor: Record<string, string> = {
    Sent: C.blue,
    Delivered: C.green,
    Read: C.green,
    Failed: '#D46A6A',
  }

  /* ── styles ── */
  const s: Record<string, CSSProperties> = {
    page: { padding: 32, maxWidth: 1400, margin: '0 auto', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '300px 1fr', gap: 20, minHeight: 'calc(100vh - 64px)' },
    heading: { fontSize: 28, fontWeight: 600, color: C.white, marginBottom: 20 },
    // left sidebar
    sectionLabel: { fontSize: 11, fontWeight: 600, color: C.steel, textTransform: 'uppercase', letterSpacing: 0.8, padding: '16px 12px 8px', marginTop: 8 },
    templateBtn: {
      display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
      borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13,
      fontWeight: 500, textAlign: 'left', transition: 'all .15s', minHeight: 44,
      width: '100%',
    },
    channelIcon: { width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    // right content
    content: { display: 'flex', flexDirection: 'column', gap: 20 },
    panel: { background: C.charcoalLight, borderRadius: 12, padding: '24px 28px' },
    panelTitle: { fontSize: 16, fontWeight: 600, color: C.white, marginBottom: 4 },
    panelSub: { fontSize: 13, color: C.silver, marginBottom: 20 },
    previewBox: {
      background: C.black, borderRadius: 10, padding: '20px 24px', fontSize: 13,
      color: C.silver, lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'inherit',
      border: `1px solid ${C.steel}33`, maxHeight: 320, overflowY: 'auto',
    },
    subjectLine: { fontSize: 14, fontWeight: 600, color: C.white, marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${C.steel}33` },
    actions: { display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' },
    btn: {
      display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px',
      borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13,
      fontWeight: 600, minHeight: 44, transition: 'opacity .15s',
    },
    // form fields
    label: { fontSize: 12, fontWeight: 600, color: C.steel, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
    select: {
      width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${C.steel}44`,
      background: C.black, color: C.white, fontSize: 14, minHeight: 44, outline: 'none',
      appearance: 'none' as const, cursor: 'pointer',
    },
    input: {
      width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${C.steel}44`,
      background: C.black, color: C.white, fontSize: 14, minHeight: 44, outline: 'none',
      boxSizing: 'border-box' as const,
    },
    textarea: {
      width: '100%', padding: '14px 16px', borderRadius: 8, border: `1px solid ${C.steel}44`,
      background: C.black, color: C.silver, fontSize: 13, lineHeight: 1.7, outline: 'none',
      resize: 'vertical' as const, fontFamily: 'inherit', minHeight: 200,
      boxSizing: 'border-box' as const,
    },
    fieldGroup: { marginBottom: 16 },
    // log table
    logRow: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 8px', borderRadius: 8, cursor: 'pointer', transition: 'background .15s',
    },
    logLeft: { display: 'flex', flexDirection: 'column', gap: 2 },
    logName: { fontSize: 14, fontWeight: 500, color: C.white },
    logMeta: { fontSize: 12, color: C.silver },
    logRight: { display: 'flex', alignItems: 'center', gap: 10 },
    badge: { fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 },
  }

  const tabBtnStyle = (active: boolean): CSSProperties => ({
    flex: 1, padding: '10px', border: 'none', cursor: 'pointer', fontSize: 13,
    fontWeight: 500, minHeight: 40,
    background: active ? C.charcoalLight : 'transparent',
    color: active ? C.gold : C.steel,
    transition: 'all .15s',
  })

  const channelColor = (channel: Channel) =>
    channel === 'email' ? C.blue : channel === 'sms' ? '#E8A838' : C.green

  const channelToggleStyle = (active: boolean, channel: Channel): CSSProperties => ({
    flex: 1, padding: '10px 16px', border: 'none', cursor: 'pointer', fontSize: 13,
    fontWeight: 600, minHeight: 40, borderRadius: 8,
    background: active ? `${channelColor(channel)}22` : 'transparent',
    color: active ? channelColor(channel) : C.steel,
    transition: 'all .15s',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  })

  return (
    <FeatureGate feature="communications">
    <>
      <div style={{ padding: '32px 32px 0', maxWidth: 1400, margin: '0 auto' }}>
        <h1 style={s.heading}>Communications</h1>
      </div>

      <div style={s.page}>
        {/* left sidebar */}
        <div>
          <div style={{ background: C.charcoalLight, borderRadius: 12, padding: '12px 8px' }}>
            <div style={s.sectionLabel}>Email Templates</div>
            {emailTemplates.map(t => (
              <button
                key={t.id}
                style={{
                  ...s.templateBtn,
                  background: selectedTemplate === t.id && activeTab === 'templates' ? `${C.gold}15` : 'transparent',
                  color: selectedTemplate === t.id && activeTab === 'templates' ? C.gold : C.silver,
                }}
                onClick={() => { setSelectedTemplate(t.id); setActiveTab('templates') }}
              >
                <div style={{ ...s.channelIcon, background: `${C.blue}22`, color: C.blue }}>
                  <Mail size={16} />
                </div>
                {t.name}
              </button>
            ))}

            <div style={s.sectionLabel}>WhatsApp Templates</div>
            {waTemplates.map(t => (
              <button
                key={t.id}
                style={{
                  ...s.templateBtn,
                  background: selectedTemplate === t.id && activeTab === 'templates' ? `${C.gold}15` : 'transparent',
                  color: selectedTemplate === t.id && activeTab === 'templates' ? C.gold : C.silver,
                }}
                onClick={() => { setSelectedTemplate(t.id); setActiveTab('templates') }}
              >
                <div style={{ ...s.channelIcon, background: `${C.green}22`, color: C.green }}>
                  <MessageCircle size={16} />
                </div>
                {t.name}
              </button>
            ))}

            <div style={s.sectionLabel}>SMS Templates</div>
            {smsTemplates.map(t => (
              <button
                key={t.id}
                style={{
                  ...s.templateBtn,
                  background: selectedTemplate === t.id && activeTab === 'templates' ? `${C.gold}15` : 'transparent',
                  color: selectedTemplate === t.id && activeTab === 'templates' ? C.gold : C.silver,
                }}
                onClick={() => { setSelectedTemplate(t.id); setActiveTab('templates') }}
              >
                <div style={{ ...s.channelIcon, background: '#E8A83822', color: '#E8A838' }}>
                  <Smartphone size={16} />
                </div>
                {t.name}
              </button>
            ))}
          </div>

          {/* tab toggle */}
          <div style={{ display: 'flex', background: C.black, borderRadius: 8, overflow: 'hidden', marginTop: 12 }}>
            <button style={tabBtnStyle(activeTab === 'templates')} onClick={() => setActiveTab('templates')}>
              Templates
            </button>
            <button style={tabBtnStyle(activeTab === 'compose')} onClick={() => setActiveTab('compose')}>
              Compose
            </button>
            <button style={tabBtnStyle(activeTab === 'history')} onClick={() => setActiveTab('history')}>
              History
            </button>
          </div>
        </div>

        {/* right content */}
        <div style={s.content}>

          {/* ═══════════ TEMPLATES TAB ═══════════ */}
          {activeTab === 'templates' && (
            <div style={s.panel}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                {template.channel === 'email'
                  ? <Mail size={18} color={C.blue} />
                  : template.channel === 'sms'
                  ? <Smartphone size={18} color="#E8A838" />
                  : <MessageCircle size={18} color={C.green} />
                }
                <span style={s.panelTitle}>{template.name}</span>
              </div>
              <p style={s.panelSub}>
                {template.channel === 'email' ? 'Email template' : template.channel === 'sms' ? 'SMS message' : 'WhatsApp message'} — variables shown as {'{{placeholders}}'}
              </p>

              <div style={s.previewBox}>
                {template.subject && (
                  <div style={s.subjectLine}>Subject: {template.subject}</div>
                )}
                {template.body}
              </div>

              <div style={s.actions}>
                <button
                  style={{ ...s.btn, background: C.gold, color: C.black }}
                  onClick={() => handleUseTemplate(template)}
                >
                  <Send size={16} /> Use Template
                </button>
                <button
                  style={{ ...s.btn, background: `${C.steel}33`, color: C.silver }}
                  onClick={() => { navigator.clipboard.writeText(template.body); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                >
                  <Copy size={16} /> Copy Text
                </button>
                {copied && (
                  <span style={{ fontSize: 13, color: C.green, fontWeight: 500 }}>Copied!</span>
                )}
              </div>
            </div>
          )}

          {/* ═══════════ COMPOSE TAB ═══════════ */}
          {activeTab === 'compose' && (
            <div style={s.panel}>
              <div style={s.panelTitle}>Compose Message</div>
              <p style={{ ...s.panelSub, marginBottom: 24 }}>Select a customer and write your message, or use a template to get started.</p>

              {/* Customer selector */}
              <div style={s.fieldGroup}>
                <div style={s.label}>Customer</div>
                <select
                  style={s.select}
                  value={composeCustomerId}
                  onChange={e => handleCustomerChange(e.target.value)}
                >
                  <option value="">-- Select a customer --</option>
                  {sortedCustomers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Channel toggle */}
              <div style={s.fieldGroup}>
                <div style={s.label}>Channel</div>
                <div style={{ display: 'flex', gap: 8, background: C.black, borderRadius: 10, padding: 4 }}>
                  <button
                    style={channelToggleStyle(composeChannel === 'email', 'email')}
                    onClick={() => setComposeChannel('email')}
                  >
                    <Mail size={14} /> Email
                  </button>
                  <button
                    style={channelToggleStyle(composeChannel === 'whatsapp', 'whatsapp')}
                    onClick={() => setComposeChannel('whatsapp')}
                  >
                    <MessageCircle size={14} /> WhatsApp
                  </button>
                  <button
                    style={channelToggleStyle(composeChannel === 'sms', 'sms')}
                    onClick={() => setComposeChannel('sms')}
                  >
                    <Smartphone size={14} /> SMS
                  </button>
                </div>
              </div>

              {/* Template selector (optional) */}
              <div style={s.fieldGroup}>
                <div style={s.label}>Template (optional)</div>
                <select
                  style={s.select}
                  value={composeTemplateId}
                  onChange={e => handleComposeTemplateChange(e.target.value as TemplateId | '')}
                >
                  <option value="">-- No template --</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.channel})</option>
                  ))}
                </select>
              </div>

              {/* Subject line (email only) */}
              {composeChannel === 'email' && (
                <div style={s.fieldGroup}>
                  <div style={s.label}>Subject</div>
                  <input
                    style={s.input}
                    type="text"
                    placeholder="Email subject line..."
                    value={composeSubject}
                    onChange={e => setComposeSubject(e.target.value)}
                  />
                </div>
              )}

              {/* Message body */}
              <div style={s.fieldGroup}>
                <div style={s.label}>Message</div>
                <textarea
                  style={s.textarea}
                  placeholder="Write your message..."
                  value={composeBody}
                  onChange={e => setComposeBody(e.target.value)}
                />
              </div>

              {/* Unresolved variable warning */}
              {composeBody.includes('{{') && (
                <div style={{
                  background: `${C.gold}15`, border: `1px solid ${C.gold}44`, borderRadius: 8,
                  padding: '10px 14px', fontSize: 12, color: C.gold, marginBottom: 16,
                }}>
                  Some template variables are still unresolved. Select a customer or manually replace the {'{{placeholders}}'} before sending.
                </div>
              )}

              {/* SMS character count */}
              {composeChannel === 'sms' && (
                <div style={{
                  fontSize: 12, color: composeBody.length > 320 ? '#D46A6A' : composeBody.length > 160 ? '#E8A838' : C.steel,
                  marginBottom: 8, textAlign: 'right',
                }}>
                  {composeBody.length}/160 chars{composeBody.length > 160 ? ` (${Math.ceil(composeBody.length / 153)} SMS segments)` : ''}
                </div>
              )}

              {/* Send / status */}
              <div style={s.actions}>
                {composeChannel === 'email' ? (
                  <button
                    style={{
                      ...s.btn,
                      background: composeCustomer && composeBody.trim() ? C.gold : `${C.steel}44`,
                      color: composeCustomer && composeBody.trim() ? C.black : C.steel,
                      cursor: composeCustomer && composeBody.trim() ? 'pointer' : 'not-allowed',
                    }}
                    disabled={!composeCustomer || !composeBody.trim()}
                    onClick={handleSend}
                  >
                    <Send size={16} /> Send Email
                  </button>
                ) : composeChannel === 'sms' ? (
                  <button
                    style={{
                      ...s.btn,
                      background: composeCustomer && composeBody.trim() ? '#E8A838' : `${C.steel}44`,
                      color: composeCustomer && composeBody.trim() ? C.black : C.steel,
                      cursor: composeCustomer && composeBody.trim() ? 'pointer' : 'not-allowed',
                    }}
                    disabled={!composeCustomer || !composeBody.trim()}
                    onClick={handleSend}
                  >
                    <Smartphone size={16} /> {isMobileDevice() ? 'Open SMS' : 'Copy SMS Text'}
                  </button>
                ) : (
                  <button
                    style={{
                      ...s.btn,
                      background: composeCustomer && composeBody.trim() ? C.green : `${C.steel}44`,
                      color: composeCustomer && composeBody.trim() ? C.white : C.steel,
                      cursor: composeCustomer && composeBody.trim() ? 'pointer' : 'not-allowed',
                    }}
                    disabled={!composeCustomer || !composeBody.trim()}
                    onClick={handleSend}
                  >
                    <MessageCircle size={16} /> Open WhatsApp
                  </button>
                )}
                <button
                  style={{ ...s.btn, background: `${C.steel}33`, color: C.silver }}
                  onClick={() => { navigator.clipboard.writeText(composeBody); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                >
                  <Copy size={16} /> Copy Text
                </button>
                {copied && (
                  <span style={{ fontSize: 13, color: C.green, fontWeight: 500 }}>Copied!</span>
                )}
                {smsCopied && (
                  <span style={{ fontSize: 13, color: '#E8A838', fontWeight: 500 }}>SMS text copied to clipboard!</span>
                )}
                {composeSent && (
                  <span style={{ fontSize: 13, color: C.green, fontWeight: 500 }}>
                    <CheckCircle2 size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    Message opened and logged!
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ═══════════ HISTORY TAB ═══════════ */}
          {activeTab === 'history' && (
            <div style={s.panel}>
              <div style={s.panelTitle}>Communication History</div>
              <p style={{ ...s.panelSub, marginBottom: 16 }}>
                {filteredComms.length} message{filteredComms.length !== 1 ? 's' : ''} found
              </p>

              {/* Filters row */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                {/* Search */}
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                  <Search size={14} color={C.steel} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder="Search by customer name..."
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                    style={{
                      ...s.input,
                      paddingLeft: 34,
                      fontSize: 13,
                    }}
                  />
                </div>
                {/* Channel filter */}
                <div style={{ display: 'flex', background: C.black, borderRadius: 8, overflow: 'hidden' }}>
                  {(['all', 'email', 'whatsapp', 'sms'] as const).map(f => (
                    <button
                      key={f}
                      style={{
                        padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 12,
                        fontWeight: 600, minHeight: 40,
                        background: historyFilter === f ? C.charcoalLight : 'transparent',
                        color: historyFilter === f ? C.gold : C.steel,
                        transition: 'all .15s',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}
                      onClick={() => setHistoryFilter(f)}
                    >
                      {f === 'all' && <><Filter size={12} /> All</>}
                      {f === 'email' && <><Mail size={12} /> Email</>}
                      {f === 'whatsapp' && <><MessageCircle size={12} /> WhatsApp</>}
                      {f === 'sms' && <><Smartphone size={12} /> SMS</>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comm rows */}
              {filteredComms.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: C.steel, fontSize: 14 }}>
                  {comms.length === 0
                    ? 'No communications yet.'
                    : 'No communications found.'}
                </div>
              )}
              {filteredComms.map((comm, i) => (
                <div
                  key={comm.id}
                  style={{
                    ...s.logRow,
                    borderBottom: i < filteredComms.length - 1 ? `1px solid ${C.steel}1A` : 'none',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${C.steel}22` }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  onClick={() => setSelectedComm(comm)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      ...s.channelIcon,
                      background: comm.channel === 'email' ? `${C.blue}22` : comm.channel === 'sms' ? '#E8A83822' : `${C.green}22`,
                      color: comm.channel === 'email' ? C.blue : comm.channel === 'sms' ? '#E8A838' : C.green,
                    }}>
                      {comm.channel === 'email' ? <Mail size={14} /> : comm.channel === 'sms' ? <Smartphone size={14} /> : <MessageCircle size={14} />}
                    </div>
                    <div style={s.logLeft}>
                      <span style={s.logName}>{comm.customerName}</span>
                      <span style={s.logMeta}>{comm.templateName} · {formatCommDate(comm.date)}</span>
                    </div>
                  </div>
                  <div style={s.logRight}>
                    <span style={{
                      ...s.badge,
                      color: statusColor[comm.status] || C.steel,
                      background: (statusColor[comm.status] || C.steel) + '1A',
                    }}>
                      {statusIcon[comm.status] || <Clock size={14} />}
                      {comm.status}
                    </span>
                    <ChevronRight size={14} color={C.steel} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════ HISTORY DETAIL MODAL ═══════════ */}
      {selectedComm && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 9999,
          }}
          onClick={() => setSelectedComm(null)}
        >
          <div
            style={{
              background: C.charcoalLight, borderRadius: 14, padding: '28px 32px',
              minWidth: 420, maxWidth: 560, boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
              border: `1px solid ${C.steel}33`, maxHeight: '80vh', overflowY: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontSize: 18, fontWeight: 600, color: C.white }}>Message Details</span>
              <button
                onClick={() => setSelectedComm(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.steel, padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              {[
                { label: 'Customer', value: selectedComm.customerName },
                { label: 'Template', value: selectedComm.templateName },
                { label: 'Channel', value: selectedComm.channel === 'email' ? 'Email' : selectedComm.channel === 'sms' ? 'SMS' : 'WhatsApp' },
                { label: 'Date', value: formatCommDate(selectedComm.date) },
                { label: 'Status', value: selectedComm.status },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: C.steel, fontWeight: 500 }}>{row.label}</span>
                  <span style={{
                    fontSize: 14, fontWeight: 500,
                    color: row.label === 'Status' ? (statusColor[selectedComm.status] || C.white) : C.white,
                  }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Full message body */}
            {selectedComm.body && (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.steel, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>Message Body</div>
                <div style={{
                  ...s.previewBox,
                  maxHeight: 240,
                }}>
                  {selectedComm.body}
                </div>
              </>
            )}

            <button
              onClick={() => setSelectedComm(null)}
              style={{
                ...s.btn,
                background: `${C.steel}33`, color: C.silver,
                width: '100%', justifyContent: 'center', marginTop: 24,
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
    </FeatureGate>
  )
}
