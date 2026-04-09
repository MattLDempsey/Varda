import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle, Clock, FileText, Phone, Mail, Globe } from 'lucide-react'
import type { CSSProperties } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Public quote view — rendered for `/q/:quoteId`. Lives outside the
 * authenticated DataProvider tree so it must fetch its own data via the
 * `get_public_quote` SECURITY DEFINER RPC.
 */

interface PublicQuote {
  id: string
  ref: string
  customer_name: string
  job_type_name: string
  description: string
  net_total: number
  certificates: number
  vat: number
  grand_total: number
  status: 'Draft' | 'Sent' | 'Viewed' | 'Accepted' | 'Expired' | 'Declined'
  notes: string
  created_at: string
  sent_at: string | null
  viewed_at: string | null
  accepted_at: string | null
}

interface PublicCustomer {
  name: string
  address1: string | null
  address2: string | null
  city: string | null
  postcode: string | null
}

interface PublicBusiness {
  businessName?: string
  ownerName?: string
  phone?: string
  email?: string
  website?: string
  city?: string
  county?: string
}

interface PublicQuotePayload {
  quote: PublicQuote
  customer: PublicCustomer | null
  business: PublicBusiness
}

function fmtCurrency(n: number): string {
  return '£' + Number(n).toFixed(2)
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function QuoteView() {
  const { quoteId } = useParams<{ quoteId: string }>()
  const [payload, setPayload] = useState<PublicQuotePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [accepting, setAccepting] = useState(false)

  // Fetch the quote on mount
  useEffect(() => {
    if (!quoteId) {
      setNotFound(true)
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.rpc('get_public_quote', { p_quote_id: quoteId })
      if (cancelled) return
      if (error || !data) {
        console.error('[QuoteView] failed to load quote', error)
        setNotFound(true)
        setLoading(false)
        return
      }
      setPayload(data as PublicQuotePayload)
      setLoading(false)
      // Mark as viewed (best-effort, no UI feedback)
      if ((data as PublicQuotePayload).quote.status === 'Sent') {
        void supabase.rpc('mark_quote_viewed', { p_quote_id: quoteId }).then(() => {}, () => {})
      }
    })()
    return () => { cancelled = true }
  }, [quoteId])

  const handleAccept = async () => {
    if (!quoteId || accepting) return
    setAccepting(true)
    const { error } = await supabase.rpc('accept_public_quote', { p_quote_id: quoteId })
    setAccepting(false)
    if (error) {
      console.error('[QuoteView] accept failed', error)
      return
    }
    setAccepted(true)
  }

  // ── Loading / not-found states ──
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#1A1C20', color: '#C9CDD2', gap: 12 }}>
        <FileText size={48} color="#4B5057" />
        <div style={{ fontSize: 16, color: '#4B5057' }}>Loading quote…</div>
      </div>
    )
  }

  if (notFound || !payload) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#1A1C20', color: '#C9CDD2', gap: 12 }}>
        <FileText size={48} color="#4B5057" />
        <div style={{ fontSize: 20, fontWeight: 600 }}>Quote not found</div>
        <div style={{ fontSize: 14, color: '#4B5057' }}>This quote may have been removed or the link is incorrect.</div>
      </div>
    )
  }

  const { quote, customer, business } = payload
  const businessName = business.businessName || 'Business'
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
    addressRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 32, marginBottom: 28 },
    addressBlock: {},
    addressLabel: { fontSize: 10, fontWeight: 700, color: gold, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
    addressName: { fontSize: 16, fontWeight: 600, color: white, marginBottom: 4 },
    addressLine: { fontSize: 13, color: silver, lineHeight: 1.6 },
    // validity
    validity: {
      background: cardLight, borderRadius: 12, padding: '14px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 28, border: `1px solid ${steel}33`, gap: 12, flexWrap: 'wrap' as const,
    },
    validityLabel: { fontSize: 12, color: steel, fontWeight: 500 },
    validityValue: { fontSize: 13, color: gold, fontWeight: 600 },
    // line items
    lineItem: { display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${steel}1A`, alignItems: 'flex-start', gap: 12 },
    lineDesc: { flex: 1, minWidth: 0 },
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
    // notes
    notesBox: { background: cardLight, borderRadius: 12, padding: '16px 20px', marginTop: 24, border: `1px solid ${steel}22` },
    notesLabel: { fontSize: 10, fontWeight: 700, color: steel, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
    notesText: { fontSize: 13, color: silver, lineHeight: 1.7, whiteSpace: 'pre-wrap' },
    // accept
    acceptBtn: {
      width: '100%', padding: '18px', borderRadius: 14, border: 'none',
      background: gold, color: '#1A1C20', fontSize: 17, fontWeight: 700, cursor: accepting ? 'not-allowed' : 'pointer',
      minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      marginTop: 28, transition: 'transform .15s, box-shadow .15s', opacity: accepting ? 0.7 : 1,
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

  const websiteDisplay = (business.website || '').replace('https://', '').replace('http://', '')

  return (
    <div style={s.page}>
      <div style={s.card}>
        {/* ── Header Band ── */}
        <div style={s.headerBand}>
          <div style={s.headerRow}>
            <div>
              <div style={s.brand}>{businessName.replace(' Electrical', '')}</div>
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
              <div style={s.addressName}>{quote.customer_name}</div>
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
                {business.city}{business.county ? `, ${business.county}` : ''}<br />
                {business.email}<br />
                {websiteDisplay}
              </div>
            </div>
          </div>

          {/* Validity */}
          <div style={s.validity}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={14} color={steel} />
              <span style={s.validityLabel}>Issued {fmtDate(quote.created_at)}</span>
            </div>
            <span style={s.validityValue}>
              Valid until {fmtDate(new Date(new Date(quote.created_at).getTime() + 30 * 86400000).toISOString())}
            </span>
          </div>

          {/* Job line item — single price, no breakdown */}
          <div style={s.lineItem}>
            <div style={s.lineDesc}>
              <div style={s.lineTitle}>{quote.job_type_name}</div>
              {quote.description && <div style={s.lineSub}>{quote.description}</div>}
            </div>
            <div style={s.lineAmount as CSSProperties}>{fmtCurrency(quote.net_total - quote.certificates)}</div>
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
            <div style={s.totalRow}><span>Subtotal</span><span style={{ color: white }}>{fmtCurrency(quote.net_total)}</span></div>
            <div style={s.totalRow}><span>VAT (20%)</span><span style={{ color: white }}>{fmtCurrency(quote.vat)}</span></div>
            <div style={s.grandRow}><span>Total</span><span>{fmtCurrency(quote.grand_total)}</span></div>
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
              disabled={accepting}
              onMouseEnter={e => { if (!accepting) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 30px ${gold}44` } }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `0 4px 20px ${gold}33` }}
            >
              <CheckCircle size={22} /> {accepting ? 'Accepting…' : 'Accept Quote'}
            </button>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={s.footer as CSSProperties}>
          {business.phone && <span style={s.footerItem}><Phone size={12} /> {business.phone}</span>}
          {business.email && <span style={s.footerItem}><Mail size={12} /> {business.email}</span>}
          {websiteDisplay && <span style={s.footerItem}><Globe size={12} /> {websiteDisplay}</span>}
        </div>
      </div>
    </div>
  )
}
