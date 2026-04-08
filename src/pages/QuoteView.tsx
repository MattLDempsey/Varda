import { useParams } from 'react-router-dom'
import { useData } from '../data/DataContext'
// Theme not used — public page uses hardcoded colors for consistency
import { CheckCircle, Clock, FileText, Phone, Mail, Globe } from 'lucide-react'
import { useState } from 'react'
import type { CSSProperties } from 'react'

function fmtCurrency(n: number): string {
  return '£' + n.toFixed(2)
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function QuoteView() {
  const { quoteId } = useParams<{ quoteId: string }>()
  const { quotes, customers, jobs, settings, updateQuote, moveJob } = useData()
  const [accepted, setAccepted] = useState(false)

  const quote = quotes.find(q => q.id === quoteId)

  if (!quote) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#1A1C20', color: '#C9CDD2', gap: 12 }}>
        <FileText size={48} color="#4B5057" />
        <div style={{ fontSize: 20, fontWeight: 600 }}>Quote not found</div>
        <div style={{ fontSize: 14, color: '#4B5057' }}>This quote may have been removed or the link is incorrect.</div>
      </div>
    )
  }

  const customer = quote.customerId ? customers.find(c => c.id === quote.customerId) : undefined

  // Mark as viewed on first load
  if (quote.status === 'Sent' && !quote.viewedAt) {
    updateQuote(quote.id, { status: 'Viewed', viewedAt: new Date().toISOString().split('T')[0] })
  }

  const handleAccept = () => {
    const today = new Date().toISOString().split('T')[0]
    updateQuote(quote.id, { status: 'Accepted', acceptedAt: today })
    // Move linked job to Accepted
    const linkedJob = jobs.find(j => j.quoteId === quote.id)
      || jobs.find(j => j.customerId === quote.customerId && j.status === 'Quoted')
    if (linkedJob) {
      moveJob(linkedJob.id, 'Accepted')
    }
    setAccepted(true)
  }

  const isAccepted = quote.status === 'Accepted' || accepted
  const isExpired = quote.status === 'Expired' || quote.status === 'Declined'

  const gold = '#C6A86A'
  const bg = '#1A1C20'
  const card = '#24272D'
  const cardLight = '#2E3138'
  const steel = '#4B5057'
  const silver = '#C9CDD2'
  const white = '#F5F5F3'
  const green = '#6ABF8A'

  const s: Record<string, CSSProperties> = {
    page: { minHeight: '100vh', background: bg, padding: '40px 20px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' },
    card: { width: '100%', maxWidth: 680, background: card, borderRadius: 24, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.5)' },
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
    // validity
    validity: {
      background: cardLight, borderRadius: 12, padding: '14px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 28, border: `1px solid ${steel}33`,
    },
    validityLabel: { fontSize: 12, color: steel, fontWeight: 500 },
    validityValue: { fontSize: 13, color: gold, fontWeight: 600 },
    // line items
    lineHeader: { display: 'flex', justifyContent: 'space-between', padding: '0 0 10px', borderBottom: `1px solid ${steel}33`, marginBottom: 4 },
    lineHeaderLabel: { fontSize: 10, fontWeight: 700, color: steel, textTransform: 'uppercase', letterSpacing: 1 },
    lineItem: { display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${steel}1A`, alignItems: 'flex-start' },
    lineDesc: { flex: 1 },
    lineTitle: { fontSize: 15, fontWeight: 600, color: white },
    lineSub: { fontSize: 12, color: steel, marginTop: 2 },
    lineAmount: { fontSize: 15, fontWeight: 600, color: white, textAlign: 'right', minWidth: 90 },
    // breakdown rows
    breakdownRow: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: silver },
    // totals
    totalsWrap: { marginTop: 20, marginLeft: 'auto', maxWidth: 300 },
    totalRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14, color: silver },
    grandRow: {
      display: 'flex', justifyContent: 'space-between', padding: '14px 0 0',
      fontSize: 24, fontWeight: 700, color: gold, borderTop: `3px solid ${gold}`, marginTop: 8,
    },
    // notes
    notesBox: { background: cardLight, borderRadius: 12, padding: '16px 20px', marginTop: 24, border: `1px solid ${steel}22` },
    notesLabel: { fontSize: 10, fontWeight: 700, color: steel, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
    notesText: { fontSize: 13, color: silver, lineHeight: 1.7, whiteSpace: 'pre-wrap' },
    // accept
    acceptBtn: {
      width: '100%', padding: '18px', borderRadius: 14, border: 'none',
      background: gold, color: '#1A1C20', fontSize: 17, fontWeight: 700, cursor: 'pointer',
      minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      marginTop: 28, transition: 'transform .15s, box-shadow .15s',
      boxShadow: `0 4px 20px ${gold}33`,
    },
    acceptedBanner: {
      width: '100%', padding: '18px', borderRadius: 14, background: `${green}15`,
      border: `2px solid ${green}44`, fontSize: 17, fontWeight: 700, color: green,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 28,
    },
    expiredBanner: {
      width: '100%', padding: '18px', borderRadius: 14, background: '#D46A6A15',
      border: '2px solid #D46A6A44', fontSize: 17, fontWeight: 700, color: '#D46A6A',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 28,
    },
    // footer
    footer: {
      background: cardLight, padding: '20px 40px', display: 'flex', alignItems: 'center',
      justifyContent: 'center', gap: 24, flexWrap: 'wrap',
    },
    footerItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: steel },
  }

  // We don't show individual cost breakdown to customer — just the job total

  return (
    <div style={s.page}>
      <div style={s.card}>
        {/* ── Header Band ── */}
        <div style={s.headerBand}>
          <div style={s.headerRow}>
            <div>
              <div style={s.brand}>{settings.business.businessName.replace(' Electrical', '')}</div>
              <div style={s.brandSub}>Electrical Services</div>
            </div>
            <div style={s.docBadge as CSSProperties}>
              <div style={s.docTitle}>Quote</div>
              <div style={s.docRef}>{quote.ref}</div>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={s.body}>
          {/* Addresses */}
          <div style={s.addressRow}>
            <div style={s.addressBlock}>
              <div style={s.addressLabel}>Prepared For</div>
              <div style={s.addressName}>{quote.customerName}</div>
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
                {settings.business.city}{settings.business.county ? `, ${settings.business.county}` : ''}<br />
                {settings.business.email}<br />
                {settings.business.website.replace('https://', '')}
              </div>
            </div>
          </div>

          {/* Validity */}
          <div style={s.validity}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={14} color={steel} />
              <span style={s.validityLabel}>Issued {fmtDate(quote.createdAt)}</span>
            </div>
            <span style={s.validityValue}>
              Valid until {fmtDate(new Date(new Date(quote.createdAt).getTime() + 30 * 86400000).toISOString())}
            </span>
          </div>

          {/* Job line item — single price, no breakdown */}
          <div style={s.lineItem}>
            <div style={s.lineDesc}>
              <div style={s.lineTitle}>{quote.jobTypeName}</div>
              {quote.description && <div style={s.lineSub}>{quote.description}</div>}
            </div>
            <div style={s.lineAmount as CSSProperties}>{fmtCurrency(quote.netTotal - quote.certificates)}</div>
          </div>

          {/* Certification as separate line if applicable */}
          {quote.certificates > 0 && (
            <div style={s.lineItem}>
              <div style={s.lineDesc}>
                <div style={s.lineTitle}>Electrical certification & building control notification</div>
              </div>
              <div style={s.lineAmount as CSSProperties}>{fmtCurrency(quote.certificates)}</div>
            </div>
          )}

          {/* Totals */}
          <div style={s.totalsWrap}>
            <div style={s.totalRow}><span>Subtotal</span><span style={{ color: white }}>{fmtCurrency(quote.netTotal)}</span></div>
            <div style={s.totalRow}><span>VAT (20%)</span><span style={{ color: white }}>{fmtCurrency(quote.vat)}</span></div>
            <div style={s.grandRow}><span>Total</span><span>{fmtCurrency(quote.grandTotal)}</span></div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div style={s.notesBox}>
              <div style={s.notesLabel}>Notes</div>
              <div style={s.notesText}>{quote.notes}</div>
            </div>
          )}

          {/* Terms */}
          <div style={s.notesBox}>
            <div style={s.notesLabel}>Terms & Conditions</div>
            <div style={s.notesText}>
              This quote is valid for 30 days from the date of issue. All electrical work is carried out in accordance with BS 7671 (18th Edition) and relevant Part P Building Regulations. Work is guaranteed for 12 months from completion. Payment is due within 14 days of job completion.
            </div>
          </div>

          {/* Accept / Status */}
          {isAccepted ? (
            <div style={s.acceptedBanner}>
              <CheckCircle size={22} /> Quote Accepted — We'll be in touch to book you in
            </div>
          ) : isExpired ? (
            <div style={s.expiredBanner}>
              <FileText size={22} /> This quote has {quote.status === 'Expired' ? 'expired' : 'been declined'}
            </div>
          ) : (
            <button
              style={s.acceptBtn}
              onClick={handleAccept}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 30px ${gold}44` }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `0 4px 20px ${gold}33` }}
            >
              <CheckCircle size={22} /> Accept Quote
            </button>
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
