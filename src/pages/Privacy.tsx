import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useTheme } from '../theme/ThemeContext'
import type { CSSProperties } from 'react'

export default function Privacy() {
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
        <h1 style={s.title as CSSProperties}>Privacy Policy</h1>
        <p style={s.updated as CSSProperties}>Last updated: 1 April 2026</p>

        <p style={s.text}>
          Varda ("we", "us", "our") is a UK-based SaaS product. We are committed to protecting your personal data and your privacy. This policy explains what data we collect, how we use it, and your rights under the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.
        </p>

        <div style={s.section}>
          <h2 style={s.sectionTitle}>1. What Data We Collect</h2>
          <p style={s.text}>We collect the following categories of personal data:</p>
          <ul style={s.list}>
            <li style={s.listItem}><strong style={{ color: C.white }}>Account information:</strong> name, email address, and password (hashed)</li>
            <li style={s.listItem}><strong style={{ color: C.white }}>Business information:</strong> business name, address, phone number, logo, and trade details</li>
            <li style={s.listItem}><strong style={{ color: C.white }}>Customer data:</strong> names, addresses, emails, and phone numbers of your customers that you enter into the platform</li>
            <li style={s.listItem}><strong style={{ color: C.white }}>Financial data:</strong> quotes, invoices, expenses, and pricing information you create within the platform</li>
            <li style={s.listItem}><strong style={{ color: C.white }}>Usage data:</strong> how you interact with the platform, feature usage, and session information</li>
            <li style={s.listItem}><strong style={{ color: C.white }}>Payment data:</strong> billing information processed by Stripe (we do not store card details)</li>
          </ul>
        </div>

        <div style={s.section}>
          <h2 style={s.sectionTitle}>2. How We Use Your Data</h2>
          <p style={s.text}>We use your data to:</p>
          <ul style={s.list}>
            <li style={s.listItem}>Provide and maintain the Varda platform and its features</li>
            <li style={s.listItem}>Process your subscription payments</li>
            <li style={s.listItem}>Send service-related communications (account verification, billing, updates)</li>
            <li style={s.listItem}>Improve the platform based on aggregated usage patterns</li>
            <li style={s.listItem}>Provide customer support</li>
            <li style={s.listItem}>Comply with legal obligations</li>
          </ul>
        </div>

        <div style={s.section}>
          <h2 style={s.sectionTitle}>3. Legal Basis for Processing (GDPR)</h2>
          <p style={s.text}>We process your data under the following legal bases:</p>
          <ul style={s.list}>
            <li style={s.listItem}><strong style={{ color: C.white }}>Contract:</strong> processing necessary to provide the service you have subscribed to</li>
            <li style={s.listItem}><strong style={{ color: C.white }}>Legitimate interest:</strong> improving our platform, preventing fraud, and ensuring security</li>
            <li style={s.listItem}><strong style={{ color: C.white }}>Legal obligation:</strong> complying with UK tax, accounting, and regulatory requirements</li>
            <li style={s.listItem}><strong style={{ color: C.white }}>Consent:</strong> where you have given explicit consent, such as for marketing communications</li>
          </ul>
        </div>

        <div style={s.section}>
          <h2 style={s.sectionTitle}>4. Data Storage</h2>
          <p style={s.text}>
            Your data is stored securely using Supabase, which provides hosted PostgreSQL databases with row-level security, encrypted connections, and regular backups. Data is stored in data centres within the European Economic Area (EEA). All data is encrypted in transit (TLS) and at rest.
          </p>
        </div>

        <div style={s.section}>
          <h2 style={s.sectionTitle}>5. Third-Party Services</h2>
          <p style={s.text}>We use the following third-party services to operate Varda:</p>
          <ul style={s.list}>
            <li style={s.listItem}><strong style={{ color: C.white }}>Supabase:</strong> database hosting, authentication, and file storage. Supabase processes data in accordance with GDPR requirements.</li>
            <li style={s.listItem}><strong style={{ color: C.white }}>Stripe:</strong> payment processing. Stripe is PCI-DSS compliant and handles all card data directly. We never see or store your full card number.</li>
          </ul>
          <p style={s.text}>
            We do not sell your data to third parties. We do not share your data with third parties for marketing purposes.
          </p>
        </div>

        <div style={s.section}>
          <h2 style={s.sectionTitle}>6. Data Retention</h2>
          <p style={s.text}>
            We retain your data for as long as your account is active. If you cancel your subscription, your data remains accessible for 30 days. After that period, your data will be permanently deleted unless retention is required by law (e.g., financial records may be retained for up to 7 years for HMRC compliance).
          </p>
        </div>

        <div style={s.section}>
          <h2 style={s.sectionTitle}>7. Your Rights</h2>
          <p style={s.text}>Under the UK GDPR, you have the following rights:</p>
          <ul style={s.list}>
            <li style={s.listItem}><strong style={{ color: C.white }}>Right of access:</strong> request a copy of the personal data we hold about you</li>
            <li style={s.listItem}><strong style={{ color: C.white }}>Right to rectification:</strong> request correction of inaccurate data</li>
            <li style={s.listItem}><strong style={{ color: C.white }}>Right to erasure:</strong> request deletion of your data ("right to be forgotten")</li>
            <li style={s.listItem}><strong style={{ color: C.white }}>Right to data portability:</strong> receive your data in a structured, machine-readable format</li>
            <li style={s.listItem}><strong style={{ color: C.white }}>Right to restrict processing:</strong> request that we limit how we use your data</li>
            <li style={s.listItem}><strong style={{ color: C.white }}>Right to object:</strong> object to processing based on legitimate interest</li>
          </ul>
          <p style={s.text}>
            To exercise any of these rights, contact us at{' '}
            <a href="mailto:hello@varda.app" style={{ color: C.gold, textDecoration: 'underline' }}>hello@varda.app</a>.
            We will respond within 30 days.
          </p>
        </div>

        <div style={s.section}>
          <h2 style={s.sectionTitle}>8. Cookies</h2>
          <p style={s.text}>
            Varda uses only essential cookies required for authentication and session management. We do not use tracking cookies, advertising cookies, or third-party analytics cookies. No cookie consent banner is required as we only use strictly necessary cookies.
          </p>
        </div>

        <div style={s.section}>
          <h2 style={s.sectionTitle}>9. Changes to This Policy</h2>
          <p style={s.text}>
            We may update this privacy policy from time to time. Material changes will be communicated via email or in-app notification at least 14 days before they take effect. The "last updated" date at the top of this page indicates the most recent revision.
          </p>
        </div>

        <div style={s.section}>
          <h2 style={s.sectionTitle}>10. Contact</h2>
          <p style={s.text}>
            If you have any questions about this privacy policy or how we handle your data, please contact us at{' '}
            <a href="mailto:hello@varda.app" style={{ color: C.gold, textDecoration: 'underline' }}>hello@varda.app</a>.
          </p>
          <p style={s.text}>
            You also have the right to lodge a complaint with the Information Commissioner's Office (ICO) at{' '}
            <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" style={{ color: C.gold, textDecoration: 'underline' }}>ico.org.uk</a>.
          </p>
        </div>

        <div style={{ borderTop: `1px solid ${C.steel}33`, paddingTop: 24, marginTop: 16, textAlign: 'center' } as CSSProperties}>
          <p style={{ fontSize: 13, color: C.steel }}>&copy; 2026 Varda. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}
