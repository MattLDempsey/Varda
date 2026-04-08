import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { CheckCircle, Clock, FileText, Phone, Mail, Globe, AlertTriangle, Banknote, CreditCard } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { CSSProperties } from 'react'

function fmtCurrency(n: number): string {
  return '£' + n.toFixed(2)
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function InvoiceView() {
  const { invoiceId } = useParams<{ invoiceId: string }>()
  const { invoices, quotes, customers, settings } = useData()
  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState('')
  const [showBankFallback, setShowBankFallback] = useState(false)

  const invoice = invoices.find(i => i.id === invoiceId)

  if (!invoice) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#1A1C20', color: '#C9CDD2', gap: 12 }}>
        <FileText size={48} color="#4B5057" />
        <div style={{ fontSize: 20, fontWeight: 600 }}>Invoice not found</div>
        <div style={{ fontSize: 14, color: '#4B5057' }}>This invoice may have been removed or the link is incorrect.</div>
      </div>
    )
  }

  const customer = invoice.customerId ? customers.find(c => c.id === invoice.customerId) : undefined
  const linkedQuote = invoice.quoteId ? quotes.find(q => q.id === invoice.quoteId) : undefined

  // Determine if overdue
  const today = new Date().toISOString().split('T')[0]
  const isOverdue = invoice.status !== 'Paid' && invoice.dueDate < today
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
    // status banner
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
    // header band
    headerBand: { background: `linear-gradient(135deg, #2B2E34 0%, #33363D 100%)`, padding: '36px 40px 32px', borderBottom: `3px solid ${gold}` },
    headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
    brand: { fontFamily: "'Cinzel', serif", fontSize: 26, fontWeight: 700, color: gold, letterSpacing: 0.5 },
    brandSub: { fontSize: 11, color: steel, letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 },
    docBadge: { textAlign: 'right' },
    docTitle: { fontSize: 12, fontWeight: 600, color: steel, textTransform: 'uppercase', letterSpacing: 1.5 },
    docRef: { fontSize: 22, fontWeight: 700, color: white, marginTop: 2 },
    // body
    body: { padding: '32px 40px 36px' },
    // addresses
    addressRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 28 },
    addressBlock: {},
    addressLabel: { fontSize: 10, fontWeight: 700, color: gold, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
    addressName: { fontSize: 16, fontWeight: 600, color: white, marginBottom: 4 },
    addressLine: { fontSize: 13, color: silver, lineHeight: 1.6 },
    // dates
    dateRow: {
      background: cardLight, borderRadius: 12, padding: '14px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 28, border: `1px solid ${steel}33`,
    },
    dateLabel: { fontSize: 12, color: steel, fontWeight: 500 },
    dateValue: { fontSize: 13, color: gold, fontWeight: 600 },
    // line items
    lineItem: { display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${steel}1A`, alignItems: 'flex-start' },
    lineDesc: { flex: 1 },
    lineTitle: { fontSize: 15, fontWeight: 600, color: white },
    lineSub: { fontSize: 12, color: steel, marginTop: 2 },
    lineAmount: { fontSize: 15, fontWeight: 600, color: white, textAlign: 'right', minWidth: 90 },
    // totals
    totalsWrap: { marginTop: 20, marginLeft: 'auto', maxWidth: 300 },
    totalRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14, color: silver },
    grandRow: {
      display: 'flex', justifyContent: 'space-between', padding: '14px 0 0',
      fontSize: 24, fontWeight: 700, color: gold, borderTop: `3px solid ${gold}`, marginTop: 8,
    },
    // payment details
    paymentBox: { background: cardLight, borderRadius: 12, padding: '20px', marginTop: 24, border: `1px solid ${steel}22` },
    paymentLabel: { fontSize: 10, fontWeight: 700, color: gold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
    paymentGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' },
    paymentFieldLabel: { fontSize: 11, color: steel, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 },
    paymentFieldValue: { fontSize: 14, color: white, marginBottom: 8 },
    // notes
    notesBox: { background: cardLight, borderRadius: 12, padding: '16px 20px', marginTop: 24, border: `1px solid ${steel}22` },
    notesLabel: { fontSize: 10, fontWeight: 700, color: steel, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
    notesText: { fontSize: 13, color: silver, lineHeight: 1.7, whiteSpace: 'pre-wrap' },
    // footer
    footer: {
      background: cardLight, padding: '20px 40px', display: 'flex', alignItems: 'center',
      justifyContent: 'center', gap: 24, flexWrap: 'wrap',
    },
    footerItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: steel },
  }

  // Certification amount from linked quote, if available
  const certAmount = linkedQuote && linkedQuote.certificates > 0 ? linkedQuote.certificates : 0
  const jobAmount = invoice.netTotal - certAmount

  return (
    <div style={s.page}>
      <div style={s.card}>
        {/* ── Status Banner ── */}
        {isPaid && (
          <div style={s.paidBanner}>
            <CheckCircle size={18} /> Payment Received — Thank you
          </div>
        )}
        {isOverdue && !isPaid && (
          <div style={s.overdueBanner}>
            <AlertTriangle size={18} /> Payment Overdue — was due {fmtDate(invoice.dueDate)}
          </div>
        )}
        {!isPaid && !isOverdue && (isDraft || invoice.status === 'Sent' || invoice.status === 'Viewed') && (
          <div style={s.pendingBanner}>
            <Clock size={18} /> Payment Due — {fmtDate(invoice.dueDate)}
          </div>
        )}

        {/* ── Header Band ── */}
        <div style={s.headerBand}>
          <div style={s.headerRow}>
            <div>
              <div style={s.brand}>{settings.business.businessName.replace(' Electrical', '')}</div>
              <div style={s.brandSub}>Electrical Services</div>
            </div>
            <div style={s.docBadge as CSSProperties}>
              <div style={s.docTitle}>Invoice</div>
              <div style={s.docRef}>{invoice.ref}</div>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={s.body}>
          {/* Addresses */}
          <div style={s.addressRow}>
            <div style={s.addressBlock}>
              <div style={s.addressLabel}>Invoice To</div>
              <div style={s.addressName}>{invoice.customerName}</div>
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
              <div style={s.addressName}>{settings.business.businessName}</div>
              <div style={s.addressLine}>
                {settings.business.address1 && <>{settings.business.address1}<br /></>}
                {settings.business.city}{settings.business.county ? `, ${settings.business.county}` : ''}<br />
                {settings.business.postcode && <>{settings.business.postcode}<br /></>}
                {settings.business.email}<br />
                {settings.business.website.replace('https://', '')}
              </div>
            </div>
          </div>

          {/* Dates */}
          <div style={s.dateRow}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={14} color={steel} />
              <span style={s.dateLabel}>Invoice Date: <span style={s.dateValue}>{fmtDate(invoice.createdAt)}</span></span>
            </div>
            <span style={s.dateLabel}>Due: <span style={s.dateValue}>{fmtDate(invoice.dueDate)}</span></span>
          </div>

          {/* Job line item — single price, no breakdown */}
          <div style={s.lineItem}>
            <div style={s.lineDesc}>
              <div style={s.lineTitle}>{invoice.jobTypeName}</div>
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
            <div style={s.totalRow}><span>Subtotal</span><span style={{ color: white }}>{fmtCurrency(invoice.netTotal)}</span></div>
            <div style={s.totalRow}><span>VAT (20%)</span><span style={{ color: white }}>{fmtCurrency(invoice.vat)}</span></div>
            <div style={s.grandRow}><span>Total</span><span>{fmtCurrency(invoice.grandTotal)}</span></div>
          </div>

          {/* Pay Now button for unpaid invoices */}
          {!isPaid && (
            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                onClick={async () => {
                  setPayLoading(true)
                  setPayError('')
                  try {
                    const { data, error } = await supabase.functions.invoke('create-checkout', {
                      body: {
                        invoiceId: invoice.id,
                        invoiceRef: invoice.ref,
                        amount: Math.round(invoice.grandTotal * 100),
                        customerName: invoice.customerName,
                        description: invoice.jobTypeName,
                      },
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
                {payLoading ? 'Processing...' : `Pay Now — £${invoice.grandTotal.toFixed(2)}`}
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

          {/* Bank transfer details — always show for unpaid, or show as fallback */}
          {!isPaid && (showBankFallback || settings.quoteConfig.bankName || settings.quoteConfig.sortCode || settings.quoteConfig.accountNumber) && (
            <div style={{ ...s.paymentBox, marginTop: payError ? 12 : 24 }}>
              <div style={s.paymentLabel}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Banknote size={14} /> Bank Transfer Details
                </span>
              </div>
              <div style={s.paymentGrid}>
                {settings.quoteConfig.bankName && (
                  <>
                    <div style={s.paymentFieldLabel}>Bank</div>
                    <div style={s.paymentFieldValue}>{settings.quoteConfig.bankName}</div>
                  </>
                )}
                {settings.quoteConfig.sortCode && (
                  <>
                    <div style={s.paymentFieldLabel}>Sort Code</div>
                    <div style={s.paymentFieldValue}>{settings.quoteConfig.sortCode}</div>
                  </>
                )}
                {settings.quoteConfig.accountNumber && (
                  <>
                    <div style={s.paymentFieldLabel}>Account Number</div>
                    <div style={s.paymentFieldValue}>{settings.quoteConfig.accountNumber}</div>
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
              Payment is due within {settings.quoteConfig.paymentTerms || 14} days of the invoice date. All electrical work has been carried out in accordance with BS 7671 (18th Edition) and relevant Part P Building Regulations. Work is guaranteed for 12 months from completion. Late payments may incur additional charges.
            </div>
          </div>

          {/* Footer text */}
          {settings.quoteConfig.footer && (
            <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: steel, fontStyle: 'italic' } as CSSProperties}>
              {settings.quoteConfig.footer}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={s.footer as CSSProperties}>
          <span style={s.footerItem}><Phone size={12} /> {settings.business.phone}</span>
          <span style={s.footerItem}><Mail size={12} /> {settings.business.email}</span>
          <span style={s.footerItem}><Globe size={12} /> {settings.business.website.replace('https://', '')}</span>
        </div>
      </div>
    </div>
  )
}
