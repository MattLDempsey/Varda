import type { Invoice, Customer, Expense } from '../data/DataContext'

/* ──────────────────────────────────────────────────────
   Xero CSV Export
   Exports data in Xero-compatible CSV import format.
   ────────────────────────────────────────────────────── */

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function fmtDateXero(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/* ── Invoice Export ── */

export function exportInvoicesCSV(invoices: Invoice[]) {
  const header = 'ContactName,EmailAddress,InvoiceNumber,Reference,InvoiceDate,DueDate,Total,TaxTotal,Description,Quantity,UnitAmount,AccountCode,TaxType'

  const rows = invoices.map(inv => {
    return [
      escapeCSV(inv.customerName),
      '', // EmailAddress — not stored on invoice
      escapeCSV(inv.ref),
      escapeCSV(inv.jobId || ''),
      fmtDateXero(inv.createdAt),
      fmtDateXero(inv.dueDate),
      inv.grandTotal.toFixed(2),
      inv.vat.toFixed(2),
      escapeCSV(inv.description || inv.jobTypeName),
      '1',
      inv.netTotal.toFixed(2),
      '200', // Default Xero sales account code
      'OUTPUT2', // 20% VAT on income
    ].join(',')
  })

  const csv = [header, ...rows].join('\n')
  const dateStr = new Date().toISOString().split('T')[0]
  downloadCSV(`xero-invoices-${dateStr}.csv`, csv)
}

/* ── Expense Export ── */

export function exportExpensesCSV(expenses: Expense[]) {
  const header = 'ContactName,EmailAddress,InvoiceNumber,Reference,InvoiceDate,DueDate,Total,TaxTotal,Description,Quantity,UnitAmount,AccountCode,TaxType'

  // Map expense categories to Xero account codes
  const categoryAccountCode: Record<string, string> = {
    Materials: '300',
    'Tools & Equipment': '460',
    Vehicle: '449',
    Insurance: '461',
    Subscriptions: '463',
    Training: '464',
    Other: '429',
  }

  const rows = expenses.map((exp, i) => {
    const ref = `EXP-${String(i + 1).padStart(4, '0')}`
    return [
      escapeCSV(exp.supplier),
      '',
      ref,
      escapeCSV(exp.jobId || ''),
      fmtDateXero(exp.date),
      fmtDateXero(exp.date),
      exp.total.toFixed(2),
      exp.vat.toFixed(2),
      escapeCSV(exp.description),
      '1',
      exp.amount.toFixed(2),
      categoryAccountCode[exp.category] || '429',
      'INPUT2', // 20% VAT on expenses
    ].join(',')
  })

  const csv = [header, ...rows].join('\n')
  const dateStr = new Date().toISOString().split('T')[0]
  downloadCSV(`xero-expenses-${dateStr}.csv`, csv)
}

/* ── Contact Export ── */

export function exportContactsCSV(customers: Customer[]) {
  const header = 'ContactName,EmailAddress,FirstName,LastName,PhoneNumber,AddressLine1,City,PostalCode'

  const rows = customers.map(c => {
    const nameParts = c.name.trim().split(/\s+/)
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''

    return [
      escapeCSV(c.name),
      escapeCSV(c.email || ''),
      escapeCSV(firstName),
      escapeCSV(lastName),
      escapeCSV(c.phone || ''),
      escapeCSV([c.address1, c.address2].filter(Boolean).join(', ')),
      escapeCSV(c.city || ''),
      escapeCSV(c.postcode || ''),
    ].join(',')
  })

  const csv = [header, ...rows].join('\n')
  const dateStr = new Date().toISOString().split('T')[0]
  downloadCSV(`xero-contacts-${dateStr}.csv`, csv)
}
