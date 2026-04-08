import type { AppSettings } from '../data/DataContext'

/* ──────────────────────────────────────────────────────
   Certificate Generator for Electrical Certificates
   Uses a print-friendly HTML window — no external deps.
   ────────────────────────────────────────────────────── */

interface BusinessInfo {
  name: string
  owner: string
  phone: string
  email: string
  website: string
  address: string
  vatNumber?: string
  companyNumber?: string
}

/** Convert AppSettings to BusinessInfo for certificate generation */
export function settingsToCertBusinessInfo(settings: AppSettings): BusinessInfo {
  const b = settings.business
  return {
    name: b.businessName,
    owner: b.ownerName,
    phone: b.phone,
    email: b.email,
    website: b.website.replace('https://', ''),
    address: [b.address1, b.address2, b.city, b.county, b.postcode].filter(Boolean).join(', '),
    vatNumber: b.vatNumber,
    companyNumber: b.companyNumber,
  }
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Generate a certificate number from a prefix and timestamp */
export function generateCertNumber(prefix: string): string {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const seq = String(Math.floor(Math.random() * 9000) + 1000)
  return `${prefix}-${yy}${mm}-${seq}`
}

/* ── Shared styles ── */

const certStyles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1a1c20; padding: 32px 40px; max-width: 800px; margin: 0 auto; font-size: 13px; line-height: 1.5; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 3px solid #2B2E34; }
  .brand { font-family: 'Georgia', serif; font-size: 22px; font-weight: 700; color: #2B2E34; }
  .brand-sub { font-size: 11px; color: #666; letter-spacing: 1px; text-transform: uppercase; margin-top: 2px; }
  .brand-reg { font-size: 11px; color: #888; margin-top: 4px; }
  .cert-type { text-align: right; }
  .cert-type h2 { font-size: 16px; color: #2B2E34; text-transform: uppercase; letter-spacing: 1px; }
  .cert-type .cert-num { font-size: 13px; color: #666; margin-top: 4px; font-weight: 600; }
  .section { margin-bottom: 18px; }
  .section-title { font-size: 11px; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 1px; background: #2B2E34; padding: 6px 12px; margin-bottom: 10px; }
  .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; padding: 0 12px; }
  .field-grid.full { grid-template-columns: 1fr; }
  .field { margin-bottom: 6px; }
  .field-label { font-size: 10px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
  .field-value { font-size: 13px; color: #1a1c20; font-weight: 500; min-height: 18px; border-bottom: 1px dotted #ccc; padding-bottom: 2px; }
  .declaration { background: #f8f8f6; border: 1px solid #ddd; border-radius: 4px; padding: 14px 16px; margin: 18px 0; font-size: 12px; line-height: 1.6; color: #333; }
  .declaration strong { display: block; margin-bottom: 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #1a1c20; }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; margin-top: 20px; padding: 0 12px; }
  .sig-box { }
  .sig-label { font-size: 10px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .sig-line { border-bottom: 1px solid #333; min-height: 32px; margin-bottom: 4px; font-size: 13px; color: #1a1c20; font-weight: 500; padding-top: 14px; }
  .sig-date { font-size: 11px; color: #666; margin-top: 4px; }
  .footer { text-align: center; margin-top: 24px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 11px; color: #999; }
  .footer a { color: #2B2E34; text-decoration: none; }
  .bs-ref { font-size: 11px; color: #666; text-align: center; margin-top: 8px; font-style: italic; }
  table.circuit-table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 11px; }
  table.circuit-table th { text-align: left; padding: 6px 8px; font-size: 10px; font-weight: 600; color: #666; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #ddd; background: #f5f5f5; }
  table.circuit-table td { padding: 5px 8px; border-bottom: 1px solid #eee; }
  @media print { body { padding: 16px; } }
`

/* ── Electrical Installation Certificate (EIC) ── */

export function generateEIC(params: {
  business: BusinessInfo
  customer: { name: string; address: string }
  job: { description: string; date: string }
  certNumber: string
  circuitDetails?: string
  designedBy?: string
  installedBy?: string
  inspectedBy?: string
}) {
  const { business, customer, job, certNumber } = params

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>EIC ${certNumber}</title>
  <style>${certStyles}</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">${business.name}</div>
      <div class="brand-sub">Electrical Services</div>
      ${business.companyNumber ? `<div class="brand-reg">Reg: ${business.companyNumber}</div>` : ''}
      ${business.vatNumber ? `<div class="brand-reg">VAT: ${business.vatNumber}</div>` : ''}
    </div>
    <div class="cert-type">
      <h2>Electrical Installation<br/>Certificate</h2>
      <div class="cert-num">${certNumber}</div>
    </div>
  </div>

  <div class="bs-ref">In accordance with BS 7671 (IET Wiring Regulations)</div>

  <div class="section">
    <div class="section-title">Details of the Client</div>
    <div class="field-grid">
      <div class="field">
        <div class="field-label">Client Name</div>
        <div class="field-value">${customer.name}</div>
      </div>
      <div class="field">
        <div class="field-label">Installation Address</div>
        <div class="field-value">${customer.address}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Details of the Installation</div>
    <div class="field-grid">
      <div class="field">
        <div class="field-label">Description of Work</div>
        <div class="field-value">${job.description}</div>
      </div>
      <div class="field">
        <div class="field-label">Date of Completion</div>
        <div class="field-value">${fmtDate(job.date)}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Details of the Contractor</div>
    <div class="field-grid">
      <div class="field">
        <div class="field-label">Contractor</div>
        <div class="field-value">${business.name}</div>
      </div>
      <div class="field">
        <div class="field-label">Address</div>
        <div class="field-value">${business.address}</div>
      </div>
      <div class="field">
        <div class="field-label">Phone</div>
        <div class="field-value">${business.phone}</div>
      </div>
      <div class="field">
        <div class="field-label">Email</div>
        <div class="field-value">${business.email}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Particulars of the Installation</div>
    <div class="field-grid">
      <div class="field">
        <div class="field-label">Designed By</div>
        <div class="field-value">${params.designedBy || business.owner}</div>
      </div>
      <div class="field">
        <div class="field-label">Installed By</div>
        <div class="field-value">${params.installedBy || business.owner}</div>
      </div>
      <div class="field">
        <div class="field-label">Inspected &amp; Tested By</div>
        <div class="field-value">${params.inspectedBy || business.owner}</div>
      </div>
    </div>
    ${params.circuitDetails ? `
    <div class="field-grid full" style="margin-top: 10px;">
      <div class="field">
        <div class="field-label">Circuit Details / Schedule</div>
        <div class="field-value" style="white-space: pre-wrap;">${params.circuitDetails}</div>
      </div>
    </div>` : ''}
  </div>

  <div class="declaration">
    <strong>Declaration</strong>
    I/We, being the person(s) responsible for the design, construction, inspection and testing of the
    electrical installation (as indicated by my/our signatures below), particulars of which are described
    above, having exercised reasonable skill and care when carrying out the design, construction,
    inspection and testing, hereby declare that the said work for which I/we have been responsible is
    to the best of my/our knowledge and belief in accordance with BS 7671: 2018 + A2:2022
    (Requirements for Electrical Installations, IET Wiring Regulations), except for the departures,
    if any, detailed in this certificate.
  </div>

  <div class="sig-grid">
    <div class="sig-box">
      <div class="sig-label">Designed By</div>
      <div class="sig-line">${params.designedBy || business.owner}</div>
      <div class="sig-date">Date: ${fmtDate(job.date)}</div>
    </div>
    <div class="sig-box">
      <div class="sig-label">Installed By</div>
      <div class="sig-line">${params.installedBy || business.owner}</div>
      <div class="sig-date">Date: ${fmtDate(job.date)}</div>
    </div>
    <div class="sig-box">
      <div class="sig-label">Inspected &amp; Tested By</div>
      <div class="sig-line">${params.inspectedBy || business.owner}</div>
      <div class="sig-date">Date: ${fmtDate(job.date)}</div>
    </div>
  </div>

  <div class="footer">
    <p>${business.name} &middot; ${business.phone} &middot; ${business.email}</p>
    ${business.website ? `<p><a href="https://${business.website}">${business.website}</a></p>` : ''}
  </div>
</body>
</html>`

  openPrintWindow(html, `EIC-${certNumber}`)
}

/* ── Minor Electrical Installation Works Certificate (MEIWC) ── */

export function generateMEIWC(params: {
  business: BusinessInfo
  customer: { name: string; address: string }
  job: { description: string; date: string }
  certNumber: string
  circuitDetails?: string
  installedBy?: string
  inspectedBy?: string
}) {
  const { business, customer, job, certNumber } = params

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>MEIWC ${certNumber}</title>
  <style>${certStyles}</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">${business.name}</div>
      <div class="brand-sub">Electrical Services</div>
      ${business.companyNumber ? `<div class="brand-reg">Reg: ${business.companyNumber}</div>` : ''}
      ${business.vatNumber ? `<div class="brand-reg">VAT: ${business.vatNumber}</div>` : ''}
    </div>
    <div class="cert-type">
      <h2>Minor Electrical<br/>Installation Works<br/>Certificate</h2>
      <div class="cert-num">${certNumber}</div>
    </div>
  </div>

  <div class="bs-ref">In accordance with BS 7671 (IET Wiring Regulations)</div>

  <div class="section">
    <div class="section-title">Details of the Client</div>
    <div class="field-grid">
      <div class="field">
        <div class="field-label">Client Name</div>
        <div class="field-value">${customer.name}</div>
      </div>
      <div class="field">
        <div class="field-label">Installation Address</div>
        <div class="field-value">${customer.address}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Description of Minor Works</div>
    <div class="field-grid full">
      <div class="field">
        <div class="field-label">Description of Work</div>
        <div class="field-value">${job.description}</div>
      </div>
    </div>
    <div class="field-grid">
      <div class="field">
        <div class="field-label">Date of Completion</div>
        <div class="field-value">${fmtDate(job.date)}</div>
      </div>
    </div>
    ${params.circuitDetails ? `
    <div class="field-grid full" style="margin-top: 6px;">
      <div class="field">
        <div class="field-label">Circuit Details</div>
        <div class="field-value" style="white-space: pre-wrap;">${params.circuitDetails}</div>
      </div>
    </div>` : ''}
  </div>

  <div class="section">
    <div class="section-title">Details of the Contractor</div>
    <div class="field-grid">
      <div class="field">
        <div class="field-label">Contractor</div>
        <div class="field-value">${business.name}</div>
      </div>
      <div class="field">
        <div class="field-label">Address</div>
        <div class="field-value">${business.address}</div>
      </div>
      <div class="field">
        <div class="field-label">Phone</div>
        <div class="field-value">${business.phone}</div>
      </div>
      <div class="field">
        <div class="field-label">Email</div>
        <div class="field-value">${business.email}</div>
      </div>
    </div>
  </div>

  <div class="declaration">
    <strong>Declaration</strong>
    I/We, being the person(s) responsible for the electrical installation work described above,
    having exercised reasonable skill and care when carrying out the work, hereby declare that
    the work for which I/we have been responsible is to the best of my/our knowledge and belief
    in accordance with BS 7671: 2018 + A2:2022, except for the departures, if any, detailed below.
    The minor works described above do not include the provision of a new circuit.
  </div>

  <div class="sig-grid">
    <div class="sig-box">
      <div class="sig-label">Installed By</div>
      <div class="sig-line">${params.installedBy || business.owner}</div>
      <div class="sig-date">Date: ${fmtDate(job.date)}</div>
    </div>
    <div class="sig-box">
      <div class="sig-label">Inspected &amp; Tested By</div>
      <div class="sig-line">${params.inspectedBy || business.owner}</div>
      <div class="sig-date">Date: ${fmtDate(job.date)}</div>
    </div>
    <div class="sig-box">
      <div class="sig-label">Client Signature</div>
      <div class="sig-line"></div>
      <div class="sig-date">Date:</div>
    </div>
  </div>

  <div class="footer">
    <p>${business.name} &middot; ${business.phone} &middot; ${business.email}</p>
    ${business.website ? `<p><a href="https://${business.website}">${business.website}</a></p>` : ''}
  </div>
</body>
</html>`

  openPrintWindow(html, `MEIWC-${certNumber}`)
}

/* ── Electrical Installation Condition Report (EICR) ── */

export function generateEICR(params: {
  business: BusinessInfo
  customer: { name: string; address: string }
  job: { description: string; date: string }
  certNumber: string
  circuitDetails?: string
  inspectedBy?: string
  observations?: string
  overallCondition?: 'Satisfactory' | 'Unsatisfactory'
  nextInspectionDate?: string
}) {
  const { business, customer, job, certNumber } = params
  const condition = params.overallCondition || 'Satisfactory'
  const conditionColor = condition === 'Satisfactory' ? '#2e7d32' : '#c62828'

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>EICR ${certNumber}</title>
  <style>${certStyles}
    .condition-badge { display: inline-block; padding: 4px 16px; border-radius: 4px; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">${business.name}</div>
      <div class="brand-sub">Electrical Services</div>
      ${business.companyNumber ? `<div class="brand-reg">Reg: ${business.companyNumber}</div>` : ''}
      ${business.vatNumber ? `<div class="brand-reg">VAT: ${business.vatNumber}</div>` : ''}
    </div>
    <div class="cert-type">
      <h2>Electrical Installation<br/>Condition Report</h2>
      <div class="cert-num">${certNumber}</div>
    </div>
  </div>

  <div class="bs-ref">In accordance with BS 7671 (IET Wiring Regulations)</div>

  <div class="section">
    <div class="section-title">Details of the Client</div>
    <div class="field-grid">
      <div class="field">
        <div class="field-label">Client Name</div>
        <div class="field-value">${customer.name}</div>
      </div>
      <div class="field">
        <div class="field-label">Installation Address</div>
        <div class="field-value">${customer.address}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Purpose of the Report</div>
    <div class="field-grid full">
      <div class="field">
        <div class="field-label">Description / Extent of Installation Covered</div>
        <div class="field-value">${job.description}</div>
      </div>
    </div>
    <div class="field-grid">
      <div class="field">
        <div class="field-label">Date of Inspection</div>
        <div class="field-value">${fmtDate(job.date)}</div>
      </div>
      <div class="field">
        <div class="field-label">Recommended Next Inspection</div>
        <div class="field-value">${params.nextInspectionDate ? fmtDate(params.nextInspectionDate) : 'Within 5 years'}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Details of the Contractor</div>
    <div class="field-grid">
      <div class="field">
        <div class="field-label">Inspector</div>
        <div class="field-value">${params.inspectedBy || business.owner}</div>
      </div>
      <div class="field">
        <div class="field-label">Contractor</div>
        <div class="field-value">${business.name}</div>
      </div>
      <div class="field">
        <div class="field-label">Address</div>
        <div class="field-value">${business.address}</div>
      </div>
      <div class="field">
        <div class="field-label">Phone</div>
        <div class="field-value">${business.phone}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Overall Assessment of the Installation</div>
    <div style="text-align: center; padding: 16px 0;">
      <span class="condition-badge" style="color: ${conditionColor}; border: 2px solid ${conditionColor}; background: ${conditionColor}11;">
        ${condition}
      </span>
    </div>
  </div>

  ${params.circuitDetails ? `
  <div class="section">
    <div class="section-title">Circuit Details</div>
    <div class="field-grid full">
      <div class="field">
        <div class="field-value" style="white-space: pre-wrap;">${params.circuitDetails}</div>
      </div>
    </div>
  </div>` : ''}

  ${params.observations ? `
  <div class="section">
    <div class="section-title">Observations &amp; Recommendations</div>
    <div class="field-grid full">
      <div class="field">
        <div class="field-value" style="white-space: pre-wrap;">${params.observations}</div>
      </div>
    </div>
  </div>` : ''}

  <div class="declaration">
    <strong>Declaration</strong>
    I/We, being the person(s) responsible for the inspection and testing of the electrical installation
    (as indicated by my/our signatures below), particulars of which are described above, having
    exercised reasonable skill and care when carrying out the inspection and testing, hereby declare
    that the information in this report, including the observations and the attached schedules,
    provides an accurate assessment of the condition of the electrical installation taking into
    account the stated extent and limitations, in accordance with BS 7671: 2018 + A2:2022.
  </div>

  <div class="sig-grid">
    <div class="sig-box">
      <div class="sig-label">Inspected &amp; Tested By</div>
      <div class="sig-line">${params.inspectedBy || business.owner}</div>
      <div class="sig-date">Date: ${fmtDate(job.date)}</div>
    </div>
    <div class="sig-box">
      <div class="sig-label">Reviewed By</div>
      <div class="sig-line"></div>
      <div class="sig-date">Date:</div>
    </div>
    <div class="sig-box">
      <div class="sig-label">Client Signature</div>
      <div class="sig-line"></div>
      <div class="sig-date">Date:</div>
    </div>
  </div>

  <div class="footer">
    <p>${business.name} &middot; ${business.phone} &middot; ${business.email}</p>
    ${business.website ? `<p><a href="https://${business.website}">${business.website}</a></p>` : ''}
  </div>
</body>
</html>`

  openPrintWindow(html, `EICR-${certNumber}`)
}

/* ── Helper: open a print-friendly window ── */

function openPrintWindow(html: string, title: string) {
  const win = window.open('', title, 'width=800,height=1000')
  if (!win) {
    alert('Please allow pop-ups to generate certificates')
    return
  }
  win.document.write(html)
  win.document.close()
  setTimeout(() => win.print(), 300)
}
