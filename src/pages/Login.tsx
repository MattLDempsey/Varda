import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, LogIn, Building2 } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useTheme } from '../theme/ThemeContext'
import { validateEmail, validateMinLength } from '../lib/validation'
import type { CSSProperties } from 'react'

type Mode = 'signin' | 'register'

export default function Login() {
  const { C } = useTheme()
  const { signIn, signUp } = useAuth()
  const [searchParams] = useSearchParams()
  const inviteMode = searchParams.get('invite') === 'true'

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [registerSuccess, setRegisterSuccess] = useState(false)

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const errs: Record<string, string> = {}
    if (!email) errs.email = 'Email is required'
    else { const emailErr = validateEmail(email); if (emailErr) errs.email = emailErr }
    if (!password) errs.password = 'Password is required'
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) return
    setLoading(true)
    const result = await signIn(email, password)
    setLoading(false)
    if (result.error) setError(result.error)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const errs: Record<string, string> = {}
    if (!displayName.trim()) errs.displayName = 'Name is required'
    if (!email) errs.email = 'Email is required'
    else { const emailErr = validateEmail(email); if (emailErr) errs.email = emailErr }
    if (!password) errs.password = 'Password is required'
    else { const pwErr = validateMinLength(password, 6, 'Password'); if (pwErr) errs.password = pwErr }
    if (password && confirmPassword !== password) errs.confirmPassword = 'Passwords do not match'
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) return
    setLoading(true)
    const result = await signUp(email, password, displayName.trim())
    setLoading(false)
    if (result.error) { setError(result.error) } else { setRegisterSuccess(true) }
  }

  const s: Record<string, CSSProperties> = {
    page: { minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.black, padding: 24 },
    card: { width: '100%', maxWidth: 420, background: C.charcoalLight, borderRadius: 20, padding: '48px 40px', boxShadow: '0 16px 48px rgba(0,0,0,.4)' },
    brand: { fontFamily: "'Cinzel', serif", fontSize: 28, fontWeight: 700, color: C.gold, textAlign: 'center', marginBottom: 4 },
    brandSub: { fontSize: 13, color: C.steel, textAlign: 'center', marginBottom: 36, letterSpacing: 1, textTransform: 'uppercase' },
    field: { marginBottom: 20 },
    label: { fontSize: 12, fontWeight: 600, color: C.silver, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'block' },
    inputWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
    input: { width: '100%', background: C.black, border: `1px solid ${C.steel}44`, borderRadius: 10, padding: '14px 16px', color: C.white, fontSize: 15, outline: 'none', minHeight: 48, boxSizing: 'border-box' },
    eyeBtn: { position: 'absolute', right: 12, background: 'transparent', border: 'none', color: C.steel, cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    error: { background: '#D46A6A1A', border: '1px solid #D46A6A33', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#D46A6A', marginBottom: 20, textAlign: 'center' },
    success: { background: '#6ABF8A1A', border: '1px solid #6ABF8A33', borderRadius: 10, padding: '16px', fontSize: 14, color: '#6ABF8A', marginBottom: 20, textAlign: 'center', lineHeight: 1.5 },
    submitBtn: { width: '100%', background: C.gold, color: C.black, border: 'none', borderRadius: 12, padding: '14px', fontSize: 16, fontWeight: 600, cursor: 'pointer', minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
    toggle: { marginTop: 24, textAlign: 'center', fontSize: 14, color: C.silver },
    toggleLink: { background: 'none', border: 'none', color: C.gold, cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: 0, textDecoration: 'underline', textUnderlineOffset: 2 },
    fieldError: { fontSize: 12, color: '#D46A6A', marginTop: 4, marginBottom: 0 },
  }

  // Registration success
  if (registerSuccess) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.brand as CSSProperties}>Varda</div>
          <div style={s.brandSub as CSSProperties}>Business Management</div>
          <div style={s.success as CSSProperties}>
            Account created. Check your email to verify your account, then sign in.
          </div>
          <button type="button" style={s.submitBtn as CSSProperties} onClick={() => { setRegisterSuccess(false); setMode('signin'); setEmail(''); setPassword('') }}>
            <LogIn size={18} /> Go to Sign In
          </button>
        </div>
      </div>
    )
  }

  // Sign In (default)
  if (mode === 'signin') {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.brand as CSSProperties}>Varda</div>
          <div style={s.brandSub as CSSProperties}>Business Management</div>

          {inviteMode && (
            <div style={{ ...s.success, marginBottom: 24 } as CSSProperties}>
              You've been invited to join a business. Sign in with the email your invitation was sent to.
            </div>
          )}

          <form onSubmit={handleSignIn}>
            <div style={s.field}>
              <label style={s.label}>Email</label>
              <input style={{ ...s.input, ...(fieldErrors.email ? { borderColor: '#D46A6A' } : {}) }} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" autoFocus />
              {fieldErrors.email && <div style={s.fieldError}>{fieldErrors.email}</div>}
            </div>
            <div style={s.field}>
              <label style={s.label}>Password</label>
              <div style={s.inputWrap as CSSProperties}>
                <input style={{ ...s.input, ...(fieldErrors.password ? { borderColor: '#D46A6A' } : {}) }} type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" />
                <button type="button" style={s.eyeBtn as CSSProperties} onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {fieldErrors.password && <div style={s.fieldError}>{fieldErrors.password}</div>}
            </div>
            {error && <div style={s.error as CSSProperties}>{error}</div>}
            <button type="submit" style={{ ...s.submitBtn, opacity: loading ? 0.7 : 1 } as CSSProperties} disabled={loading}>
              <LogIn size={18} /> {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div style={s.toggle as CSSProperties}>
            New business?{' '}
            <button type="button" style={s.toggleLink} onClick={() => { setMode('register'); setError('') }}>Register your business</button>
          </div>
        </div>
      </div>
    )
  }

  // Register Business (owner only)
  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.brand as CSSProperties}>Varda</div>
        <div style={s.brandSub as CSSProperties}>Business Management</div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <Building2 size={40} color={C.gold} strokeWidth={1.5} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, color: C.white, textAlign: 'center', marginBottom: 8 } as CSSProperties}>
          Register your business
        </div>
        <p style={{ fontSize: 13, color: C.silver, textAlign: 'center', marginBottom: 28 } as CSSProperties}>
          Create your account to get started. You'll set up your business details next.
        </p>

        <form onSubmit={handleRegister}>
          <div style={s.field}>
            <label style={s.label}>Your Name</label>
            <input style={{ ...s.input, ...(fieldErrors.displayName ? { borderColor: '#D46A6A' } : {}) }} type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Full name" autoComplete="name" autoFocus />
            {fieldErrors.displayName && <div style={s.fieldError}>{fieldErrors.displayName}</div>}
          </div>
          <div style={s.field}>
            <label style={s.label}>Email</label>
            <input style={{ ...s.input, ...(fieldErrors.email ? { borderColor: '#D46A6A' } : {}) }} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@business.com" autoComplete="email" />
            {fieldErrors.email && <div style={s.fieldError}>{fieldErrors.email}</div>}
          </div>
          <div style={s.field}>
            <label style={s.label}>Password</label>
            <div style={s.inputWrap as CSSProperties}>
              <input style={{ ...s.input, ...(fieldErrors.password ? { borderColor: '#D46A6A' } : {}) }} type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />
              <button type="button" style={s.eyeBtn as CSSProperties} onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {fieldErrors.password && <div style={s.fieldError}>{fieldErrors.password}</div>}
          </div>
          <div style={s.field}>
            <label style={s.label}>Confirm Password</label>
            <input style={{ ...s.input, ...(fieldErrors.confirmPassword ? { borderColor: '#D46A6A' } : {}) }} type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password" autoComplete="new-password" />
            {fieldErrors.confirmPassword && <div style={s.fieldError}>{fieldErrors.confirmPassword}</div>}
          </div>
          {error && <div style={s.error as CSSProperties}>{error}</div>}
          <button type="submit" style={{ ...s.submitBtn, opacity: loading ? 0.7 : 1 } as CSSProperties} disabled={loading}>
            <Building2 size={18} /> {loading ? 'Creating account...' : 'Register'}
          </button>
        </form>

        <div style={s.toggle as CSSProperties}>
          Already have an account?{' '}
          <button type="button" style={s.toggleLink} onClick={() => { setMode('signin'); setError('') }}>Sign In</button>
        </div>
      </div>
    </div>
  )
}
