import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle, Clock, FileText, Phone, Mail, Globe, AlertTriangle, Banknote, CreditCard } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { CSSProperties } from 'react'

/**
 * Public invoice view — rendered for `/invoice/:invoiceId`. Lives outside the
 * authenticated DataProvider tree so it must fetch its own data via the
 * `get_public_invoice` SECURITY DEFINER RPC.
 */

interface PublicInvoice {
  id: string
  ref: string
  customer_name: string
  job_type_name: string
  description: string
  type: string | null
  net_total: number
  vat: number
  grand_total: number
  status: 'Draft' | 'Sent' | 'Viewed' | 'Paid' | 'Voided'
  created_at: string
  sent_at: string | null
  paid_at: string | null
  due_date: string
}

interface PublicCustomer {
  name: string
  address1: string | null
  address2: string | null
  city: string | null
  postcode: string | null
}

interface PublicQuoteInfo {
  certificates: number
}

interface PublicBusiness {
  businessName?: string
  ownerName?: string
  phone?: string
  email?: string
  website?: string
  address1?: string
  city?: string
  county?: string
  postcode?: string
}

interface PublicQuoteConfig {
  bankName?: string
  sortCode?: string
  accountNumber?: string
  paymentTerms?: number
  footer?: string
}

interface PublicInvoicePayload {
  invoice: PublicInvoice
  customer: PublicCustomer | null
  quote: PublicQuoteInfo | null
  business: PublicBusiness
  quoteConfig: PublicQuoteConfig
}

