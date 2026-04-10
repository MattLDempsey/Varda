import React, { useState, useEffect } from 'react'
import { Save, Building2, Clock, FileText, Bell, Link, Copy, Check, MessageSquare, Mail, MessageCircle, Smartphone, ChevronDown, RotateCcw, Shield, Briefcase, Plus, Trash2 } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useTheme } from '../theme/ThemeContext'
import { useAuth } from '../auth/AuthContext'
import { useData } from '../data/DataContext'
import SettingsNav from '../components/SettingsNav'
import { supabase } from '../lib/supabase'
import type { AppSettings } from '../data/DataContext'
import { loadTemplates, saveTemplate, resetTemplate, DEFAULT_TEMPLATES } from '../data/templates'
import type { MessageTemplate } from '../data/templates'
import { PERMISSION_GROUPS, hasPermission } from '../data/permissions'

/* ── types ── */
type SettingsTab = 'business' | 'hours' | 'quotes' | 'notifications' | 'templates' | 'permissions' | 'jobtypes' | 'activity'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function SettingsPage() {
  const { C } = useTheme()
  const { user } = useAuth()
  const data = useData()
  const { settings, updateSettings } = data
  const [activeTab, setActiveTab] = useState<SettingsTab>('business')
  const [saved, setSaved] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const bookingUrl = user?.orgId ? `${window.location.origin}/book/${user.orgId}` : ''
  const handleCopyBookingLink = () => {
    if (!bookingUrl) return
    navigator.clipboard.writeText(bookingUrl)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2500)
  }

  // Local draft state so edits don't persist until Save is clicked
  const [business, setBusiness] = useState<AppSettings['business']>({ ...settings.business })
  const [hours, setHours] = useState<AppSettings['workingHours']>(JSON.parse(JSON.stringify(settings.workingHours)))
  const [quoteSettings, setQuoteSettings] = useState<AppSettings['quoteConfig']>({ ...settings.quoteConfig })
  const [notifications, setNotifications] = useState<AppSettings['notifications']>({ ...settings.notifications })
  const [templates, setTemplates] = useState<MessageTemplate[]>(loadTemplates())
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [editSubject, setEditSubject] = useState('')

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
    fieldRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 0 },
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
      display: 'grid', gridTemplateColumns: 'minmax(80px, 120px) 44px 1fr 14px 1fr', gap: 8,
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
    { id: 'templates', label: 'Templates', icon: <MessageSquare size={18} /> },
    { id: 'permissions', label: 'Permissions', icon: <Shield size={18} /> },
    { id: 'jobtypes', label: 'Job Types', icon: <Briefcase size={18} /> },
    { id: 'activity', label: 'Activity Log', icon: <Clock size={18} /> },
  ]

  return (
    <div style={s.page}>
      <SettingsNav active="settings" />
      {/* header */}
      <div style={s.header}>
        <h1 style={s.heading}>Organisation Settings</h1>
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

              {/* Booking Link */}
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.steel}33` }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.white, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Link size={16} color={C.gold} />
                  Customer Booking Link
                </div>
                <div style={{ fontSize: 13, color: C.silver, marginBottom: 12, lineHeight: 1.5 }}>
                  Share this link on your website, social media, or with customers so they can book online.
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    style={{ ...s.input, flex: 1, fontSize: 13, color: C.gold, cursor: 'text' }}
                    value={bookingUrl}
                    readOnly
                    onFocus={e => e.target.select()}
                  />
                  <button
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
                      borderRadius: 8, background: linkCopied ? C.green : C.gold,
                      color: C.black, border: 'none', cursor: 'pointer', fontSize: 13,
                      fontWeight: 600, minHeight: 44, transition: 'background .15s',
                      whiteSpace: 'nowrap',
                    }}
                    onClick={handleCopyBookingLink}
                  >
                    {linkCopied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy Link</>}
                  </button>
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
          {/* Templates */}
          {activeTab === 'templates' && (
            <>
              <div style={s.panelTitle}>Message Templates</div>
              <p style={s.panelSub}>Customise the templates used when sending quotes, invoices, and reminders to customers.</p>

              {templates.map(tmpl => {
                const channelIcon = tmpl.channel === 'email'
                  ? <Mail size={14} color="#5B9BD5" />
                  : tmpl.channel === 'whatsapp'
                  ? <MessageCircle size={14} color="#25D366" />
                  : <Smartphone size={14} color={C.silver} />

                const channelLabel = tmpl.channel === 'email' ? 'Email'
                  : tmpl.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'

                const isExpanded = expandedTemplate === tmpl.id
                const isEditing = editingTemplate === tmpl.id

                const defaultTmpl = DEFAULT_TEMPLATES.find(d => d.id === tmpl.id)
                const isModified = defaultTmpl && (tmpl.body !== defaultTmpl.body || tmpl.subject !== defaultTmpl.subject)

                return (
                  <div
                    key={tmpl.id}
                    style={{
                      background: `${C.steel}11`, borderRadius: 10, padding: '14px 16px',
                      marginBottom: 10, border: `1px solid ${C.steel}22`,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        setExpandedTemplate(isExpanded ? null : tmpl.id)
                        if (isEditing) setEditingTemplate(null)
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {channelIcon}
                        <span style={{ fontSize: 14, fontWeight: 600, color: C.white }}>{tmpl.name}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 12,
                          color: C.silver, background: `${C.steel}22`,
                          textTransform: 'uppercase' as const, letterSpacing: 0.5,
                        }}>
                          {channelLabel}
                        </span>
                        {isModified && (
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 12,
                            color: C.gold, background: `${C.gold}1A`,
                            textTransform: 'uppercase' as const, letterSpacing: 0.5,
                          }}>
                            Modified
                          </span>
                        )}
                      </div>
                      <ChevronDown size={16} color={C.steel} style={{
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform .15s',
                      }} />
                    </div>

                    {!isExpanded && (
                      <div style={{
                        fontSize: 12, color: C.silver, marginTop: 6,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {tmpl.body.split('\n')[0].slice(0, 80)}{tmpl.body.length > 80 ? '...' : ''}
                      </div>
                    )}

                    {isExpanded && !isEditing && (
                      <div style={{ marginTop: 12 }}>
                        {tmpl.subject && (
                          <div style={{ marginBottom: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: C.silver, textTransform: 'uppercase' as const }}>Subject: </span>
                            <span style={{ fontSize: 13, color: C.white }}>{tmpl.subject}</span>
                          </div>
                        )}
                        <div style={{
                          padding: '12px 14px', borderRadius: 8, background: C.black,
                          fontSize: 12, color: C.silver, whiteSpace: 'pre-wrap', lineHeight: 1.5,
                          maxHeight: 240, overflowY: 'auto',
                        }}>
                          {tmpl.body}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingTemplate(tmpl.id)
                              setEditBody(tmpl.body)
                              setEditSubject(tmpl.subject || '')
                            }}
                            style={{
                              padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                              background: C.gold, color: C.black, border: 'none', cursor: 'pointer',
                              minHeight: 36,
                            }}
                          >
                            Edit Template
                          </button>
                          {isModified && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                resetTemplate(tmpl.id)
                                setTemplates(loadTemplates())
                              }}
                              style={{
                                padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                                background: 'transparent', color: C.silver, border: `1px solid ${C.steel}44`,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                                minHeight: 36,
                              }}
                            >
                              <RotateCcw size={12} /> Reset to Default
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {isExpanded && isEditing && (
                      <div style={{ marginTop: 12 }}>
                        {tmpl.channel === 'email' && (
                          <div style={{ marginBottom: 10 }}>
                            <label style={{ fontSize: 11, fontWeight: 600, color: C.silver, textTransform: 'uppercase' as const, display: 'block', marginBottom: 4 }}>Subject</label>
                            <input
                              style={{
                                width: '100%', background: C.black, border: `1px solid ${C.steel}44`,
                                borderRadius: 8, padding: '8px 12px', color: C.white, fontSize: 13,
                                outline: 'none', boxSizing: 'border-box' as const, minHeight: 36,
                              }}
                              value={editSubject}
                              onChange={e => setEditSubject(e.target.value)}
                            />
                          </div>
                        )}
                        <label style={{ fontSize: 11, fontWeight: 600, color: C.silver, textTransform: 'uppercase' as const, display: 'block', marginBottom: 4 }}>Body</label>
                        <textarea
                          style={{
                            width: '100%', background: C.black, border: `1px solid ${C.steel}44`,
                            borderRadius: 8, padding: '10px 12px', color: C.white, fontSize: 12,
                            outline: 'none', minHeight: 160, resize: 'vertical' as const,
                            lineHeight: 1.5, fontFamily: 'inherit', boxSizing: 'border-box' as const,
                          }}
                          value={editBody}
                          onChange={e => setEditBody(e.target.value)}
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const updates: Partial<MessageTemplate> = { body: editBody }
                              if (tmpl.channel === 'email') updates.subject = editSubject
                              saveTemplate(tmpl.id, updates)
                              setTemplates(loadTemplates())
                              setEditingTemplate(null)
                            }}
                            style={{
                              padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                              background: C.gold, color: C.black, border: 'none', cursor: 'pointer',
                              minHeight: 36,
                            }}
                          >
                            Save
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingTemplate(null)
                            }}
                            style={{
                              padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                              background: 'transparent', color: C.silver, border: `1px solid ${C.steel}44`,
                              cursor: 'pointer', minHeight: 36,
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )}

          {/* ════════════════════════════════════════════════
              PERMISSIONS TAB
              ════════════════════════════════════════════════ */}
          {activeTab === 'permissions' && (() => {
            // eslint-disable-next-line react-hooks/rules-of-hooks
            const [permOverrides, setPermOverrides] = useState<Record<string, Record<string, boolean>>>({})
            // eslint-disable-next-line react-hooks/rules-of-hooks
            const [permLoaded, setPermLoaded] = useState(false)
            // eslint-disable-next-line react-hooks/rules-of-hooks
            useEffect(() => {
              if (permLoaded) return
              supabase.from('org_permissions').select('role, permission, allowed').then(({ data }) => {
                const overrides: Record<string, Record<string, boolean>> = {}
                for (const row of (data ?? [])) {
                  if (!overrides[row.role]) overrides[row.role] = {}
                  overrides[row.role][row.permission] = row.allowed
                }
                setPermOverrides(overrides)
                setPermLoaded(true)
              })
            }, [permLoaded])
            const togglePerm = (role: string, permission: string) => {
              const current = hasPermission(role as any, permission as any, permOverrides[role])
              const newVal = !current
              setPermOverrides(prev => ({ ...prev, [role]: { ...(prev[role] ?? {}), [permission]: newVal } }))
              // Upsert to DB
              supabase.from('org_permissions').upsert({
                org_id: user?.orgId, role, permission, allowed: newVal,
              }, { onConflict: 'org_id,role,permission' }).then(() => {}, () => {})
            }
            return (
            <div style={s.panel}>
              <div style={s.panelTitle}>Role Permissions</div>
              <div style={s.panelSub}>
                Control what each role can do. Owner always has full access. Click a checkbox to toggle.
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '10px 14px', color: C.silver, fontWeight: 600, borderBottom: `1px solid ${C.steel}33` }}>Permission</th>
                      <th style={{ textAlign: 'center', padding: '10px 14px', color: '#6ABF8A', fontWeight: 600, borderBottom: `1px solid ${C.steel}33` }}>Admin</th>
                      <th style={{ textAlign: 'center', padding: '10px 14px', color: C.gold, fontWeight: 600, borderBottom: `1px solid ${C.steel}33` }}>Member</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      return PERMISSION_GROUPS.map((group) => (
                        <React.Fragment key={group.label}>
                          <tr>
                            <td colSpan={3} style={{
                              padding: '14px 14px 6px', fontWeight: 700, fontSize: 12,
                              color: C.gold, textTransform: 'uppercase', letterSpacing: 0.5,
                              borderBottom: `1px solid ${C.steel}22`,
                            }}>
                              {group.label}
                            </td>
                          </tr>
                          {group.permissions.map((p) => (
                            <tr key={p.key}>
                              <td style={{ padding: '8px 14px', color: C.white, borderBottom: `1px solid ${C.steel}11` }}>
                                {p.label}
                              </td>
                              <td style={{ textAlign: 'center', padding: '8px 14px', borderBottom: `1px solid ${C.steel}11` }}>
                                <button
                                  onClick={() => togglePerm('admin', p.key)}
                                  style={{
                                    display: 'inline-block', width: 20, height: 20, borderRadius: 4,
                                    background: hasPermission('admin', p.key as any, permOverrides.admin) ? '#6ABF8A' : C.black,
                                    border: `1px solid ${hasPermission('admin', p.key as any, permOverrides.admin) ? '#6ABF8A' : C.steel}`,
                                    color: hasPermission('admin', p.key as any, permOverrides.admin) ? '#fff' : 'transparent',
                                    fontSize: 11, fontWeight: 700, lineHeight: '18px', textAlign: 'center',
                                    cursor: 'pointer', padding: 0,
                                  }}
                                >✓</button>
                              </td>
                              <td style={{ textAlign: 'center', padding: '8px 14px', borderBottom: `1px solid ${C.steel}11` }}>
                                <button
                                  onClick={() => togglePerm('member', p.key)}
                                  style={{
                                    display: 'inline-block', width: 20, height: 20, borderRadius: 4,
                                    background: hasPermission('member', p.key as any, permOverrides.member) ? C.gold : C.black,
                                    border: `1px solid ${hasPermission('member', p.key as any, permOverrides.member) ? C.gold : C.steel}`,
                                    color: hasPermission('member', p.key as any, permOverrides.member) ? C.charcoal : 'transparent',
                                    fontSize: 11, fontWeight: 700, lineHeight: '18px', textAlign: 'center',
                                    cursor: 'pointer', padding: 0,
                                  }}
                                >✓</button>
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))
                    })()}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 12, color: C.steel, marginTop: 16, fontStyle: 'italic' }}>
                Click any checkbox to customise permissions for your organisation. Changes save automatically.
              </div>
            </div>
            )
          })()}

          {/* ════════════════════════════════════════════════
              JOB TYPES TAB
              ════════════════════════════════════════════════ */}
          {activeTab === 'jobtypes' && (() => {
            const { jobTypeConfigs, updateJobTypeConfig } = data
            return (
            <div style={s.panel}>
              <div style={s.panelTitle}>Job Types</div>
              <div style={s.panelSub}>
                Manage the job types available in Quick Quote. Adjust base pricing, hours, and minimum charges per type.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {jobTypeConfigs.map(jt => (
                  <div key={jt.id} style={{
                    background: C.black, borderRadius: 10, padding: '14px 16px',
                    border: `1px solid ${C.steel}22`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: C.white }}>{jt.name}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                        color: jt.certRequired ? '#9B7ED8' : C.steel,
                        background: jt.certRequired ? '#9B7ED815' : 'transparent',
                        border: `1px solid ${jt.certRequired ? '#9B7ED844' : C.steel + '33'}`,
                      }}>
                        {jt.certRequired ? 'Cert Required' : 'No Cert'}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 10, color: C.steel, textTransform: 'uppercase', marginBottom: 2 }}>Base Materials</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 11, color: C.steel }}>£</span>
                          <input
                            type="number" min={0} step={5}
                            value={jt.baseMaterialCost}
                            onChange={e => updateJobTypeConfig(jt.id, { baseMaterialCost: Number(e.target.value) || 0 })}
                            style={{
                              width: '100%', padding: '6px 8px', borderRadius: 6,
                              background: C.charcoal, border: `1px solid ${C.steel}33`,
                              color: C.white, fontSize: 13, outline: 'none',
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: C.steel, textTransform: 'uppercase', marginBottom: 2 }}>Base Hours</div>
                        <input
                          type="number" min={0} step={0.5}
                          value={jt.baseHours}
                          onChange={e => updateJobTypeConfig(jt.id, { baseHours: Number(e.target.value) || 0 })}
                          style={{
                            width: '100%', padding: '6px 8px', borderRadius: 6,
                            background: C.charcoal, border: `1px solid ${C.steel}33`,
                            color: C.white, fontSize: 13, outline: 'none',
                          }}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: C.steel, textTransform: 'uppercase', marginBottom: 2 }}>Min Charge</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 11, color: C.steel }}>£</span>
                          <input
                            type="number" min={0} step={5}
                            value={jt.minCharge}
                            onChange={e => updateJobTypeConfig(jt.id, { minCharge: Number(e.target.value) || 0 })}
                            style={{
                              width: '100%', padding: '6px 8px', borderRadius: 6,
                              background: C.charcoal, border: `1px solid ${C.steel}33`,
                              color: C.white, fontSize: 13, outline: 'none',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  const name = window.prompt('New job type name:')
                  if (!name?.trim()) return
                  const id = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
                  if (data.jobTypeConfigs.find(jt => jt.id === id)) { alert('A job type with that name already exists.'); return }
                  data.updateJobTypeConfig(id, { id, name: name.trim(), baseMaterialCost: 0, baseHours: 1, certRequired: false, isPerUnit: false, minCharge: 0 } as any)
                }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', minHeight: 42, marginTop: 12,
                  background: 'transparent', border: `1px dashed ${C.gold}44`, color: C.gold,
                }}
              >
                <Plus size={14} /> Add Custom Job Type
              </button>
            </div>
            )
          })()}

          {/* ════════════════════════════════════════════════
              ACTIVITY LOG TAB
              ════════════════════════════════════════════════ */}
          {activeTab === 'activity' && (() => {
            // eslint-disable-next-line react-hooks/rules-of-hooks
            const [logs, setLogs] = useState<Array<{ id: string; user_name: string; action: string; entity_type: string; entity_id: string; details: any; created_at: string }>>([])
            // eslint-disable-next-line react-hooks/rules-of-hooks
            const [logsLoading, setLogsLoading] = useState(true)
            // eslint-disable-next-line react-hooks/rules-of-hooks
            useEffect(() => {
              supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(50)
                .then(({ data }) => { setLogs(data ?? []); setLogsLoading(false) })
            }, [])
            const actionLabels: Record<string, string> = {
              'job.created': 'Created job', 'job.updated': 'Updated job', 'job.statusChanged': 'Changed status',
              'job.deleted': 'Deleted job', 'job.assigned': 'Assigned job',
              'quote.created': 'Created quote', 'quote.sent': 'Sent quote', 'quote.updated': 'Updated quote',
              'invoice.created': 'Created invoice', 'invoice.sent': 'Sent invoice', 'invoice.paid': 'Marked paid',
              'invoice.voided': 'Voided invoice', 'invoice.deleted': 'Deleted invoice',
              'customer.created': 'Added customer', 'customer.updated': 'Updated customer',
              'event.created': 'Scheduled event', 'schedule.confirmed': 'Sent confirmation',
              'settings.updated': 'Updated settings',
            }
            return (
              <div style={s.panel}>
                <div style={s.panelTitle}>Activity Log</div>
                <div style={s.panelSub}>Recent activity across your organisation. Shows the last 50 actions.</div>
                {logsLoading && <div style={{ color: C.steel, fontSize: 13, padding: 20, textAlign: 'center' }}>Loading...</div>}
                {!logsLoading && logs.length === 0 && <div style={{ color: C.steel, fontSize: 13, padding: 20, textAlign: 'center' }}>No activity recorded yet.</div>}
                {logs.map(log => (
                  <div key={log.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '10px 0', borderBottom: `1px solid ${C.steel}11`,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: C.black, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, color: C.gold, border: `1px solid ${C.steel}33`,
                    }}>
                      {(log.user_name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: C.white }}>
                        <strong>{log.user_name || 'System'}</strong>{' '}
                        <span style={{ color: C.silver }}>{actionLabels[log.action] || log.action}</span>
                        {log.details?.from && log.details?.to && (
                          <span style={{ color: C.steel }}> ({log.details.from} → {log.details.to})</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: C.steel, marginTop: 2 }}>
                        {new Date(log.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {log.entity_type && <span> · {log.entity_type}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
