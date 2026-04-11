import { Link } from 'react-router-dom'
import { ArrowLeft, Share, PlusSquare, Monitor, Smartphone, Tablet, Globe, MoreVertical, Download } from 'lucide-react'
import { useTheme } from '../theme/ThemeContext'
import type { CSSProperties } from 'react'

export default function Install() {
  const { C } = useTheme()

  const s: Record<string, CSSProperties> = {
    page: {
      minHeight: '100dvh',
      background: C.black,
      padding: '48px 24px',
    },
    container: {
      maxWidth: 680,
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
    subtitle: {
      fontSize: 15,
      color: C.silver,
      textAlign: 'center',
      marginBottom: 40,
      lineHeight: 1.6,
    },
    section: {
      background: C.charcoalLight,
      borderRadius: 16,
      padding: '28px 24px',
      marginBottom: 20,
      border: `1px solid ${C.steel}22`,
    },
    sectionHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 20,
    },
    iconBadge: {
      width: 44,
      height: 44,
      borderRadius: 12,
      background: `${C.gold}1A`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 600,
      color: C.white,
    },
    sectionSub: {
      fontSize: 13,
      color: C.silver,
    },
    step: {
      display: 'flex',
      gap: 14,
      marginBottom: 16,
    },
    stepNum: {
      width: 28,
      height: 28,
      borderRadius: '50%',
      background: C.gold,
      color: C.black,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 14,
      fontWeight: 700,
      flexShrink: 0,
      marginTop: 2,
    },
    stepContent: {
      flex: 1,
    },
    stepTitle: {
      fontSize: 15,
      fontWeight: 600,
      color: C.white,
      marginBottom: 4,
    },
    stepDesc: {
      fontSize: 13,
      color: C.silver,
      lineHeight: 1.6,
    },
    inlineIcon: {
      display: 'inline-flex',
      verticalAlign: 'middle',
      margin: '0 2px',
    },
    tip: {
      background: `${C.gold}0D`,
      border: `1px solid ${C.gold}22`,
      borderRadius: 10,
      padding: '12px 16px',
      fontSize: 13,
      color: C.silver,
      lineHeight: 1.6,
      marginTop: 16,
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
    footer: {
      textAlign: 'center',
      marginTop: 40,
      fontSize: 13,
      color: C.steel,
      lineHeight: 1.6,
    },
  }

  return (
    <div style={s.page}>
      <div style={s.container}>
        <Link to="/landing" style={s.backLink}>
          <ArrowLeft size={16} /> Back
        </Link>

        <div style={s.brand as CSSProperties}>Varda</div>
        <div style={s.title as CSSProperties}>Install the App</div>
        <div style={s.subtitle as CSSProperties}>
          Varda works as a full app on your phone, tablet, or computer — no app store needed. Follow the steps for your device below.
        </div>

        {/* iPhone / iPad */}
        <div style={s.section}>
          <div style={s.sectionHeader}>
            <div style={s.iconBadge}>
              <Smartphone size={22} color={C.gold} />
            </div>
            <div>
              <div style={s.sectionTitle}>iPhone & iPad</div>
              <div style={s.sectionSub}>Safari required</div>
            </div>
          </div>

          <div style={s.step}>
            <div style={s.stepNum}>1</div>
            <div style={s.stepContent}>
              <div style={s.stepTitle}>Open in Safari</div>
              <div style={s.stepDesc}>
                Go to <strong style={{ color: C.gold }}>vardaapp.com</strong> in Safari. This won't work from Chrome or other browsers on iOS.
              </div>
            </div>
          </div>

          <div style={s.step}>
            <div style={s.stepNum}>2</div>
            <div style={s.stepContent}>
              <div style={s.stepTitle}>Tap the Share button</div>
              <div style={s.stepDesc}>
                Tap the <span style={s.inlineIcon}><Share size={14} color={C.gold} /></span> share icon at the bottom of Safari (the square with an arrow pointing up).
              </div>
            </div>
          </div>

          <div style={s.step}>
            <div style={s.stepNum}>3</div>
            <div style={s.stepContent}>
              <div style={s.stepTitle}>Add to Home Screen</div>
              <div style={s.stepDesc}>
                Scroll down and tap <strong style={{ color: C.white }}>"Add to Home Screen"</strong> <span style={s.inlineIcon}><PlusSquare size={14} color={C.gold} /></span>. Then tap <strong style={{ color: C.white }}>"Add"</strong> in the top right.
              </div>
            </div>
          </div>

          <div style={s.step}>
            <div style={s.stepNum}>4</div>
            <div style={s.stepContent}>
              <div style={s.stepTitle}>Open from Home Screen</div>
              <div style={s.stepDesc}>
                The Varda icon will appear on your home screen. Tap it to open the app in full screen — no browser bars, just the app.
              </div>
            </div>
          </div>

          <div style={s.tip}>
            <strong style={{ color: C.gold }}>Tip:</strong> Once installed, Varda will receive push notifications for schedule reminders, overdue invoices, and quote updates.
          </div>
        </div>

        {/* Android */}
        <div style={s.section}>
          <div style={s.sectionHeader}>
            <div style={s.iconBadge}>
              <Tablet size={22} color={C.gold} />
            </div>
            <div>
              <div style={s.sectionTitle}>Android</div>
              <div style={s.sectionSub}>Chrome or Edge</div>
            </div>
          </div>

          <div style={s.step}>
            <div style={s.stepNum}>1</div>
            <div style={s.stepContent}>
              <div style={s.stepTitle}>Open in Chrome</div>
              <div style={s.stepDesc}>
                Go to <strong style={{ color: C.gold }}>vardaapp.com</strong> in Chrome.
              </div>
            </div>
          </div>

          <div style={s.step}>
            <div style={s.stepNum}>2</div>
            <div style={s.stepContent}>
              <div style={s.stepTitle}>Tap the menu</div>
              <div style={s.stepDesc}>
                Tap the <span style={s.inlineIcon}><MoreVertical size={14} color={C.gold} /></span> three-dot menu in the top right corner.
              </div>
            </div>
          </div>

          <div style={s.step}>
            <div style={s.stepNum}>3</div>
            <div style={s.stepContent}>
              <div style={s.stepTitle}>Install app</div>
              <div style={s.stepDesc}>
                Tap <strong style={{ color: C.white }}>"Install app"</strong> or <strong style={{ color: C.white }}>"Add to Home screen"</strong>. Confirm when prompted.
              </div>
            </div>
          </div>
        </div>

        {/* Desktop */}
        <div style={s.section}>
          <div style={s.sectionHeader}>
            <div style={s.iconBadge}>
              <Monitor size={22} color={C.gold} />
            </div>
            <div>
              <div style={s.sectionTitle}>Desktop</div>
              <div style={s.sectionSub}>Chrome, Edge, or Brave</div>
            </div>
          </div>

          <div style={s.step}>
            <div style={s.stepNum}>1</div>
            <div style={s.stepContent}>
              <div style={s.stepTitle}>Visit vardaapp.com</div>
              <div style={s.stepDesc}>
                Open <strong style={{ color: C.gold }}>vardaapp.com</strong> in your browser and log in.
              </div>
            </div>
          </div>

          <div style={s.step}>
            <div style={s.stepNum}>2</div>
            <div style={s.stepContent}>
              <div style={s.stepTitle}>Click Install</div>
              <div style={s.stepDesc}>
                Look for the <span style={s.inlineIcon}><Download size={14} color={C.gold} /></span> install icon in the address bar (right side), or go to the browser menu and select <strong style={{ color: C.white }}>"Install Varda"</strong>.
              </div>
            </div>
          </div>

          <div style={s.step}>
            <div style={s.stepNum}>3</div>
            <div style={s.stepContent}>
              <div style={s.stepTitle}>Launch from desktop</div>
              <div style={s.stepDesc}>
                Varda will open in its own window — no tabs, no address bar. You'll find it in your Start menu (Windows) or Applications folder (Mac).
              </div>
            </div>
          </div>
        </div>

        <div style={s.footer as CSSProperties}>
          Already installed? Just open Varda from your home screen or desktop.<br />
          Need help? Contact <strong style={{ color: C.gold }}>support@vardaapp.com</strong>
        </div>
      </div>
    </div>
  )
}
