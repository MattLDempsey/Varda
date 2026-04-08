/* ──────────────────────────────────────────────────────
   Reusable form-validation helpers
   Returns null when valid, or an error message string.
   ────────────────────────────────────────────────────── */

export function validateEmail(email: string): string | null {
  if (!email) return null // empty is allowed — use validateRequired separately if needed
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email) ? null : 'Please enter a valid email address'
}

export function validatePhone(phone: string): string | null {
  if (!phone) return null
  // Accept UK-style numbers: optional +44, then digits/spaces/dashes, 10-13 digits total
  const digits = phone.replace(/[\s\-()]+/g, '')
  const re = /^(\+44|0)\d{9,11}$/
  return re.test(digits) ? null : 'Please enter a valid UK phone number'
}

export function validateRequired(value: string, fieldName: string): string | null {
  return value.trim() ? null : `${fieldName} is required`
}

export function validateMinLength(value: string, min: number, fieldName: string): string | null {
  if (!value) return null
  return value.length >= min ? null : `${fieldName} must be at least ${min} characters`
}

export function validatePostcode(postcode: string): string | null {
  if (!postcode) return null
  // UK postcode regex — liberal but catches obvious garbage
  const re = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i
  return re.test(postcode.trim()) ? null : 'Please enter a valid UK postcode'
}
