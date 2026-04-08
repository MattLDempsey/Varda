import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, CheckCircle } from 'lucide-react'
import { useTheme } from '../theme/ThemeContext'
import { supabase } from '../lib/supabase'
import { validateMinLength } from '../lib/validation'
import type { CSSProperties } from 'react'

export default function ResetPassword() {
  const { C } = useTheme()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [sessionError, setSessionError] = useState(false)

  // On mount, pick up the recovery session from the URL hash tokens
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error: err }) => {
      if (err || !session) {
        setSessionError(true)
      } else {
        setSessionReady(true)
      }
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const errs: Record<string, string> = {}
    if (!password) errs.password = 'Password is required'
    else { const pwErr = validateMinLength(password, 6, 'Password'); if (pwErr) errs.password = pwErr }
    if (password && confirmPassword !== password) errs.confirmPassword = 'Passwords do not match'
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) return
    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess(true)
      setTimeout(() => navigate('/login', { replace: true }), 3000)
    }
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
    fieldError: { fontSize: 12, color: '#D46A6A', marginTop: 4, marginBottom: 0 },
    link: { background: 'none', border: 'none', color: C.gold, cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: 0, textDecoration: 'underline', textUnderlineOffset: 2 },
  }

  // Session error — invalid or expired link
  if (sessionError) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.brand}>Varda</div>
          <div style={s.brandSub}>Business Management</div>
          <div style={s.error}>
            This password reset link is invalid or has expired. Please request a new one.
          </div>
          <button type="button" style={s.submitBtn} onClick={() => navigate('/login', { replace: true })}>
            Back to Sign In
          </button>
        </div>
      </div>
    )
  }

  // Loading session
  if (!sessionReady) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.brand}>Varda</div>
          <div style={s.brandSub}>Business Management</div>
          <div style={{ textAlign: 'center', color: C.silver, padding: '20px 0' }}>
            Verifying reset link...
          </div>
        </div>
      </div>
    )
  }

  // Success
  if (success) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.brand}>Varda</div>
          <div style={s.brandSub}>Business Management</div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <CheckCircle size={40} color="#6ABF8A" strokeWidth={1.5} />
          </div>
          <div style={s.success}>
            Password updated successfully! Redirecting to sign in...
          </div>
          <button type="button" style={s.submitBtn} onClick={() => navigate('/login', { replace: true })}>
            Go to Sign In
          </button>
        </div>
      </div>
    )
  }

  // Reset form
  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.brand}>Varda</div>
        <div style={s.brandSub}>Business Management</div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <Lock size={40} color={C.gold} strokeWidth={1.5} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, color: C.white, textAlign: 'center', marginBottom: 8 } as CSSProperties}>
          Set new password
        </div>
        <p style={{ fontSize: 13, color: C.silver, textAlign: 'center', marginBottom: 28 } as CSSProperties}>
          Enter your new password below.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={s.field}>
            <label style={s.label}>New Password</label>
            <div style={s.inputWrap}>
              <input
                style={{ ...s.input, ...(fieldErrors.password ? { borderColor: '#D46A6A' } : {}) }}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
                autoFocus
              />
              <button type="button" style={s.eyeBtn} onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {fieldErrors.password && <div style={s.fieldError}>{fieldErrors.password}</div>}
          </div>
          <div style={s.field}>
            <label style={s.label}>Confirm Password</label>
            <input
              style={{ ...s.input, ...(fieldErrors.confirmPassword ? { borderColor: '#D46A6A' } : {}) }}
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              autoComplete="new-password"
            />
            {fieldErrors.confirmPassword && <div style={s.fieldError}>{fieldErrors.confirmPassword}</div>}
          </div>
          {error && <div style={s.error}>{error}</div>}
          <button type="submit" style={{ ...s.submitBtn, opacity: loading ? 0.7 : 1 }} disabled={loading}>
            <Lock size={18} /> {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
