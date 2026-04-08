import { Link } from 'react-router-dom'
import { useState } from 'react'
import { Zap, Briefcase, Calendar, Receipt, BarChart3, Wallet, Check, Crown, ArrowRight, Star } from 'lucide-react'
import { useTheme } from '../theme/ThemeContext'
import type { CSSProperties } from 'react'

/* ── feature data ── */
const features = [
  { icon: Zap, title: 'Quick Quote', desc: 'Generate professional quotes in seconds with smart pricing rules and templates.' },
  { icon: Briefcase, title: 'Job Management', desc: 'Track every job from enquiry to completion with kanban boards and status tracking.' },
  { icon: Calendar, title: 'Calendar', desc: 'Schedule jobs, set reminders, and manage your week at a glance.' },
  { icon: Receipt, title: 'Invoicing', desc: 'Convert quotes to invoices instantly. Send professional PDFs to customers.' },
  { icon: BarChart3, title: 'Insights', desc: 'Understand your revenue, margins, and business performance with clear dashboards.' },
  { icon: Wallet, title: 'Expenses', desc: 'Log expenses, snap receipts, and keep your books tidy for tax time.' },
]

/* ── steps data ── */
const steps = [
  { num: '1', title: 'Sign Up', desc: 'Create your account in under a minute. No card required to start.' },
  { num: '2', title: 'Set Up Your Business', desc: 'Add your business details, logo, and pricing rules through guided onboarding.' },
  { num: '3', title: 'Start Quoting', desc: 'Send your first quote the same day. Win work and get paid faster.' },
]

/* ── plan data ── */
interface PlanTier {
  name: string
  monthlyPrice: number
  annualPrice: number
  users: string
  features: string[]
  popular?: boolean
}

const plans: PlanTier[] = [
  {
    name: 'Starter',
    monthlyPrice: 19,
    annualPrice: 15,
    users: '1 user',
    features: [
      '20 active jobs, 50 customers',
      'Quick Quote (single line)',
      'Jobs kanban & table',
      'Basic calendar (week view)',
      'PDF quotes',
    ],
  },
  {
    name: 'Pro',
    monthlyPrice: 49,
    annualPrice: 39,
    users: '3 users',
    popular: true,
    features: [
      'Unlimited jobs & customers',
      'Multi-line quotes',
      'Full calendar',
      'Invoicing & expenses',
      'Communications',
      'Basic insights',
      'Customer quote page',
      'Pricing rules',
      'PDF invoices',
    ],
  },
  {
    name: 'Business',
    monthlyPrice: 99,
    annualPrice: 79,
    users: 'Unlimited users',
    features: [
      'Everything in Pro',
      'Advanced insights (forecast, margins, tax)',
      'Team management',
      'CSV export',
      'Priority support',
    ],
  },
]

/* ── testimonial placeholders ── */
const testimonials = [
  { name: 'James T.', trade: 'Electrician, Manchester', text: 'Varda has completely changed how I run my business. Quoting takes seconds instead of hours.' },
  { name: 'Sarah K.', trade: 'Plumber, Bristol', text: 'The job tracking and invoicing alone saved me a full day every week. Brilliant tool.' },
  { name: 'Dan M.', trade: 'Joiner, Edinburgh', text: 'Finally, software built for people like me. Simple, fast, and it just works.' },
]

