import { useState } from 'react'
import { Building2, ChevronRight, Sparkles } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useTheme } from '../theme/ThemeContext'
import { validateRequired } from '../lib/validation'
import type { CSSProperties } from 'react'

type Step = 'setup' | 'success'

const TRADE_OPTIONS = [
  { value: 'electrician', label: 'Electrician' },
  { value: 'plumber', label: 'Plumber' },
  { value: 'builder', label: 'Builder' },
  { value: 'general', label: 'General Contractor' },
  { value: 'other', label: 'Other' },
]

export default function Onboarding() {
  const { C } = useTheme()
  const { createOrganization } = useAuth()

  const [step, setStep] = useState<Step>('setup')
  const [businessName, setBusinessName] = useState('')
  const [tradeType, setTradeType] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const errs: Record<string, string> = {}
    const nameErr = validateRequired(businessName, 'Business name')
    if (nameErr) errs.businessName = nameErr
    if (!tradeType) errs.tradeType = 'Please select your trade'
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) return

    setLoading(true)
    const result = await createOrganization(businessName.trim(), tradeType, phone.trim() || undefined)
    setLoading(false)

    if (result.error) {
      setError(result.error)
    } else {
      setStep('success')
    }
  }

  const s: Record<string, CSSProperties> = {
    page: {
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: C.black, padding: 24,
    },
    card: {
      width: '100%', maxWidth: 480, background: C.charcoalLight, borderRadius: 20,
      padding: '48px 40px', boxShadow: '0 16px 48px rgba(0,0,0,.4)',
    },
    brand: {
      fontFamily: "'Cinzel', serif", fontSize: 28, fontWeight: 700, color: C.gold,
      textAlign: 'center', marginBottom: 4,
    },
    brandSub: {
      fontSize: 13, color: C.steel, textAlign: 'center', marginBottom: 36,
      letterSpacing: 1, textTransform: 'uppercase',
    },
    heading: {
      fontSize: 20, fontWeight: 600, color: C.white, textAlign: 'center', marginBottom: 8,
    },
    subheading: {
      fontSize: 14, color: C.silver, textAlign: 'center', marginBottom: 32, lineHeight: 1.5,
    },
    field: { marginBottom: 20 },
    label: {
      fontSize: 12, fontWeight: 600, color: C.silver, textTransform: 'uppercase',
      letterSpacing: 0.5, marginBottom: 6, display: 'block',
    },
    input: {
      width: '100%', background: C.black, border: `1px solid ${C.steel}44`,
      borderRadius: 10, padding: '14px 16px', color: C.white, fontSize: 15,
      outline: 'none', minHeight: 48, boxSizing: 'border-box',
      transition: 'border-color .15s',
    },
    select: {
      width: '100%', background: C.black, border: `1px solid ${C.steel}44`,
      borderRadius: 10, padding: '14px 16px', color: C.white, fontSize: 15,
      outline: 'none', minHeight: 48, boxSizing: 'border-box', cursor: 'pointer',
      appearance: 'none' as const,
    },
    error: {
      background: '#D46A6A1A', border: '1px solid #D46A6A33', borderRadius: 10,
      padding: '12px 16px', fontSize: 13, color: '#D46A6A', marginBottom: 20,
      textAlign: 'center',
    },
    fieldError: { fontSize: 12, color: '#D46A6A', marginTop: 4, marginBottom: 0 },
    submitBtn: {
      width: '100%', background: C.gold, color: C.black, border: 'none',
      borderRadius: 12, padding: '14px', fontSize: 16, fontWeight: 600,
      cursor: 'pointer', minHeight: 52, display: 'flex', alignItems: 'center',
      justifyContent: 'center', gap: 8, transition: 'opacity .15s',
    },
    successIcon: {
      width: 72, height: 72, borderRadius: '50%', background: `${C.gold}1A`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      margin: '0 auto 24px',
    },
    successHeading: {
      fontSize: 24, fontWeight: 700, color: C.white, textAlign: 'center', marginBottom: 8,
      fontFamily: "'Cinzel', serif",
    },
    successText: {
      fontSize: 15, color: C.silver, textAlign: 'center', marginBottom: 32, lineHeight: 1.6,
    },
  }

  if (step === 'success') {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.successIcon}>
            <Sparkles size={32} color={C.gold} />
          </div>
          <div style={s.successHeading as CSSProperties}>Welcome to Varda</div>
          <div style={s.successText as CSSProperties}>
            Your business is set up and ready to go. Let's get to work.
          </div>
          <button
            type="button"
            style={s.submitBtn as CSSProperties}
            onClick={() => window.location.reload()}
          >
            Enter the App
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.brand as CSSProperties}>Varda</div>
        <div style={s.brandSub as CSSProperties}>Business Management</div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
          <Building2 size={20} color={C.gold} />
          <span style={s.heading as CSSProperties}>Set up your business</span>
        </div>
        <div style={s.subheading as CSSProperties}>
          Tell us about your business so we can configure everything for you.
        </div>

        <form onSubmit={handleSetup}>
          <div style={s.field}>
            <label style={s.label}>Business Name</label>
            <input
              style={{ ...s.input, ...(fieldErrors.businessName ? { borderColor: '#D46A6A' } : {}) }}
              type="text"
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              placeholder="e.g. Grey Havens Electrical"
              autoFocus
            />
            {fieldErrors.businessName && <div style={s.fieldError}>{fieldErrors.businessName}</div>}
          </div>

          <div style={s.field}>
            <label style={s.label}>Trade</label>
            <select
              style={{ ...s.select, ...(fieldErrors.tradeType ? { borderColor: '#D46A6A' } : {}) }}
              value={tradeType}
              onChange={e => setTradeType(e.target.value)}
            >
              <option value="" disabled>Select your trade</option>
              {TRADE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {fieldErrors.tradeType && <div style={s.fieldError}>{fieldErrors.tradeType}</div>}
          </div>

          <div style={s.field}>
            <label style={s.label}>Phone Number <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
            <input
              style={s.input}
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="07XXX XXX XXX"
            />
          </div>

          {error && <div style={s.error as CSSProperties}>{error}</div>}

          <button
            type="submit"
            style={{ ...s.submitBtn, opacity: loading ? 0.7 : 1 } as CSSProperties}
            disabled={loading}
          >
            <Building2 size={18} />
            {loading ? 'Setting up...' : 'Create Business'}
          </button>
        </form>
      </div>
    </div>
  )
}
