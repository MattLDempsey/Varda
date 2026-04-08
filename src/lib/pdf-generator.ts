import type { Quote, AppSettings } from '../data/DataContext'

/* ──────────────────────────────────────────────────────
   PDF Generator for Quotes & Invoices
   Uses a print-friendly HTML window — no external deps.
   ────────────────────────────────────────────────────── */

interface BusinessInfo {
  name: string
  owner: string
  phone: string
  email: string
  website: string
  address: string
}

const defaultBusiness: BusinessInfo = {
  name: 'Grey Havens Electrical',
  owner: 'Matt',
  phone: '07XXX XXX XXX',
  email: 'info@thegreyhavens.co.uk',
  website: 'thegreyhavens.co.uk',
  address: 'Colchester, Essex',
}

/** Convert AppSettings to BusinessInfo for PDF generation */
export function settingsToBusinessInfo(settings: AppSettings): BusinessInfo {
  const b = settings.business
  return {
    name: b.businessName,
    owner: b.ownerName,
    phone: b.phone,
    email: b.email,
    website: b.website.replace('https://', ''),
    address: [b.city, b.county].filter(Boolean).join(', '),
  }
}

function fmtCurrency(n: number): string {
  return '£' + n.toFixed(2)
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function validUntil(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return fmtDate(d.toISOString())
}

/* ── Quote PDF ── */

export function generateQuotePDF(quote: Quote, business: BusinessInfo = defaultBusiness) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Quote ${quote.ref}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1a1c20; padding: 40px; max-width: 800px; margin: 0 auto; font-size: 14px; line-height: 1.5; min-height: 100vh; display: flex; flex-direction: column; }
    .content { flex: 1; }
    .bottom { margin-top: auto; padding-top: 24px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 3px solid #C6A86A; }
    .brand { font-family: 'Georgia', serif; font-size: 28px; font-weight: 700; color: #2B2E34; }
    .brand-sub { font-size: 12px; color: #666; letter-spacing: 1px; text-transform: uppercase; margin-top: 4px; }
    .doc-type { text-align: right; }
    .doc-type h2 { font-size: 24px; color: #2B2E34; }
    .doc-type .ref { font-size: 14px; color: #666; margin-top: 4px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
    .meta-section h3 { font-size: 11px; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .meta-section p { font-size: 14px; color: #333; margin-bottom: 2px; }
    .meta-section .name { font-weight: 600; font-size: 16px; color: #1a1c20; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { text-align: left; padding: 12px 16px; font-size: 11px; font-weight: 600; color: #666; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #ddd; }
    td { padding: 12px 16px; border-bottom: 1px solid #eee; font-size: 14px; }
    .right { text-align: right; }
    .totals { margin-left: auto; width: 300px; }
    .totals tr td { padding: 8px 16px; }
    .totals .sep { border-top: 1px solid #ddd; }
    .totals .grand { font-size: 18px; font-weight: 700; color: #C6A86A; border-top: 2px solid #C6A86A; }
    .totals .label { color: #666; }
    .notes { background: #f8f8f6; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; font-size: 13px; color: #555; }
    .notes h4 { font-size: 12px; font-weight: 600; color: #333; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
    .footer { text-align: center; padding-top: 24px; border-top: 1px solid #eee; font-size: 12px; color: #999; }
    .footer a { color: #C6A86A; text-decoration: none; }
    .validity { background: #FFF8E7; border: 1px solid #C6A86A44; border-radius: 8px; padding: 12px 20px; margin-bottom: 24px; font-size: 13px; color: #8B7230; text-align: center; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="content">
    <div class="header">
      <div>
        <div class="brand">${business.name}</div>
        <div class="brand-sub">Electrical Services</div>
      </div>
      <div class="doc-type">
        <h2>Quote</h2>
        <div class="ref">${quote.ref}</div>
      </div>
    </div>

    <div class="meta">
      <div class="meta-section">
        <h3>Prepared For</h3>
        <p class="name">${quote.customerName}</p>
      </div>
      <div class="meta-section" style="text-align: right;">
        <h3>From</h3>
        <p class="name">${business.name}</p>
        <p>${business.phone}</p>
        <p>${business.email}</p>
        <p>${business.address}</p>
      </div>
    </div>

    <div class="validity">
      Issued: ${fmtDate(quote.createdAt)} · Valid until: ${validUntil(quote.createdAt, 30)}
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="right">Qty</th>
          <th class="right">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>${quote.jobTypeName}</strong></td>
          <td class="right">1</td>
          <td class="right">${fmtCurrency(quote.netTotal - quote.certificates)}</td>
        </tr>
        ${quote.certificates > 0 ? `<tr><td>Electrical certification & building control notification</td><td class="right">1</td><td class="right">${fmtCurrency(quote.certificates)}</td></tr>` : ''}
      </tbody>
    </table>

    <table class="totals">
      <tr><td class="label">Subtotal</td><td class="right">${fmtCurrency(quote.netTotal)}</td></tr>
      <tr><td class="label">VAT (20%)</td><td class="right">${fmtCurrency(quote.vat)}</td></tr>
      <tr class="grand"><td>Total</td><td class="right">${fmtCurrency(quote.grandTotal)}</td></tr>
    </table>

    ${quote.notes ? `<div class="notes"><h4>Notes</h4>${quote.notes}</div>` : ''}
  </div>

  <div class="bottom">
    <div class="notes">
      <h4>Terms</h4>
      This quote is valid for 30 days from the date of issue. All work guaranteed for 12 months.
      Payment due within 14 days of completion. Bank transfer details provided on invoice.
    </div>

    <div class="footer">
      <p>${business.name} · ${business.phone} · ${business.email}</p>
      <p><a href="https://${business.website}">${business.website}</a></p>
    </div>
  </div>
</body>
</html>`

  openPrintWindow(html, `Quote-${quote.ref}`)
}

/* ── Invoice PDF ── */

export function generateInvoicePDF(
  quote: Quote,
  invoiceRef: string,
  business: BusinessInfo = defaultBusiness,
) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoiceRef}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1a1c20; padding: 40px; max-width: 800px; margin: 0 auto; font-size: 14px; line-height: 1.5; min-height: 100vh; display: flex; flex-direction: column; }
    .content { flex: 1; }
    .bottom { margin-top: auto; padding-top: 24px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 3px solid #C6A86A; }
    .brand { font-family: 'Georgia', serif; font-size: 28px; font-weight: 700; color: #2B2E34; }
    .brand-sub { font-size: 12px; color: #666; letter-spacing: 1px; text-transform: uppercase; margin-top: 4px; }
    .doc-type { text-align: right; }
    .doc-type h2 { font-size: 24px; color: #2B2E34; }
    .doc-type .ref { font-size: 14px; color: #666; margin-top: 4px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
    .meta-section h3 { font-size: 11px; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .meta-section p { font-size: 14px; color: #333; margin-bottom: 2px; }
    .meta-section .name { font-weight: 600; font-size: 16px; color: #1a1c20; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { text-align: left; padding: 12px 16px; font-size: 11px; font-weight: 600; color: #666; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #ddd; }
    td { padding: 12px 16px; border-bottom: 1px solid #eee; font-size: 14px; }
    .right { text-align: right; }
    .totals { margin-left: auto; width: 300px; }
    .totals tr td { padding: 8px 16px; }
    .totals .grand { font-size: 18px; font-weight: 700; color: #C6A86A; border-top: 2px solid #C6A86A; }
    .totals .label { color: #666; }
    .payment { background: #f0f7f3; border: 1px solid #6ABF8A44; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; }
    .payment h4 { font-size: 12px; font-weight: 600; color: #333; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
    .payment p { font-size: 13px; color: #555; margin-bottom: 4px; }
    .due { background: #FFF8E7; border: 1px solid #C6A86A44; border-radius: 8px; padding: 12px 20px; margin-bottom: 24px; text-align: center; font-size: 14px; font-weight: 600; color: #8B7230; }
    .footer { text-align: center; padding-top: 24px; border-top: 1px solid #eee; font-size: 12px; color: #999; }
    .footer a { color: #C6A86A; text-decoration: none; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="content">
  <div class="header">
    <div>
      <div class="brand">${business.name}</div>
      <div class="brand-sub">Electrical Services</div>
    </div>
    <div class="doc-type">
      <h2>Invoice</h2>
      <div class="ref">${invoiceRef}</div>
    </div>
  </div>

  <div class="meta">
    <div class="meta-section">
      <h3>Bill To</h3>
      <p class="name">${quote.customerName}</p>
    </div>
    <div class="meta-section" style="text-align: right;">
      <h3>From</h3>
      <p class="name">${business.name}</p>
      <p>${business.phone}</p>
      <p>${business.email}</p>
    </div>
  </div>

  <div class="due">
    Invoice Date: ${fmtDate(new Date().toISOString())} · Payment Due: ${validUntil(new Date().toISOString(), 14)}
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="right">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>${quote.jobTypeName}</strong>${quote.description ? ' — ' + quote.description : ''}</td>
        <td class="right">${fmtCurrency(quote.netTotal)}</td>
      </tr>
    </tbody>
  </table>

  <table class="totals">
    <tr><td class="label">Subtotal</td><td class="right">${fmtCurrency(quote.netTotal)}</td></tr>
    <tr><td class="label">VAT (20%)</td><td class="right">${fmtCurrency(quote.vat)}</td></tr>
    <tr class="grand"><td>Total Due</td><td class="right">${fmtCurrency(quote.grandTotal)}</td></tr>
  </table>

  </div>

  <div class="bottom">
    <div class="payment">
      <h4>Payment Details</h4>
      <p>Please make payment by bank transfer within 14 days:</p>
      <p><strong>Reference:</strong> ${invoiceRef}</p>
      <p><em>Sort code and account number provided separately.</em></p>
    </div>

    <div class="footer">
      <p>Thank you for choosing ${business.name}. All work guaranteed for 12 months.</p>
      <p>${business.phone} · ${business.email} · <a href="https://${business.website}">${business.website}</a></p>
    </div>
  </div>
</body>
</html>`

  openPrintWindow(html, `Invoice-${invoiceRef}`)
}

/* ── Helper: open a print-friendly window ── */

function openPrintWindow(html: string, title: string) {
  const win = window.open('', title, 'width=800,height=1000')
  if (!win) {
    alert('Please allow pop-ups to generate PDFs')
    return
  }
  win.document.write(html)
  win.document.close()
  // Auto-trigger print dialog after a brief render delay
  setTimeout(() => win.print(), 300)
}
