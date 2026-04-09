import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Calendar, CreditCard, Check, Mail, MessageCircle, ArrowRight } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useTheme } from '../theme/ThemeContext'
import { useData } from '../data/DataContext'
import { buildFromName } from '../lib/send-email'
import { exportInvoicesCSV, exportExpensesCSV, exportContactsCSV } from '../lib/xero-export'
import { exportAllEvents } from '../lib/calendar-export'
import SettingsNav from '../components/SettingsNav'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Integrations() {
  const { C } = useTheme()
  const navigate = useNavigate()
  const { invoices, expenses, customers, events, settings, isDataLoading } = useData()
  const [exportedType, setExportedType] = useState<string | null>(null)

  const biz = settings.business
  const fromDisplayName = buildFromName(biz)
  const replyToAddress = biz.email || ''
  const emailReady = Boolean(biz.businessName && biz.email)

  const showExportFeedback = (type: string) => {
    setExportedType(type)
    setTimeout(() => setExportedType(null), 3000)
  }

  const handleExportInvoices = () => {
    exportInvoicesCSV(invoices)
    showExportFeedback('invoices')
  }

  const handleExportExpenses = () => {
    exportExpensesCSV(expenses)
    showExportFeedback('expenses')
  }

  const handleExportContacts = () => {
    exportContactsCSV(customers)
    showExportFeedback('contacts')
  }

  /* ── Styles ── */
  const s: Record<string, CSSProperties> = {
    page: { padding: '24px 28px 80px', maxWidth: 800, margin: '0 auto' },
    title: { fontSize: 24, fontWeight: 700, color: C.white, fontFamily: "'Cinzel', serif", marginBottom: 6 },
    subtitle: { fontSize: 14, color: C.silver, marginBottom: 28 },
    card: {
      background: C.charcoal, borderRadius: 14, border: `1px solid ${C.steel}22`,
      padding: 24, marginBottom: 16, display: 'flex', gap: 20,
    },
    iconBox: {
      width: 52, height: 52, borderRadius: 12, display: 'flex',
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    cardContent: { flex: 1, minWidth: 0 },
    cardTitle: { fontSize: 17, fontWeight: 700, color: C.white, marginBottom: 4 },
    cardDesc: { fontSize: 13, color: C.silver, marginBottom: 14, lineHeight: 1.5 },
    btnRow: { display: 'flex', gap: 8, flexWrap: 'wrap' as const },
    exportBtn: {
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
      cursor: 'pointer', minHeight: 38, border: 'none',
      transition: 'opacity .15s',
    },
    comingSoon: {
      fontSize: 12, fontWeight: 600, color: C.steel, textTransform: 'uppercase' as const,
      letterSpacing: 1, padding: '6px 14px', borderRadius: 8,
      background: `${C.steel}11`, border: `1px solid ${C.steel}22`,
      display: 'inline-block',
    },
    statusBadge: {
      fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20,
      display: 'inline-flex', alignItems: 'center', gap: 6,
    },
    feedbackMsg: {
      fontSize: 13, color: '#6ABF8A', padding: '8px 14px', borderRadius: 8,
      background: '#6ABF8A11', textAlign: 'center' as const, marginTop: 12,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    },
    statRow: {
      display: 'flex', gap: 16, marginBottom: 14,
    },
    stat: {
      fontSize: 12, color: C.steel,
    },
    statValue: {
      fontWeight: 700, color: C.white, fontSize: 16, marginRight: 4,
    },
  }

  if (isDataLoading) {
    return (
      <div style={s.page}>
        <div style={s.title}>Integrations</div>
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div style={s.page}>
      <SettingsNav active="integrations" />
      <div style={s.title}>Integrations</div>
      <div style={s.subtitle}>Connect your tools and export data for your accounting software.</div>

      {/* Email */}
      <div style={s.card}>
        <div style={{ ...s.iconBox, background: `${C.gold}15` }}>
          <Mail size={24} color={C.gold} />
        </div>
        <div style={s.cardContent}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
            <div style={s.cardTitle}>Customer Email</div>
            <span style={{
              ...s.statusBadge,
              color: emailReady ? '#6ABF8A' : '#D46A6A',
              background: emailReady ? '#6ABF8A15' : '#D46A6A15',
            }}>
              <Check size={12} /> {emailReady ? 'Ready' : 'Needs setup'}
            </span>
          </div>
          <div style={s.cardDesc}>
            Quotes and invoices are sent through Varda's mail service so you don't have to set anything up.
            Customers see <strong style={{ color: C.white }}>your business name</strong> in their inbox and replies
            come straight to your email.
          </div>

          {/* Live preview of how an email will appear */}
          <div style={{
            background: C.black, borderRadius: 10, padding: '14px 16px',
            border: `1px solid ${C.steel}33`, marginBottom: 14,
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.steel, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              Inbox preview
            </div>
            <div style={{ fontSize: 13, color: C.silver, marginBottom: 4 }}>
              <span style={{ color: C.steel }}>From:</span>{' '}
              <span style={{ color: C.white, fontWeight: 600 }}>{fromDisplayName}</span>
            </div>
            <div style={{ fontSize: 13, color: C.silver }}>
              <span style={{ color: C.steel }}>Reply‑to:</span>{' '}
              <span style={{ color: replyToAddress ? C.white : '#D46A6A' }}>
                {replyToAddress || 'Add your email in Business settings'}
              </span>
            </div>
          </div>

          <div style={s.btnRow}>
            <button
              style={{ ...s.exportBtn, background: `${C.gold}20`, color: C.gold }}
              onClick={() => navigate('/settings')}
            >
              Edit business details <ArrowRight size={14} />
            </button>
          </div>

          <div style={{ fontSize: 12, color: C.steel, marginTop: 12, fontStyle: 'italic' }}>
            Connect your own Gmail or SMTP account so emails come from your own address — coming soon.
          </div>
        </div>
      </div>

      {/* WhatsApp */}
      <div style={s.card}>
        <div style={{ ...s.iconBox, background: '#25D36615' }}>
          <MessageCircle size={24} color="#25D366" />
        </div>
        <div style={s.cardContent}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
            <div style={s.cardTitle}>WhatsApp</div>
            <span style={{ ...s.statusBadge, color: C.steel, background: `${C.steel}15` }}>
              Manual send
            </span>
          </div>
          <div style={s.cardDesc}>
            When you choose WhatsApp on a quote, Varda opens WhatsApp Web with the message pre‑filled — you just hit
            send. There's no public API for sending WhatsApp messages from a small business account directly.
          </div>
          <div style={{ fontSize: 12, color: C.steel, marginTop: 4, fontStyle: 'italic' }}>
            Automatic sending via WhatsApp Business (Twilio) coming soon for higher‑volume users.
          </div>
        </div>
      </div>

      {/* Xero */}
      <div style={s.card}>
        <div style={{ ...s.iconBox, background: '#13B5EA15' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" fill="#13B5EA" opacity="0.15"/>
            <path d="M7.5 8.5l3 3.5-3 3.5M10.5 15.5h5M16.5 8.5l-3 3.5 3 3.5" stroke="#13B5EA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div style={s.cardContent}>
          <div style={s.cardTitle}>Xero</div>
          <div style={s.cardDesc}>
            Export your data in Xero-compatible CSV format for easy import into your accounting software.
          </div>

          <div style={s.statRow}>
            <div style={s.stat}><span style={s.statValue}>{invoices.length}</span> invoices</div>
            <div style={s.stat}><span style={s.statValue}>{expenses.length}</span> expenses</div>
            <div style={s.stat}><span style={s.statValue}>{customers.length}</span> contacts</div>
          </div>

          <div style={s.btnRow}>
            <button
              style={{ ...s.exportBtn, background: '#13B5EA20', color: '#13B5EA' }}
              onClick={handleExportInvoices}
              disabled={invoices.length === 0}
            >
              <Download size={14} /> Export Invoices
            </button>
            <button
              style={{ ...s.exportBtn, background: '#13B5EA20', color: '#13B5EA' }}
              onClick={handleExportExpenses}
              disabled={expenses.length === 0}
            >
              <Download size={14} /> Export Expenses
            </button>
            <button
              style={{ ...s.exportBtn, background: '#13B5EA20', color: '#13B5EA' }}
              onClick={handleExportContacts}
              disabled={customers.length === 0}
            >
              <Download size={14} /> Export Contacts
            </button>
          </div>

          {exportedType && (
            <div style={s.feedbackMsg}>
              <Check size={14} /> {exportedType.charAt(0).toUpperCase() + exportedType.slice(1)} exported successfully
            </div>
          )}

          <div style={{ fontSize: 12, color: C.steel, marginTop: 12, fontStyle: 'italic' }}>
            Full Xero sync with automatic reconciliation coming soon.
          </div>
        </div>
      </div>

      {/* Google Calendar */}
      <div style={s.card}>
        <div style={{ ...s.iconBox, background: '#4285F415' }}>
          <Calendar size={24} color="#4285F4" />
        </div>
        <div style={s.cardContent}>
          <div style={s.cardTitle}>Export to Calendar</div>
          <div style={s.cardDesc}>
            Download your schedule as a .ics file to import into Google Calendar, Apple Calendar, or Outlook.
          </div>

          <div style={s.statRow}>
            <div style={s.stat}><span style={s.statValue}>{events.length}</span> events</div>
          </div>

          <div style={s.btnRow}>
            <button
              style={{ ...s.exportBtn, background: '#4285F420', color: '#4285F4' }}
              onClick={() => exportAllEvents(events, customers)}
              disabled={events.length === 0}
            >
              <Download size={14} /> Export All Events
            </button>
          </div>

          <div style={{ fontSize: 12, color: C.steel, marginTop: 12, fontStyle: 'italic' }}>
            Full Google Calendar sync coming soon.
          </div>
        </div>
      </div>

      {/* Stripe */}
      <div style={s.card}>
        <div style={{ ...s.iconBox, background: '#635BFF15' }}>
          <CreditCard size={24} color="#635BFF" />
        </div>
        <div style={s.cardContent}>
          <div style={s.cardTitle}>Stripe</div>
          <div style={s.cardDesc}>
            Accept card payments directly from your invoices. Customers can pay online with a single click.
          </div>
          <span style={{ ...s.statusBadge, color: C.steel, background: `${C.steel}15` }}>
            Not Connected
          </span>
        </div>
      </div>
    </div>
  )
}