export default function Landing() {
  const { C } = useTheme()
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual')

  const s: Record<string, CSSProperties> = {
    page: {
      minHeight: '100dvh',
      background: C.black,
      color: C.silver,
      fontFamily: "'Inter', system-ui, sans-serif",
    },
    /* nav */
    nav: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '20px 24px',
      maxWidth: 1200,
      margin: '0 auto',
    },
    navBrand: {
      fontFamily: "'Cinzel', serif",
      fontSize: 24,
      fontWeight: 700,
      color: C.gold,
      textDecoration: 'none',
    },
    navLinks: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
    },
    navLink: {
      color: C.silver,
      textDecoration: 'none',
      fontSize: 14,
      fontWeight: 500,
    },
    navSignIn: {
      color: C.gold,
      textDecoration: 'none',
      fontSize: 14,
      fontWeight: 600,
    },
    /* hero */
    hero: {
      textAlign: 'center',
      padding: '80px 24px 64px',
      maxWidth: 800,
      margin: '0 auto',
    },
    heroTitle: {
      fontSize: 'clamp(32px, 5vw, 52px)',
      fontWeight: 800,
      color: C.white,
      lineHeight: 1.15,
      marginBottom: 20,
    },
    heroGold: {
      color: C.gold,
    },
    heroSub: {
      fontSize: 18,
      color: C.silver,
      lineHeight: 1.6,
      marginBottom: 36,
      maxWidth: 560,
      margin: '0 auto 36px',
    },
    heroBtns: {
      display: 'flex',
      justifyContent: 'center',
      gap: 16,
      flexWrap: 'wrap',
    },
    btnPrimary: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      background: C.gold,
      color: C.black,
      border: 'none',
      borderRadius: 12,
      padding: '16px 32px',
      fontSize: 16,
      fontWeight: 700,
      cursor: 'pointer',
      textDecoration: 'none',
    },
    btnSecondary: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      background: 'transparent',
      color: C.silver,
      border: `1px solid ${C.steel}`,
      borderRadius: 12,
      padding: '16px 32px',
      fontSize: 16,
      fontWeight: 600,
      cursor: 'pointer',
      textDecoration: 'none',
    },
    /* section */
    sectionWrap: {
      padding: '80px 24px',
      maxWidth: 1100,
      margin: '0 auto',
    },
    sectionTitle: {
      fontSize: 28,
      fontWeight: 700,
      color: C.white,
      textAlign: 'center',
      marginBottom: 8,
    },
    sectionSub: {
      fontSize: 15,
      color: C.silver,
      textAlign: 'center',
      marginBottom: 48,
    },
    /* features grid */
    featuresGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: 24,
    },
    featureCard: {
      background: C.charcoalLight,
      borderRadius: 16,
      padding: '28px 24px',
      border: `1px solid ${C.steel}33`,
    },
    featureIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      background: `${C.gold}18`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    featureTitle: {
      fontSize: 17,
      fontWeight: 600,
      color: C.white,
      marginBottom: 8,
    },
    featureDesc: {
      fontSize: 14,
      lineHeight: 1.6,
      color: C.silver,
    },
    /* steps */
    stepsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
      gap: 32,
    },
    stepCard: {
      textAlign: 'center',
      padding: '24px',
    },
    stepNum: {
      width: 48,
      height: 48,
      borderRadius: '50%',
      background: C.gold,
      color: C.black,
      fontSize: 20,
      fontWeight: 800,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto 16px',
    },
    stepTitle: {
      fontSize: 18,
      fontWeight: 600,
      color: C.white,
      marginBottom: 8,
    },
    stepDesc: {
      fontSize: 14,
      lineHeight: 1.6,
      color: C.silver,
    },
    /* pricing */
    toggleWrap: {
      display: 'flex',
      justifyContent: 'center',
      marginBottom: 36,
    },
    toggleContainer: {
      display: 'flex',
      background: C.charcoal,
      borderRadius: 10,
      padding: 4,
      gap: 4,
    },
    toggleBtn: {
      padding: '10px 24px',
      border: 'none',
      borderRadius: 8,
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 600,
      transition: 'all .15s',
      minHeight: 40,
    },
    saveBadge: {
      fontSize: 11,
      fontWeight: 700,
      color: C.green,
      marginLeft: 6,
    },
    pricingGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: 20,
      alignItems: 'start',
    },
    planCard: {
      background: C.charcoalLight,
      borderRadius: 16,
      padding: '28px 24px',
      border: `1px solid ${C.steel}44`,
      position: 'relative',
    },
    planCardPopular: {
      background: C.charcoalLight,
      borderRadius: 16,
      padding: '28px 24px',
      border: `2px solid ${C.gold}`,
      position: 'relative',
      boxShadow: `0 8px 32px ${C.gold}22`,
    },
    popularBadge: {
      position: 'absolute',
      top: -12,
      left: '50%',
      transform: 'translateX(-50%)',
      background: C.gold,
      color: C.black,
      fontSize: 11,
      fontWeight: 700,
      padding: '4px 16px',
      borderRadius: 20,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      whiteSpace: 'nowrap',
    },
    planName: { fontSize: 20, fontWeight: 700, color: C.white, marginBottom: 4 },
    planUsers: { fontSize: 13, color: C.silver, marginBottom: 16 },
    priceRow: { display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 },
    price: { fontSize: 40, fontWeight: 800, color: C.white, lineHeight: 1 },
    priceUnit: { fontSize: 14, color: C.silver, fontWeight: 500 },
    billedNote: { fontSize: 12, color: C.steel, marginBottom: 24 },
    featureList: { listStyle: 'none', padding: 0, margin: '0 0 24px 0' },
    featureItem: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0', fontSize: 13, color: C.silver, lineHeight: 1.4 },
    checkIcon: { flexShrink: 0, marginTop: 1 },
    planBtn: {
      width: '100%',
      padding: '12px 0',
      border: 'none',
      borderRadius: 10,
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer',
      background: C.gold,
      color: C.black,
      textDecoration: 'none',
      display: 'block',
      textAlign: 'center',
      minHeight: 44,
    },
    /* testimonials */
    testimonialGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: 24,
    },
    testimonialCard: {
      background: C.charcoalLight,
      borderRadius: 16,
      padding: '28px 24px',
      border: `1px solid ${C.steel}33`,
    },
    stars: {
      display: 'flex',
      gap: 4,
      marginBottom: 12,
    },
    testimonialText: {
      fontSize: 14,
      lineHeight: 1.6,
      color: C.silver,
      marginBottom: 16,
      fontStyle: 'italic',
    },
    testimonialAuthor: {
      fontSize: 14,
      fontWeight: 600,
      color: C.white,
    },
    testimonialTrade: {
      fontSize: 12,
      color: C.steel,
    },
    /* cta */
    cta: {
      textAlign: 'center',
      padding: '80px 24px',
      background: C.charcoal,
    },
    ctaTitle: {
      fontSize: 28,
      fontWeight: 700,
      color: C.white,
      marginBottom: 12,
    },
    ctaSub: {
      fontSize: 16,
      color: C.silver,
      marginBottom: 32,
    },
    /* footer */
    footer: {
      padding: '32px 24px',
      borderTop: `1px solid ${C.steel}33`,
      textAlign: 'center',
    },
    footerLinks: {
      display: 'flex',
      justifyContent: 'center',
      gap: 24,
      marginBottom: 16,
      flexWrap: 'wrap',
    },
    footerLink: {
      color: C.steel,
      textDecoration: 'none',
      fontSize: 13,
    },
    footerCopy: {
      fontSize: 13,
      color: C.steel,
    },
  }

  return (
    <div style={s.page}>
      {/* ── Nav ── */}
      <nav style={s.nav}>
        <span style={s.navBrand}>Varda</span>
        <div style={s.navLinks}>
          <a href="#features" style={s.navLink}>Features</a>
          <a href="#pricing" style={s.navLink}>Pricing</a>
          <Link to="/login" style={s.navSignIn}>Sign In</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={s.hero as CSSProperties}>
        <h1 style={s.heroTitle as CSSProperties}>
          Business management{' '}
          <span style={s.heroGold}>built for tradespeople</span>
        </h1>
        <p style={s.heroSub}>
          Quote, schedule, invoice, and grow your trade business — all from one simple platform. Built by tradespeople, for tradespeople.
        </p>
        <div style={s.heroBtns as CSSProperties}>
          <Link to="/login?register=true" style={s.btnPrimary}>
            Start Free Trial <ArrowRight size={18} />
          </Link>
          <Link to="/login" style={s.btnSecondary}>
            Sign In
          </Link>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={s.sectionWrap}>
        <h2 style={s.sectionTitle as CSSProperties}>Everything you need to run your business</h2>
        <p style={s.sectionSub as CSSProperties}>Powerful tools designed to save you time and win more work.</p>
        <div style={s.featuresGrid}>
          {features.map((f) => (
            <div key={f.title} style={s.featureCard}>
              <div style={s.featureIcon}>
                <f.icon size={22} color={C.gold} />
              </div>
              <div style={s.featureTitle}>{f.title}</div>
              <div style={s.featureDesc}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ ...s.sectionWrap, background: C.charcoal, maxWidth: 'none', padding: '80px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={s.sectionTitle as CSSProperties}>Get started in three simple steps</h2>
          <p style={s.sectionSub as CSSProperties}>Up and running in minutes, not days.</p>
          <div style={s.stepsGrid}>
            {steps.map((step) => (
              <div key={step.num} style={s.stepCard as CSSProperties}>
                <div style={s.stepNum}>{step.num}</div>
                <div style={s.stepTitle}>{step.title}</div>
                <div style={s.stepDesc}>{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" style={s.sectionWrap}>
        <h2 style={s.sectionTitle as CSSProperties}>Simple, transparent pricing</h2>
        <p style={s.sectionSub as CSSProperties}>No hidden fees. Cancel any time.</p>

        <div style={s.toggleWrap}>
          <div style={s.toggleContainer}>
            <button
              style={{
                ...s.toggleBtn,
                background: billing === 'monthly' ? C.charcoalLight : 'transparent',
                color: billing === 'monthly' ? C.white : C.steel,
              }}
              onClick={() => setBilling('monthly')}
            >
              Monthly
            </button>
            <button
              style={{
                ...s.toggleBtn,
                background: billing === 'annual' ? C.charcoalLight : 'transparent',
                color: billing === 'annual' ? C.white : C.steel,
              }}
              onClick={() => setBilling('annual')}
            >
              Annual
              <span style={s.saveBadge}>Save 20%</span>
            </button>
          </div>
        </div>

        <div style={s.pricingGrid}>
          {plans.map((plan) => {
            const isPopular = !!plan.popular
            const price = billing === 'annual' ? plan.annualPrice : plan.monthlyPrice
            return (
              <div key={plan.name} style={isPopular ? s.planCardPopular : s.planCard}>
                {isPopular && (
                  <div style={s.popularBadge as CSSProperties}>
                    <Crown size={12} /> Most Popular
                  </div>
                )}
                <div style={s.planName}>{plan.name}</div>
                <div style={s.planUsers}>{plan.users}</div>
                <div style={s.priceRow}>
                  <span style={s.price}>{'\u00A3'}{price}</span>
                  <span style={s.priceUnit}>/mo</span>
                </div>
                <div style={s.billedNote}>
                  {billing === 'annual' ? `Billed \u00A3${price * 12}/year` : 'Billed monthly'}
                </div>
                <ul style={s.featureList}>
                  {plan.features.map((feat, i) => (
                    <li key={i} style={s.featureItem}>
                      <Check size={16} color={C.green} style={s.checkIcon} />
                      {feat}
                    </li>
                  ))}
                </ul>
                <Link to="/login?register=true" style={s.planBtn as CSSProperties}>
                  Start Free Trial
                </Link>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section style={{ ...s.sectionWrap, background: C.charcoal, maxWidth: 'none', padding: '80px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={s.sectionTitle as CSSProperties}>Trusted by tradespeople across the UK</h2>
          <p style={s.sectionSub as CSSProperties}>Join hundreds of businesses already using Varda.</p>
          <div style={s.testimonialGrid}>
            {testimonials.map((t) => (
              <div key={t.name} style={s.testimonialCard}>
                <div style={s.stars}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} size={16} color={C.gold} fill={C.gold} />
                  ))}
                </div>
                <p style={s.testimonialText as CSSProperties}>"{t.text}"</p>
                <div style={s.testimonialAuthor}>{t.name}</div>
                <div style={s.testimonialTrade}>{t.trade}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={s.cta as CSSProperties}>
        <h2 style={s.ctaTitle}>Ready to streamline your business?</h2>
        <p style={s.ctaSub}>Start your free trial today. No credit card required.</p>
        <Link to="/login?register=true" style={s.btnPrimary}>
          Start Free Trial <ArrowRight size={18} />
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer style={s.footer as CSSProperties}>
        <div style={s.footerLinks as CSSProperties}>
          <Link to="/terms" style={s.footerLink}>Terms of Service</Link>
          <Link to="/privacy" style={s.footerLink}>Privacy Policy</Link>
          <Link to="/login" style={s.footerLink}>Sign In</Link>
        </div>
        <p style={s.footerCopy}>&copy; 2026 Varda. All rights reserved.</p>
      </footer>
    </div>
  )
}