function fmtCurrency(n: number): string {
  return '£' + Number(n).toFixed(2)
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function InvoiceView() {
  const { invoiceId } = useParams<{ invoiceId: string }>()
  const [searchParams] = useSearchParams()
  const justPaid = searchParams.get('paid') === 'true'

  const [payload, setPayload] = useState<PublicInvoicePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState('')
  const [showBankFallback, setShowBankFallback] = useState(false)

  // Fetch the invoice on mount
  useEffect(() => {
    if (!invoiceId) {
      setNotFound(true)
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.rpc('get_public_invoice', { p_invoice_id: invoiceId })
      if (cancelled) return
      if (error || !data) {
        console.error('[InvoiceView] failed to load invoice', error)
        setNotFound(true)
        setLoading(false)
        return
      }
      setPayload(data as PublicInvoicePayload)
      setLoading(false)
      // Mark as viewed (best-effort)
      if ((data as PublicInvoicePayload).invoice.status === 'Sent') {
        void supabase.rpc('mark_invoice_viewed', { p_invoice_id: invoiceId }).then(() => {}, () => {})
      }
    })()
    return () => { cancelled = true }
  }, [invoiceId])

  // ── Loading / not-found states ──
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#1A1C20', color: '#C9CDD2', gap: 12 }}>
        <FileText size={48} color="#4B5057" />
        <div style={{ fontSize: 16, color: '#4B5057' }}>Loading invoice…</div>
      </div>
    )
  }

  if (notFound || !payload) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#1A1C20', color: '#C9CDD2', gap: 12 }}>
        <FileText size={48} color="#4B5057" />
        <div style={{ fontSize: 20, fontWeight: 600 }}>Invoice not found</div>
        <div style={{ fontSize: 14, color: '#4B5057' }}>This invoice may have been removed or the link is incorrect.</div>
      </div>
    )
  }

  const { invoice, customer, quote, business, quoteConfig } = payload
  const businessName = business.businessName || 'Business'

  // Determine if overdue
  const today = new Date().toISOString().split('T')[0]
  const isOverdue = invoice.status !== 'Paid' && invoice.due_date < today
  const isPaid = invoice.status === 'Paid'
  const isDraft = invoice.status === 'Draft'

  const gold = '#C6A86A'
  const bg = '#1A1C20'
  const card = '#24272D'
  const cardLight = '#2E3138'
  const steel = '#4B5057'
  const silver = '#C9CDD2'
  const white = '#F5F5F3'
  const green = '#6ABF8A'
  const red = '#D46A6A'

  const s: Record<string, CSSProperties> = {
    page: { minHeight: '100vh', background: bg, padding: '40px 20px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' },
    card: { width: '100%', maxWidth: 680, background: card, borderRadius: 24, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.5)' },
    paidBanner: {
      width: '100%', padding: '14px 40px', background: `${green}18`,
      borderBottom: `2px solid ${green}44`, fontSize: 15, fontWeight: 700, color: green,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    },
    overdueBanner: {
      width: '100%', padding: '14px 40px', background: `${red}18`,
      borderBottom: `2px solid ${red}44`, fontSize: 15, fontWeight: 700, color: red,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    },
    pendingBanner: {
      width: '100%', padding: '14px 40px', background: `${gold}12`,
      borderBottom: `2px solid ${gold}33`, fontSize: 15, fontWeight: 700, color: gold,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    },
    successBanner: {
      width: '100%', padding: '14px 40px', background: `${green}18`,
      borderBottom: `2px solid ${green}44`, fontSize: 15, fontWeight: 700, color: green,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    },
    headerBand: { background: `linear-gradient(135deg, #2B2E34 0%, #33363D 100%)`, padding: '36px 40px 32px', borderBottom: `3px solid ${gold}` },
    headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
    brand: { fontFamily: "'Cinzel', serif", fontSize: 26, fontWeight: 700, color: gold, letterSpacing: 0.5 },
    brandSub: { fontSize: 11, color: steel, letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 },
    docBadge: { textAlign: 'right' },
    docTitle: { fontSize: 12, fontWeight: 600, color: steel, textTransform: 'uppercase', letterSpacing: 1.5 },
    docRef: { fontSize: 22, fontWeight: 700, color: white, marginTop: 2 },
    body: { padding: '32px 40px 36px' },
    addressRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 32, marginBottom: 28 },
    addressBlock: {},
    addressLabel: { fontSize: 10, fontWeight: 700, color: gold, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
    addressName: { fontSize: 16, fontWeight: 600, color: white, marginBottom: 4 },
    addressLine: { fontSize: 13, color: silver, lineHeight: 1.6 },
    dateRow: {
      background: cardLight, borderRadius: 12, padding: '14px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 28, border: `1px solid ${steel}33`, gap: 12, flexWrap: 'wrap' as const,
    },
    dateLabel: { fontSize: 12, color: steel, fontWeight: 500 },
    dateValue: { fontSize: 13, color: gold, fontWeight: 600 },
    lineItem: { display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${steel}1A`, alignItems: 'flex-start', gap: 12 },
    lineDesc: { flex: 1, minWidth: 0 },
    lineTitle: { fontSize: 15, fontWeight: 600, color: white },
    lineSub: { fontSize: 12, color: steel, marginTop: 2 },
    lineAmount: { fontSize: 15, fontWeight: 600, color: white, textAlign: 'right', minWidth: 90 },
    totalsWrap: { marginTop: 20, marginLeft: 'auto', maxWidth: 300 },
    totalRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14, color: silver },
    grandRow: {
      display: 'flex', justifyContent: 'space-between', padding: '14px 0 0',
      fontSize: 24, fontWeight: 700, color: gold, borderTop: `3px solid ${gold}`, marginTop: 8,
    },
    paymentBox: { background: cardLight, borderRadius: 12, padding: '20px', marginTop: 24, border: `1px solid ${steel}22` },
    paymentLabel: { fontSize: 10, fontWeight: 700, color: gold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
    paymentGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' },
    paymentFieldLabel: { fontSize: 11, color: steel, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 },
    paymentFieldValue: { fontSize: 14, color: white, marginBottom: 8 },
    notesBox: { background: cardLight, borderRadius: 12, padding: '16px 20px', marginTop: 24, border: `1px solid ${steel}22` },
    notesLabel: { fontSize: 10, fontWeight: 700, color: steel, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
    notesText: { fontSize: 13, color: silver, lineHeight: 1.7, whiteSpace: 'pre-wrap' },
    footer: {
      background: cardLight, padding: '20px 40px', display: 'flex', alignItems: 'center',
      justifyContent: 'center', gap: 24, flexWrap: 'wrap',
    },
    footerItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: steel },
  }

  // Certification amount from linked quote, if available
  const certAmount = quote && quote.certificates > 0 ? quote.certificates : 0
  const jobAmount = invoice.net_total - certAmount

  const websiteDisplay = (business.website || '').replace('https://', '').replace('http://', '')

  return (
    <div style={s.page}>
      <div style={s.card}>
        {/* Payment Success Banner (from Stripe redirect) */}
        {justPaid && !isPaid && (
          <div style={s.successBanner}>
            <CheckCircle size={18} /> Payment successful — thank you! Your invoice will be updated shortly.
          </div>
        )}

        {/* Status Banner */}
        {isPaid && (
          <div style={s.paidBanner}>
            <CheckCircle size={18} /> Payment Received — Thank you
          </div>
        )}
        {isOverdue && !isPaid && (
          <div style={s.overdueBanner}>
            <AlertTriangle size={18} /> Payment Overdue — was due {fmtDate(invoice.due_date)}
          </div>
        )}
        {!isPaid && !isOverdue && (isDraft || invoice.status === 'Sent' || invoice.status === 'Viewed') && (
          <div style={s.pendingBanner}>
            <Clock size={18} /> Payment Due — {fmtDate(invoice.due_date)}
          </div>
        )}

        {/* Header Band */}
        <div style={s.headerBand}>
          <div style={s.headerRow}>
            <div>
              <div style={s.brand}>{businessName.replace(' Electrical', '')}</div>
              <div style={s.brandSub}>Electrical Services</div>
            </div>
            <div style={s.docBadge as CSSProperties}>
              <div style={s.docTitle}>Invoice</div>
              <div style={s.docRef}>{invoice.ref}</div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={s.body}>
          {/* Addresses */}
          <div style={s.addressRow}>
            <div style={s.addressBlock}>
              <div style={s.addressLabel}>Invoice To</div>
              <div style={s.addressName}>{invoice.customer_name}</div>
              {customer && (
                <div style={s.addressLine}>
                  {customer.address1 && <>{customer.address1}<br /></>}
                  {customer.address2 && <>{customer.address2}<br /></>}
                  {customer.city && <>{customer.city}<br /></>}
                  {customer.postcode}
                </div>
              )}
            </div>
            <div style={{ ...s.addressBlock, textAlign: 'right' } as CSSProperties}>
              <div style={s.addressLabel}>From</div>
              <div style={s.addressName}>{businessName}</div>
              <div style={s.addressLine}>
                {business.address1 && <>{business.address1}<br /></>}
                {business.city}{business.county ? `, ${business.county}` : ''}<br />
                {business.postcode && <>{business.postcode}<br /></>}
                {business.email}<br />
                {websiteDisplay}
              </div>
            </div>
          </div>

          {/* Dates */}
          <div style={s.dateRow}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={14} color={steel} />
              <span style={s.dateLabel}>Invoice Date: <span style={s.dateValue}>{fmtDate(invoice.created_at)}</span></span>
            </div>
            <span style={s.dateLabel}>Due: <span style={s.dateValue}>{fmtDate(invoice.due_date)}</span></span>
          </div>

          {/* Job line item */}
          <div style={s.lineItem}>
            <div style={s.lineDesc}>
              <div style={s.lineTitle}>{invoice.job_type_name}</div>
              {invoice.description && <div style={s.lineSub}>{invoice.description}</div>}
            </div>
            <div style={s.lineAmount as CSSProperties}>{fmtCurrency(jobAmount)}</div>
          </div>

          {/* Certification as separate line if applicable */}
          {certAmount > 0 && (
            <div style={s.lineItem}>
              <div style={s.lineDesc}>
                <div style={s.lineTitle}>Electrical certification & building control notification</div>
              </div>
              <div style={s.lineAmount as CSSProperties}>{fmtCurrency(certAmount)}</div>
            </div>
          )}

          {/* Totals */}
          <div style={s.totalsWrap}>
            <div style={s.totalRow}><span>Subtotal</span><span style={{ color: white }}>{fmtCurrency(invoice.net_total)}</span></div>
            <div style={s.totalRow}><span>VAT (20%)</span><span style={{ color: white }}>{fmtCurrency(invoice.vat)}</span></div>
            <div style={s.grandRow}><span>Total</span><span>{fmtCurrency(invoice.grand_total)}</span></div>
          </div>

          {/* Pay Now button for unpaid invoices */}
          {!isPaid && !justPaid && (
            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                onClick={async () => {
                  setPayLoading(true)
                  setPayError('')
                  try {
                    const { data, error } = await supabase.functions.invoke('create-invoice-payment', {
                      body: { invoiceId: invoice.id },
                    })
                    if (error) throw error
                    if (data?.url) {
                      window.location.href = data.url
                    } else {
                      throw new Error('No checkout URL returned')
                    }
                  } catch {
                    setPayError('Online payments are not yet configured. Please use bank transfer details below.')
                    setShowBankFallback(true)
                  } finally {
                    setPayLoading(false)
                  }
                }}
                disabled={payLoading}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  padding: '16px 24px', borderRadius: 12, border: 'none', cursor: payLoading ? 'wait' : 'pointer',
                  background: `linear-gradient(135deg, ${gold} 0%, #D4B876 100%)`,
                  color: '#1A1C20', fontSize: 18, fontWeight: 700, letterSpacing: 0.3,
                  boxShadow: `0 4px 16px ${gold}44`, transition: 'transform .15s, box-shadow .15s',
                  opacity: payLoading ? 0.7 : 1, minHeight: 56,
                }}
                onMouseEnter={(e) => { if (!payLoading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 6px 24px ${gold}55` } }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `0 4px 16px ${gold}44` }}
              >
                <CreditCard size={22} />
                {payLoading ? 'Processing...' : `Pay Now — £${Number(invoice.grand_total).toFixed(2)}`}
              </button>

              {payError && (
                <div style={{
                  fontSize: 13, color: gold, padding: '10px 14px', borderRadius: 8,
                  background: `${gold}11`, border: `1px solid ${gold}33`, textAlign: 'center',
                }}>
                  {payError}
                </div>
              )}
            </div>
          )}

          {/* Bank transfer details */}
          {!isPaid && (showBankFallback || quoteConfig.bankName || quoteConfig.sortCode || quoteConfig.accountNumber) && (
            <div style={{ ...s.paymentBox, marginTop: payError ? 12 : 24 }}>
              <div style={s.paymentLabel}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Banknote size={14} /> Bank Transfer Details
                </span>
              </div>
              <div style={s.paymentGrid}>
                {quoteConfig.bankName && (
                  <>
                    <div style={s.paymentFieldLabel}>Bank</div>
                    <div style={s.paymentFieldValue}>{quoteConfig.bankName}</div>
                  </>
                )}
                {quoteConfig.sortCode && (
                  <>
                    <div style={s.paymentFieldLabel}>Sort Code</div>
                    <div style={s.paymentFieldValue}>{quoteConfig.sortCode}</div>
                  </>
                )}
                {quoteConfig.accountNumber && (
                  <>
                    <div style={s.paymentFieldLabel}>Account Number</div>
                    <div style={s.paymentFieldValue}>{quoteConfig.accountNumber}</div>
                  </>
                )}
                <div style={s.paymentFieldLabel}>Payment Reference</div>
                <div style={{ ...s.paymentFieldValue, color: gold, fontWeight: 600 }}>{invoice.ref}</div>
              </div>
            </div>
          )}

          {/* Terms */}
          <div style={s.notesBox}>
            <div style={s.notesLabel}>Terms & Conditions</div>
            <div style={s.notesText}>
              Payment is due within {quoteConfig.paymentTerms || 14} days of the invoice date. All electrical work has been carried out in accordance with BS 7671 (18th Edition) and relevant Part P Building Regulations. Work is guaranteed for 12 months from completion. Late payments may incur additional charges.
            </div>
          </div>

          {/* Footer text */}
          {quoteConfig.footer && (
            <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: steel, fontStyle: 'italic' } as CSSProperties}>
              {quoteConfig.footer}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={s.footer as CSSProperties}>
          {business.phone && <span style={s.footerItem}><Phone size={12} /> {business.phone}</span>}
          {business.email && <span style={s.footerItem}><Mail size={12} /> {business.email}</span>}
          {websiteDisplay && <span style={s.footerItem}><Globe size={12} /> {websiteDisplay}</span>}
        </div>
      </div>
    </div>
  )
}
