import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useTheme } from '../theme/ThemeContext'
import type { CSSProperties } from 'react'

export default function Terms() {
  const { C } = useTheme()

  const s: Record<string, CSSProperties> = {
    page: {
      minHeight: '100dvh',
      background: C.black,
      padding: '48px 24px',
    },
    container: {
      maxWidth: 760,
      margin: '0 auto',
    },
    brand: {
      fontFamily: "'Cinzel', serif",
      fontSize: 28,
      fontWeight: 700,
      color: C.gold,
      textAlign: 'center',
      marginBottom: 8,
    },
    title: {
      fontSize: 24,
      fontWeight: 600,
      color: C.white,
      textAlign: 'center',
      marginBottom: 8,
    },
    updated: {
      fontSize: 13,
      color: C.steel,
      textAlign: 'center',
      marginBottom: 40,
    },
    backLink: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      color: C.gold,
      textDecoration: 'none',
      fontSize: 14,
      fontWeight: 500,
      marginBottom: 32,
    },
    section: {
      marginBottom: 32,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 600,
      color: C.white,
      marginBottom: 12,
    },
    text: {
      fontSize: 14,
      lineHeight: 1.7,
      color: C.silver,
      marginBottom: 12,
    },
    list: {
      paddingLeft: 20,
      margin: '8px 0 12px',
    },
    listItem: {
      fontSize: 14,
      lineHeight: 1.7,
      color: C.silver,
      marginBottom: 4,
    },
  }

  return (
    <div style={s.page}>
      <div style={s.container}>
        <Link to="/login" style={s.backLink}>
          <ArrowLeft size={16} /> Back
        </Link>

        <div style={s.brand as CSSProperties}>Varda</div>
        <h1 style={s.title as CSSProperties}>Terms of Service</h1>
        <p style={s.updated as CSSProperties}>Last updated: 1 April 2026</p>

        <div style={s.section}>
          <h2 style={s.sectionTitle}>1. Service Description</h2>
          <p style={s.text}>
            Varda is a cloud-based business management platform designed for tradespeople and small service businesses. The platform provides tools for quoting, job management, invoicing, scheduling, expense tracking, and business insights. Varda is operated as a software-as-a-service (SaaS) product and is provided on a subscription basis.
          </p>
        </div>

        <div style={s.section}>
          <h2 style={s.sectionTitle}>2. Account Terms</h2>
          <p style={s.text}>
            You must provide a valid email address and accurate information when creating an account. You are responsible for maintaining the security of your account credentials. You must be at least 18 years old to use this service. Each business account is managed by an owner who may invite additional team members. You are responsible for all activity that occurs under your account.
          </p>
        </div>

        <div style={s.section}>
          <h2 style={s.sectionTitle}>3. Payment Terms</h2>
          <p style={s.text}>
            Varda offers tiered subscription plans billed monthly or annually. Payments are processed securely via Stripe. All prices are displayed in GBP and are exclusive of VAT where applicable. Subscriptions renew automatically unless cancelled before the renewal date. Refunds are handled on a case-by-case basis in accordance with UK consumer law.
          </p>
        </div>

        <div style={s.section}>
          <h2 style={s.sectionTitle}>4. Acceptable Use</h2>
          <p style={s.text}>You agree not to:</p>
          <ul style={s.list}>
            <li style={s.listItem}>Use the service for any unlawful purpose or in violation of any applicable laws</li>
            <li style={s.listItem}>Attempt to gain unauthorised access to other accounts or systems</li>
            <li style={s.listItem}>Transmit malicious code, viruses, or any harmful content</li>
            <li style={s.listItem}>Resell, sublicense, or redistribute access to the platform without written consent</li>
            <li style={s.listItem}>Use the platform in a way that could damage, disable, or impair the service</li>
          </ul>
        </div>

        <div style={s.section}>
          <h2 style={s.sectionTitle}>5. Data & Privacy</h2>
          <p style={s.text}>
            Your data is stored securely using Supabase infrastructure. We take data protection seriously and comply with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018. For full details on how we handle your data, please refer to our{' '}
            <Link to="/privacy" style={{ color: C.gold, textDecoration: 'underline' }}>Privacy Policy</Link>.
          </p>
        </div>

        <div style={s.section}>
          <h2 style={s.sectionTitle}>6. Intellectual Property</h2>
          <p style={s.text}>
            The Varda platform, including its design, code, branding, and documentation, is the intellectual property of Varda. You retain full ownership of any business data you enter into the platform. By using Varda, you grant us a limited licence to process your data solely for the purpose of providing the service.
          </p>
        </div>

        <div style={s.section}>
          <h2 style={s.sectionTitle}>7. Limitation of Liability</h2>
          <p style={s.text}>
            Varda is provided "as is" without warranties of any kind, whether express or implied. To the maximum extent permitted by law, Varda shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or business opportunities. Our total liability in any matter arising out of or relating to these terms is limited to the amount you paid for the service in the 12 months preceding the claim.
          </p>
        </div>

        <div style={s.section}>
          <h2 style={s.sectionTitle}>8. Termination</h2>
          <p style={s.text}>
            You may cancel your subscription at any time from your account settings. Upon cancellation, your account will remain active until the end of the current billing period. We reserve the right to suspend or terminate accounts that violate these terms. Upon termination, you may request an export of your data within 30 days, after which it may be permanently deleted.
          </p>
        </div>

        <div style={s.section}>
          <h2 style={s.sectionTitle}>9. Changes to Terms</h2>
          <p style={s.text}>
            We may update these terms from time to time. Material changes will be communicated via email or an in-app notification at least 14 days before they take effect. Continued use of the service after changes take effect constitutes acceptance of the updated terms.
          </p>
        </div>

        <div style={s.section}>
          <h2 style={s.sectionTitle}>10. Contact</h2>
          <p style={s.text}>
            If you have any questions about these terms, please contact us at{' '}
            <a href="mailto:hello@varda.app" style={{ color: C.gold, textDecoration: 'underline' }}>hello@varda.app</a>.
          </p>
        </div>

        <div style={{ borderTop: `1px solid ${C.steel}33`, paddingTop: 24, marginTop: 16, textAlign: 'center' } as CSSProperties}>
          <p style={{ fontSize: 13, color: C.steel }}>&copy; 2026 Varda. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}
