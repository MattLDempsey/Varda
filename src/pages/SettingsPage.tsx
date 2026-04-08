import React, { useState } from 'react'
import { Save, Building2, Clock, FileText, Bell } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useTheme } from '../theme/ThemeContext'
import { useData } from '../data/DataContext'
import type { AppSettings } from '../data/DataContext'

/* ── types ── */
type SettingsTab = 'business' | 'hours' | 'quotes' | 'notifications'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function SettingsPage() {
  const { C } = useTheme()
  const { settings, updateSettings } = useData()
  const [activeTab, setActiveTab] = useState<SettingsTab>('business')
  const [saved, setSaved] = useState(false)

  // Local draft state so edits don't persist until Save is clicked
  const [business, setBusiness] = useState<AppSettings['business']>({ ...settings.business })
  const [hours, setHours] = useState<AppSettings['workingHours']>(JSON.parse(JSON.stringify(settings.workingHours)))
  const [quoteSettings, setQuoteSettings] = useState<AppSettings['quoteConfig']>({ ...settings.quoteConfig })
  const [notifications, setNotifications] = useState<AppSettings['notifications']>({ ...settings.notifications })

  const handleSave = () => {
    updateSettings('business', business)
    updateSettings('workingHours', hours)
    updateSettings('quoteConfig', quoteSettings)
    updateSettings('notifications', notifications)
    setSaved(true)
  }

  const updateBusiness = (key: keyof AppSettings['business'], value: string) => {
    setBusiness(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const updateHours = (day: string, key: string, value: string | boolean) => {
    setHours(prev => ({ ...prev, [day]: { ...prev[day], [key]: value } }))
    setSaved(false)
  }

  const updateQuote = (key: keyof AppSettings['quoteConfig'], value: string | number) => {
    setQuoteSettings(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const toggleNotif = (key: keyof AppSettings['notifications']) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }))
    setSaved(false)
  }

  /* ── styles ── */
  const s: Record<string, CSSProperties> = {
    page: { padding: 32, maxWidth: 1200, margin: '0 auto' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 },
    heading: { fontSize: 28, fontWeight: 600, color: C.white },
    saveBtn: {
      display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px',
      borderRadius: 10, background: C.gold, color: C.black, border: 'none',
      cursor: 'pointer', fontSize: 13, fontWeight: 600, minHeight: 44,
    },
    layout: { display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20 },
    // tabs
    tabList: { display: 'flex', flexDirection: 'column', gap: 4 },
    tab: {
      display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
      borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13,
      fontWeight: 500, textAlign: 'left', transition: 'all .15s', minHeight: 44,
      width: '100%',
    },
    // form
    panel: { background: C.charcoalLight, borderRadius: 12, padding: '24px 28px' },
    panelTitle: { fontSize: 18, fontWeight: 600, color: C.white, marginBottom: 4 },
    panelSub: { fontSize: 13, color: C.silver, marginBottom: 24 },
    fieldRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 0 },
    field: { marginBottom: 16 },
    label: { fontSize: 12, fontWeight: 600, color: C.silver, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'block' },
    input: {
      width: '100%', background: C.black, border: `1px solid ${C.steel}44`,
      borderRadius: 8, padding: '10px 14px', color: C.white, fontSize: 14,
      outline: 'none', minHeight: 44, boxSizing: 'border-box',
    },
    textarea: {
      width: '100%', background: C.black, border: `1px solid ${C.steel}44`,
      borderRadius: 8, padding: '10px 14px', color: C.white, fontSize: 14,
      outline: 'none', minHeight: 80, resize: 'vertical', boxSizing: 'border-box',
    },
    // hours
    hoursRow: {
      display: 'grid', gridTemplateColumns: '120px 44px 1fr 30px 1fr', gap: 12,
      alignItems: 'center', padding: '10px 0',
      borderBottom: `1px solid ${C.steel}1A`,
    },
    dayLabel: { fontSize: 14, fontWeight: 500, color: C.white },
    toggle: {
      width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
      position: 'relative', transition: 'background .15s',
    },
    toggleDot: {
      width: 16, height: 16, borderRadius: '50%', background: C.white,
      position: 'absolute', top: 3, transition: 'left .15s',
    },
    timeInput: {
      background: C.black, border: `1px solid ${C.steel}44`, borderRadius: 8,
      padding: '8px 12px', color: C.white, fontSize: 13, outline: 'none',
      minHeight: 36, boxSizing: 'border-box',
    },
    dash: { textAlign: 'center', color: C.steel, fontSize: 16 },
    saved: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: C.green },
    // notifications
    notifRow: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 0', borderBottom: `1px solid ${C.steel}1A`,
    },
    notifLabel: { fontSize: 14, color: C.white },
    notifDesc: { fontSize: 12, color: C.silver, marginTop: 2 },
  }

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'business', label: 'Business Info', icon: <Building2 size={18} /> },
    { id: 'hours', label: 'Working Hours', icon: <Clock size={18} /> },
    { id: 'quotes', label: 'Quotes & Invoices', icon: <FileText size={18} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={18} /> },
  ]

  return (
    <div style={s.page}>
      {/* header */}
      <div style={s.header}>
        <h1 style={s.heading}>Settings</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {saved && <div style={s.saved}><Save size={14} /> Saved</div>}
          <button style={s.saveBtn} onClick={handleSave}>
            <Save size={16} /> Save Changes
          </button>
        </div>
      </div>

      <div style={s.layout}>
        {/* sidebar tabs */}
        <div style={s.tabList}>
          {tabs.map(t => (
            <button
              key={t.id}
              style={{
                ...s.tab,
                background: activeTab === t.id ? `${C.gold}15` : 'transparent',
                color: activeTab === t.id ? C.gold : C.silver,
              }}
              onClick={() => setActiveTab(t.id)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* content */}
        <div style={s.panel}>
          {/* Business Info */}
          {activeTab === 'business' && (
            <>
              <div style={s.panelTitle}>Business Information</div>
              <p style={s.panelSub}>Your company details used on quotes, invoices, and emails.</p>

              <div style={s.fieldRow}>
                <div style={s.field}>
                  <label style={s.label}>Business Name</label>
                  <input style={s.input} value={business.businessName} onChange={e => updateBusiness('businessName', e.target.value)} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Owner Name</label>
                  <input style={s.input} value={business.ownerName} onChange={e => updateBusiness('ownerName', e.target.value)} />
                </div>
              </div>

              <div style={s.fieldRow}>
                <div style={s.field}>
                  <label style={s.label}>Phone</label>
                  <input style={s.input} value={business.phone} onChange={e => updateBusiness('phone', e.target.value)} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Email</label>
                  <input style={s.input} type="email" value={business.email} onChange={e => updateBusiness('email', e.target.value)} />
                </div>
              </div>

              <div style={s.field}>
                <label style={s.label}>Address Line 1</label>
                <input style={s.input} value={business.address1} onChange={e => updateBusiness('address1', e.target.value)} />
              </div>

              <div style={s.field}>
                <label style={s.label}>Address Line 2</label>
                <input style={s.input} value={business.address2} onChange={e => updateBusiness('address2', e.target.value)} />
              </div>

              <div style={s.fieldRow}>
                <div style={s.field}>
                  <label style={s.label}>City</label>
                  <input style={s.input} value={business.city} onChange={e => updateBusiness('city', e.target.value)} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>County</label>
                  <input style={s.input} value={business.county} onChange={e => updateBusiness('county', e.target.value)} />
                </div>
              </div>

              <div style={s.fieldRow}>
                <div style={s.field}>
                  <label style={s.label}>Postcode</label>
                  <input style={s.input} value={business.postcode} onChange={e => updateBusiness('postcode', e.target.value)} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Website</label>
                  <input style={s.input} value={business.website} onChange={e => updateBusiness('website', e.target.value)} />
                </div>
              </div>

              <div style={s.fieldRow}>
                <div style={s.field}>
                  <label style={s.label}>VAT Number</label>
                  <input style={s.input} placeholder="Optional" value={business.vatNumber} onChange={e => updateBusiness('vatNumber', e.target.value)} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Company Number</label>
                  <input style={s.input} placeholder="Optional" value={business.companyNumber} onChange={e => updateBusiness('companyNumber', e.target.value)} />
                </div>
              </div>
            </>
          )}

          {/* Working Hours */}
          {activeTab === 'hours' && (
            <>
              <div style={s.panelTitle}>Working Hours</div>
              <p style={s.panelSub}>Set your available hours for scheduling. Jobs booked outside these hours use out-of-hours pricing.</p>

              {DAYS.map(day => (
                <div key={day} style={s.hoursRow}>
                  <span style={{ ...s.dayLabel, opacity: hours[day].enabled ? 1 : 0.4 }}>{day}</span>
                  <button
                    style={{ ...s.toggle, background: hours[day].enabled ? C.gold : C.steel } as CSSProperties}
                    onClick={() => updateHours(day, 'enabled', !hours[day].enabled)}
                  >
                    <div style={{ ...s.toggleDot, left: hours[day].enabled ? 20 : 4 } as CSSProperties} />
                  </button>
                  <input
                    type="time"
                    style={{ ...s.timeInput, opacity: hours[day].enabled ? 1 : 0.3 } as CSSProperties}
                    value={hours[day].start}
                    onChange={e => updateHours(day, 'start', e.target.value)}
                    disabled={!hours[day].enabled}
                  />
                  <span style={s.dash as CSSProperties}>–</span>
                  <input
                    type="time"
                    style={{ ...s.timeInput, opacity: hours[day].enabled ? 1 : 0.3 } as CSSProperties}
                    value={hours[day].end}
                    onChange={e => updateHours(day, 'end', e.target.value)}
                    disabled={!hours[day].enabled}
                  />
                </div>
              ))}
            </>
          )}

          {/* Quotes & Invoices */}
          {activeTab === 'quotes' && (
            <>
              <div style={s.panelTitle}>Quotes & Invoices</div>
              <p style={s.panelSub}>Configure quote numbering, validity, and payment details.</p>

              <div style={s.fieldRow}>
                <div style={s.field}>
                  <label style={s.label}>Quote Prefix</label>
                  <input style={s.input} value={quoteSettings.prefix} onChange={e => updateQuote('prefix', e.target.value)} />
                </div>
                <div />
              </div>

              <div style={s.fieldRow}>
                <div style={s.field}>
                  <label style={s.label}>Quote Validity (days)</label>
                  <input style={s.input} type="number" value={quoteSettings.validityDays} onChange={e => updateQuote('validityDays', Number(e.target.value))} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Payment Terms (days)</label>
                  <input style={s.input} type="number" value={quoteSettings.paymentTerms} onChange={e => updateQuote('paymentTerms', Number(e.target.value))} />
                </div>
              </div>

              <div style={s.field}>
                <label style={s.label}>Quote Footer</label>
                <textarea style={s.textarea as CSSProperties} value={quoteSettings.footer} onChange={e => updateQuote('footer', e.target.value)} />
              </div>

              <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.steel}33` }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.white, marginBottom: 16 }}>Bank Details</div>
                <div style={s.fieldRow}>
                  <div style={s.field}>
                    <label style={s.label}>Bank Name</label>
                    <input style={s.input} placeholder="e.g. Starling, Tide" value={quoteSettings.bankName} onChange={e => updateQuote('bankName', e.target.value)} />
                  </div>
                  <div />
                </div>
                <div style={s.fieldRow}>
                  <div style={s.field}>
                    <label style={s.label}>Sort Code</label>
                    <input style={s.input} placeholder="XX-XX-XX" value={quoteSettings.sortCode} onChange={e => updateQuote('sortCode', e.target.value)} />
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>Account Number</label>
                    <input style={s.input} placeholder="XXXXXXXX" value={quoteSettings.accountNumber} onChange={e => updateQuote('accountNumber', e.target.value)} />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Notifications */}
          {activeTab === 'notifications' && (
            <>
              <div style={s.panelTitle}>Notifications</div>
              <p style={s.panelSub}>Choose which notifications you receive.</p>

              {[
                { key: 'jobReminders' as const, label: 'Job Reminders', desc: 'Get reminded about upcoming scheduled jobs' },
                { key: 'quoteFollowUp' as const, label: 'Quote Follow-ups', desc: 'Reminded to follow up on sent quotes after 3 days' },
                { key: 'invoiceOverdue' as const, label: 'Overdue Invoices', desc: 'Alert when an invoice passes its payment due date' },
                { key: 'scheduleAlerts' as const, label: 'Schedule Alerts', desc: 'Morning summary of today\'s bookings' },
                { key: 'weeklyDigest' as const, label: 'Weekly Digest', desc: 'Sunday evening summary of the week ahead' },
              ].map(n => (
                <div key={n.key} style={s.notifRow}>
                  <div>
                    <div style={s.notifLabel}>{n.label}</div>
                    <div style={s.notifDesc}>{n.desc}</div>
                  </div>
                  <button
                    style={{ ...s.toggle, background: notifications[n.key] ? C.gold : C.steel } as CSSProperties}
                    onClick={() => toggleNotif(n.key)}
                  >
                    <div style={{ ...s.toggleDot, left: notifications[n.key] ? 20 : 4 } as CSSProperties} />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
