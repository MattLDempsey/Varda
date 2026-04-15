import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { copyToClipboard } from '../../lib/clipboard'
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  Calendar,
  Users,

  BarChart3,
  Tags,
  Settings,
  Moon,
  Sun,
  X,
  LogOut,
  Crown,
  Receipt,
  Building2,
  UserPlus,
  Trash2,
  Clock,
  Mail,
  Copy,
  Check,
  Search,
  MoreHorizontal,
  Plug,
  CreditCard,
  User,
  Pencil,
} from 'lucide-react'
import { useState, useEffect, useCallback, Fragment } from 'react'
import { useTheme } from '../../theme/ThemeContext'
import { useAuth } from '../../auth/AuthContext'
import { useSubscription } from '../../subscription/SubscriptionContext'
import { useData } from '../../data/DataContext'
import { useFollowUps } from '../FollowUpManager'
import { supabase } from '../../lib/supabase'
import type { CSSProperties } from 'react'
import TrialBanner from '../TrialBanner'
import GlobalSearch from '../GlobalSearch'
import { useNotificationChecker, requestNotificationPermission } from '../../lib/notifications'
import './AppShell.css'

interface TeamMember {
  id: string
  display_name: string
  role: 'owner' | 'admin' | 'member'
  created_at: string
}

interface Invitation {
  id: string
  email: string
  role: 'owner' | 'admin' | 'member'
  token: string
  expires_at: string
  accepted_at: string | null
  created_at: string
}

interface NavItem {
  to: string
  icon: React.ReactNode
  label: string
  /** Minimum role required: 'member' = everyone, 'admin' = admin+owner, 'owner' = owner only */
  minRole?: 'member' | 'admin' | 'owner'
}

const ROLE_LEVEL: Record<string, number> = { member: 0, admin: 1, owner: 2 }

function hasMinRole(userRole: string, minRole: string): boolean {
  return (ROLE_LEVEL[userRole] ?? 0) >= (ROLE_LEVEL[minRole] ?? 0)
}

const allNavItems: NavItem[] = [
  { to: '/',          icon: <LayoutDashboard size={24} />, label: 'Home' },
  { to: '/quote',     icon: <FileText size={24} />,  label: 'Quote' },
  { to: '/jobs',      icon: <Briefcase size={24} />, label: 'Jobs' },
  { to: '/calendar',  icon: <Calendar size={24} />,  label: 'Calendar' },
  { to: '/customers', icon: <Users size={24} />,     label: 'Customers' },
  { to: '/expenses',  icon: <Receipt size={24} />,   label: 'Expenses',  minRole: 'admin' },
  { to: '/insights',  icon: <BarChart3 size={24} />, label: 'Insights',  minRole: 'admin' },
]

const roleLabels: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
}

const roleColors: Record<string, string> = {
  owner: '#C6A86A',
  admin: '#5B9BD5',
  member: '#6ABF8A',
}

export default function AppShell() {
  const { mode, C, toggle } = useTheme()
  const { user, signOut } = useAuth()
  const { plan, subscription, daysLeft, isActive } = useSubscription()
  const [editingName, setEditingName] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [editingOrgName, setEditingOrgName] = useState(false)
  const [orgNameValue, setOrgNameValue] = useState('')
  const [orgSaving, setOrgSaving] = useState(false)
  const { quotes, jobs, invoices, events, settings } = useData()
  const { activeCount: followUpCount } = useFollowUps(quotes, jobs, invoices, settings)
  const navigate = useNavigate()

  // Push notification checker — runs every 5 minutes
  useNotificationChecker({ settings, jobs, quotes, invoices, events })

  // Request notification permission on first load
  useEffect(() => {
    requestNotificationPermission()
  }, [])
  const [showProfile, setShowProfile] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  // Ctrl+K / Cmd+K keyboard shortcut for global search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(prev => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Team management state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const isOwner = user?.role === 'owner'
  const isAdmin = hasMinRole(user?.role ?? 'member', 'admin')
  const userRole = user?.role ?? 'member'
  const navItems = allNavItems.filter(item => hasMinRole(userRole, item.minRole ?? 'member'))

  const initials = user?.displayName
    ? user.displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  const fetchTeamData = useCallback(async () => {
    if (!user?.orgId || !isOwner) return

    const [membersRes, invitesRes] = await Promise.all([
      supabase.from('profiles').select('id, display_name, role, created_at').eq('org_id', user.orgId),
      supabase.from('invitations').select('*').eq('org_id', user.orgId).is('accepted_at', null).order('created_at', { ascending: false }),
    ])

    if (membersRes.data) setTeamMembers(membersRes.data as TeamMember[])
    if (invitesRes.data) setInvitations(invitesRes.data as Invitation[])
  }, [user?.orgId, isOwner])

  useEffect(() => {
    if (showProfile && isOwner) fetchTeamData()
  }, [showProfile, isOwner, fetchTeamData])

  const handleSignOut = async () => {
    setShowProfile(false)
    await signOut()
    navigate('/login', { replace: true })
  }

  const handleSendInvite = async () => {
    if (!user?.orgId || !inviteEmail.trim()) return
    setInviteLoading(true)
    setInviteError('')
    setInviteSuccess('')

    const { error } = await supabase.from('invitations').insert({
      org_id: user.orgId,
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
    })

    setInviteLoading(false)
    if (error) {
      setInviteError(error.message)
    } else {
      setInviteSuccess(`Invitation sent to ${inviteEmail.trim()}`)
      setInviteEmail('')
      fetchTeamData()
      setTimeout(() => setInviteSuccess(''), 4000)
    }
  }

  const handleChangeRole = async (memberId: string, newRole: 'admin' | 'member') => {
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', memberId)
    if (!error) fetchTeamData()
  }

  const handleRemoveMember = async (memberId: string, name: string) => {
    if (!confirm(`Remove ${name} from the team? They will lose access to this organization.`)) return
    const { error } = await supabase.from('profiles').delete().eq('id', memberId)
    if (!error) fetchTeamData()
  }

  const handleDeleteInvite = async (inviteId: string) => {
    const { error } = await supabase.from('invitations').delete().eq('id', inviteId)
    if (!error) fetchTeamData()
  }

  const handleCopyLink = (inviteId: string) => {
    const link = `${window.location.origin}/login?invite=true`
    copyToClipboard(link)
    setCopiedId(inviteId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  /* ── inline styles ── */
  const ps: Record<string, CSSProperties> = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200 },
    panel: {
      position: 'fixed', top: 0, left: 0, bottom: 0, width: 400, maxWidth: '100vw',
      background: C.charcoal, borderRight: `1px solid ${C.steel}44`, zIndex: 210,
      overflowY: 'auto', padding: '28px 24px 40px', boxShadow: '8px 0 32px rgba(0,0,0,.5)',
    },
    panelHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
    panelTitle: { fontSize: 20, fontWeight: 600, color: C.white },
    closeBtn: {
      background: 'transparent', border: 'none', color: C.silver, cursor: 'pointer',
      padding: 8, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    avatarLg: {
      width: 80, height: 80, borderRadius: '50%',
      background: C.charcoalLight,
      color: C.gold,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 30, fontWeight: 800, margin: '0 auto 16px',
      letterSpacing: 0.5,
      border: `2px solid ${C.steel}`,
    },
    userName: { textAlign: 'center', fontSize: 20, fontWeight: 600, color: C.white, marginBottom: 4 },
    userEmail: { textAlign: 'center', fontSize: 13, color: C.silver, marginBottom: 4 },
    userRole: {
      textAlign: 'center', fontSize: 11, fontWeight: 600, padding: '3px 12px',
      borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 4,
      letterSpacing: 0.5, textTransform: 'uppercase', whiteSpace: 'nowrap',
    },
    section: { marginTop: 28, paddingTop: 20, borderTop: `1px solid ${C.steel}33` },
    sectionTitle: { fontSize: 14, fontWeight: 600, color: C.white, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 },
    orgRow: {
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
      background: `${C.steel}11`, borderRadius: 10,
    },
    orgIcon: {
      width: 40, height: 40, borderRadius: 10, background: `${C.gold}1A`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    orgName: { fontSize: 15, fontWeight: 600, color: C.white },
    orgSub: { fontSize: 12, color: C.silver },
    logoutBtn: {
      display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
      borderRadius: 10, background: `#D46A6A22`, color: '#D46A6A', border: 'none',
      cursor: 'pointer', fontSize: 14, fontWeight: 500, width: '100%', marginTop: 20, minHeight: 44,
    },
    // Team management styles
    memberRow: {
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
      background: `${C.steel}11`, borderRadius: 10, marginBottom: 8,
    },
    memberAvatar: {
      width: 36, height: 36, borderRadius: '50%',
      background: `radial-gradient(circle at 30% 25%, ${C.steel}88 0%, ${C.steel}55 70%, ${C.steel}33 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 700, color: C.white, flexShrink: 0,
      border: `1px solid ${C.steel}66`,
      boxShadow: `0 2px 6px rgba(0,0,0,0.2), inset 0 1px 2px rgba(255,255,255,0.15)`,
      letterSpacing: 0.3,
    },
    memberInfo: { flex: 1, minWidth: 0 },
    memberName: { fontSize: 14, fontWeight: 600, color: C.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    memberMeta: { fontSize: 12, color: C.silver },
    roleBadge: {
      fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 12,
      textTransform: 'uppercase' as const, letterSpacing: 0.5, display: 'inline-block',
    },
    roleSelect: {
      fontSize: 12, padding: '4px 8px', borderRadius: 6,
      background: C.black, color: C.white, border: `1px solid ${C.steel}44`,
      cursor: 'pointer', outline: 'none', colorScheme: 'dark' as const,
    },
    removeBtn: {
      background: 'transparent', border: 'none', color: '#D46A6A', cursor: 'pointer',
      padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 6, minWidth: 32, minHeight: 32, flexShrink: 0,
    },
    inviteForm: {
      display: 'flex', flexDirection: 'column' as const, gap: 10,
    },
    inviteInputRow: {
      display: 'flex', gap: 8, alignItems: 'center',
    },
    input: {
      flex: 1, fontSize: 14, padding: '10px 14px', borderRadius: 8,
      background: `${C.steel}11`, color: C.white, border: `1px solid ${C.steel}33`,
      outline: 'none',
    },
    select: {
      fontSize: 14, padding: '10px 12px', borderRadius: 8,
      background: C.black, color: C.white, border: `1px solid ${C.steel}33`,
      cursor: 'pointer', outline: 'none',
      colorScheme: 'dark',
    },
    inviteBtn: {
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      padding: '10px 16px', borderRadius: 8, background: C.gold, color: C.black,
      border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, minHeight: 44,
    },
    inviteBtnDisabled: {
      opacity: 0.5, cursor: 'not-allowed',
    },
    errorMsg: {
      fontSize: 13, color: '#D46A6A', padding: '8px 12px', borderRadius: 8,
      background: '#D46A6A11',
    },
    successMsg: {
      fontSize: 13, color: '#6ABF8A', padding: '8px 12px', borderRadius: 8,
      background: '#6ABF8A11',
    },
    pendingRow: {
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
      background: `${C.steel}11`, borderRadius: 10, marginBottom: 8,
    },
    pendingInfo: { flex: 1, minWidth: 0 },
    pendingEmail: { fontSize: 13, fontWeight: 500, color: C.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    pendingMeta: { fontSize: 11, color: C.silver },
    copyBtn: {
      background: 'transparent', border: `1px solid ${C.steel}44`, color: C.silver,
      cursor: 'pointer', padding: '4px 8px', borderRadius: 6, display: 'flex',
      alignItems: 'center', gap: 4, fontSize: 11, minHeight: 28,
    },
    emptyText: { fontSize: 13, color: C.silver, fontStyle: 'italic' as const },
  }

  // Mobile: Home is pinned on the left (icon only), rest scroll
  const mobileTopTabs = navItems.filter(n => n.to !== '/')

  return (
    <div className="app-shell">
      {/* Desktop sidebar */}
      <nav className="sidebar sidebar--desktop" aria-label="Main navigation">
        <div className="sidebar-top">
          <div className="sidebar-brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }} title="Dashboard">V</div>
          <ul className="sidebar-nav">
            {navItems.map((item, idx) => {
              const configPaths = ['/pricing', '/integrations', '/settings']
              const isFirstConfigItem = configPaths.includes(item.to) &&
                !navItems.slice(0, idx).some(prev => configPaths.includes(prev.to))
              return (
                <Fragment key={item.to}>
                  {isFirstConfigItem && <li className="sidebar-divider" />}
                  <li>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      className={({ isActive }) =>
                        `sidebar-link${isActive ? ' sidebar-link--active' : ''}`
                      }
                      title={item.label}
                      aria-label={item.label}
                      style={{ position: 'relative' }}
                    >
                      {item.icon}
                      {item.to === '/' && followUpCount > 0 && (
                        <span style={{
                          position: 'absolute', top: 4, right: 4,
                          background: '#D46A6A', color: '#fff', fontSize: 9, fontWeight: 700,
                          borderRadius: 8, minWidth: 16, height: 16, padding: '0 4px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          lineHeight: 1, boxShadow: '0 1px 4px rgba(0,0,0,.4)',
                        }}>{followUpCount > 9 ? '9+' : followUpCount}</span>
                      )}
                    </NavLink>
                  </li>
                </Fragment>
              )
            })}
          </ul>
        </div>

        <div className="sidebar-bottom">
          {isAdmin && (
            <NavLink
              to="/settings"
              className={({ isActive }) => `sidebar-link${isActive ? ' sidebar-link--active' : ''}`}
              title="Organisation Settings"
            >
              <Settings size={24} />
            </NavLink>
          )}
          <button
            className="sidebar-link"
            onClick={toggle}
            title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {mode === 'dark' ? <Sun size={24} /> : <Moon size={24} />}
          </button>
          <div
            className="sidebar-avatar"
            role="button"
            tabIndex={0}
            title="User profile"
            aria-label="User profile"
            aria-expanded={showProfile}
            onClick={() => setShowProfile(true)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowProfile(true) } }}
            style={{
              fontWeight: 800,
              fontSize: 16,
            }}
          >
            {initials}
          </div>
        </div>
      </nav>


      <main className="main-content" aria-label="Main content">
        {/* Mobile top tabs: pinned Home + scrollable rest */}
        <div className="mobile-top-tabs">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `mobile-top-tab mobile-top-tab--home${isActive ? ' mobile-top-tab--active' : ''}`
            }
            aria-label="Home"
          >
            <LayoutDashboard size={20} />
          </NavLink>
          <div className="mobile-top-tabs-scroll">
            {mobileTopTabs.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `mobile-top-tab${isActive ? ' mobile-top-tab--active' : ''}`
                }
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `mobile-top-tab${isActive ? ' mobile-top-tab--active' : ''}`
                }
              >
                <Settings size={20} />
                <span>Settings</span>
              </NavLink>
            )}
            <button
              className="mobile-top-tab"
              onClick={() => setShowSearch(true)}
            >
              <Search size={20} />
              <span>Search</span>
            </button>
            <button
              className="mobile-top-tab"
              onClick={() => setShowProfile(true)}
            >
              <User size={20} />
              <span>Profile</span>
            </button>
          </div>
        </div>
        <TrialBanner />
        <Outlet />
      </main>

      {/* User Profile Panel */}
      {showProfile && (
        <>
          <div style={ps.overlay} onClick={() => setShowProfile(false)} />
          <div style={ps.panel}>
            <div style={ps.panelHeader}>
              <span style={ps.panelTitle}>Profile</span>
              <button style={ps.closeBtn} onClick={() => setShowProfile(false)}>
                <X size={22} />
              </button>
            </div>

            {/* current user */}
            <div style={ps.avatarLg}>{initials}</div>
            <div style={ps.userName as CSSProperties}>{user?.displayName ?? 'User'}</div>
            <div style={ps.userEmail as CSSProperties}>{user?.email ?? ''}</div>
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <span style={{
                ...(ps.userRole as CSSProperties),
                color: roleColors[user?.role ?? 'member'],
                background: (roleColors[user?.role ?? 'member']) + '1A',
              }}>
                <Crown size={12} />
                {roleLabels[user?.role ?? 'member']}
              </span>
            </div>

            {/* ── Subscription Status ── */}
            <div style={ps.section}>
              <div style={ps.sectionTitle}>
                <CreditCard size={16} color={C.gold} />
                Subscription
              </div>
              <div style={{
                padding: '12px 14px', borderRadius: 10,
                background: C.black, border: `1px solid ${C.steel}33`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.white, textTransform: 'capitalize' }}>
                    {plan}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                    textTransform: 'uppercase', letterSpacing: 0.5,
                    color: isActive ? '#6ABF8A' : '#D46A6A',
                    background: isActive ? '#6ABF8A1A' : '#D46A6A1A',
                  }}>
                    {subscription?.status === 'trialing' ? 'Trial' : isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {subscription?.status === 'trialing' && daysLeft !== null && (
                  <div style={{ fontSize: 12, color: C.silver }}>
                    {daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left on trial` : 'Trial expired'}
                  </div>
                )}
                {subscription?.status === 'active' && subscription.currentPeriodEnd && (
                  <div style={{ fontSize: 12, color: C.silver }}>
                    Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                )}
                <button
                  onClick={() => { setShowProfile(false); navigate('/plans') }}
                  style={{
                    width: '100%', marginTop: 10, padding: '8px', borderRadius: 8,
                    background: 'transparent', border: `1px solid ${C.gold}44`,
                    color: C.gold, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {plan === 'trial' ? 'Choose a Plan' : 'Manage Plan'}
                </button>
              </div>
            </div>

            {/* ── Personal Details ── */}
            <div style={ps.section}>
              <div style={ps.sectionTitle}>
                <User size={16} color={C.gold} />
                Personal Details
              </div>
              {(() => {
                // Inline editable fields — each saves to profiles table directly
                const fieldStyle: CSSProperties = {
                  padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                  background: C.black, border: `1px solid ${C.steel}33`,
                  marginBottom: 6,
                }
                const labelStyle: CSSProperties = {
                  fontSize: 10, color: C.steel, textTransform: 'uppercase',
                  letterSpacing: 0.5, marginBottom: 3,
                }
                const valueStyle: CSSProperties = {
                  fontSize: 13, color: C.white, display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center',
                }
                const inputStyle: CSSProperties = {
                  width: '100%', padding: '8px 12px', borderRadius: 8,
                  background: C.black, border: `1px solid ${C.steel}33`,
                  color: C.white, fontSize: 13, outline: 'none',
                  boxSizing: 'border-box',
                }

                // Single editable field component rendered inline
                const EditableField = ({ label, field, value, inputMode }: {
                  label: string; field: string; value: string; inputMode?: string
                }) => {
                  const isEditing = editingName && profileName === `__field__${field}`
                  if (isEditing) {
                    return (
                      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                        <input
                          defaultValue={value}
                          autoFocus
                          inputMode={inputMode as any}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              const val = (e.target as HTMLInputElement).value.trim()
                              supabase.from('profiles').update({ [field]: val || null }).eq('id', user?.id ?? '')
                                .then(() => setEditingName(false))
                            }
                            if (e.key === 'Escape') setEditingName(false)
                          }}
                          style={inputStyle}
                          placeholder={label}
                        />
                        <button
                          onClick={e => {
                            const input = (e.currentTarget.previousElementSibling as HTMLInputElement)
                            const val = input?.value?.trim() ?? ''
                            supabase.from('profiles').update({ [field]: val || null }).eq('id', user?.id ?? '')
                              .then(() => setEditingName(false))
                          }}
                          style={{
                            padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                            background: C.gold, border: 'none', color: C.charcoal, cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >Save</button>
                      </div>
                    )
                  }
                  return (
                    <div
                      onClick={() => { setProfileName(`__field__${field}`); setEditingName(true) }}
                      style={fieldStyle}
                    >
                      <div style={labelStyle}>{label}</div>
                      <div style={valueStyle}>
                        <span style={{ color: value ? C.white : C.steel }}>{value || '—'}</span>
                        <Pencil size={11} color={C.steel} />
                      </div>
                    </div>
                  )
                }

                return (
                  <>
                    <EditableField label="Name" field="display_name" value={user?.displayName ?? ''} />
                    <EditableField label="Job Title" field="job_title" value={user?.jobTitle ?? ''} />
                    <EditableField label="Phone" field="phone" value={user?.phone ?? ''} inputMode="tel" />
                    <div style={{ ...fieldStyle, cursor: 'default' }}>
                      <div style={labelStyle}>Email</div>
                      <div style={{ fontSize: 13, color: C.silver }}>{user?.email ?? '—'}</div>
                    </div>
                    <EditableField label="Address" field="address1" value={user?.address1 ?? ''} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <EditableField label="City" field="city" value={user?.city ?? ''} />
                      <EditableField label="Postcode" field="postcode" value={user?.postcode ?? ''} />
                    </div>
                  </>
                )
              })()}
            </div>

            {/* ── Organisation ── */}
            {user?.orgName && (
              <div style={ps.section}>
                <div style={ps.sectionTitle}>
                  <Building2 size={16} color={C.gold} />
                  Organization
                </div>
                <div style={ps.orgRow}>
                  <div style={ps.orgIcon}>
                    <Building2 size={20} color={C.gold} />
                  </div>
                  <div>
                    {editingOrgName ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          value={orgNameValue}
                          onChange={e => setOrgNameValue(e.target.value)}
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter' && orgNameValue.trim()) {
                              setOrgSaving(true)
                              supabase.from('organizations').update({ name: orgNameValue.trim() }).eq('id', user.orgId)
                                .then(() => { setEditingOrgName(false); setOrgSaving(false) })
                            }
                            if (e.key === 'Escape') setEditingOrgName(false)
                          }}
                          style={{
                            flex: 1, padding: '4px 8px', borderRadius: 6,
                            background: C.black, border: `1px solid ${C.steel}44`,
                            color: C.white, fontSize: 14, fontWeight: 600, outline: 'none',
                          }}
                        />
                        <button
                          onClick={() => {
                            if (!orgNameValue.trim()) return
                            setOrgSaving(true)
                            supabase.from('organizations').update({ name: orgNameValue.trim() }).eq('id', user.orgId)
                              .then(() => { setEditingOrgName(false); setOrgSaving(false) })
                          }}
                          disabled={orgSaving}
                          style={{
                            padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                            background: C.gold, border: 'none', color: C.charcoal, cursor: 'pointer',
                          }}
                        >{orgSaving ? '...' : 'Save'}</button>
                      </div>
                    ) : (
                      <div
                        onClick={() => { if (isOwner) { setOrgNameValue(user.orgName || ''); setEditingOrgName(true) } }}
                        style={{ cursor: isOwner ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <div style={ps.orgName}>{user.orgName}</div>
                        {isOwner && <Pencil size={11} color={C.steel} />}
                      </div>
                    )}
                    <div style={ps.orgSub}>{teamMembers.length > 0 ? `${teamMembers.length} team member${teamMembers.length === 1 ? '' : 's'}` : ''}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Team Members — owner only */}
            {isOwner && (
              <div style={ps.section}>
                <div style={ps.sectionTitle}>
                  <Users size={16} color={C.gold} />
                  Team Members
                </div>
                {teamMembers.length === 0 && (
                  <div style={ps.emptyText}>No team members yet.</div>
                )}
                {teamMembers.map((member) => {
                  const memberInitials = member.display_name
                    ? member.display_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
                    : '?'
                  const isSelf = member.id === user?.id
                  const isMemberOwner = member.role === 'owner'

                  return (
                    <div key={member.id} style={ps.memberRow}>
                      <div style={ps.memberAvatar}>{memberInitials}</div>
                      <div style={ps.memberInfo}>
                        <div style={ps.memberName as CSSProperties}>
                          {member.display_name}{isSelf ? ' (you)' : ''}
                        </div>
                        <div style={ps.memberMeta}>
                          {isMemberOwner ? (
                            <span style={{
                              ...ps.roleBadge,
                              color: roleColors.owner,
                              background: roleColors.owner + '1A',
                            }}>Owner</span>
                          ) : (
                            <select
                              style={ps.roleSelect}
                              value={member.role}
                              onChange={(e) => handleChangeRole(member.id, e.target.value as 'admin' | 'member')}
                            >
                              <option value="admin">Admin</option>
                              <option value="member">Member</option>
                            </select>
                          )}
                        </div>
                      </div>
                      {!isMemberOwner && !isSelf && (
                        <button
                          style={ps.removeBtn}
                          onClick={() => handleRemoveMember(member.id, member.display_name)}
                          title="Remove from team"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Invite Team Member — owner only */}
            {isOwner && (
              <div style={ps.section}>
                <div style={ps.sectionTitle}>
                  <UserPlus size={16} color={C.gold} />
                  Invite Team Member
                </div>
                <div style={ps.inviteForm}>
                  <div style={ps.inviteInputRow}>
                    <input
                      type="email"
                      placeholder="Email address"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      style={ps.input}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendInvite()}
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
                      style={ps.select}
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <button
                    style={{
                      ...ps.inviteBtn,
                      ...(inviteLoading || !inviteEmail.trim() ? ps.inviteBtnDisabled : {}),
                    }}
                    onClick={handleSendInvite}
                    disabled={inviteLoading || !inviteEmail.trim()}
                  >
                    <Mail size={16} />
                    {inviteLoading ? 'Sending...' : 'Send Invite'}
                  </button>
                  {inviteError && <div style={ps.errorMsg}>{inviteError}</div>}
                  {inviteSuccess && <div style={ps.successMsg}>{inviteSuccess}</div>}
                  <div style={{ fontSize: 12, color: C.silver, lineHeight: 1.5 }}>
                    The invited person should sign up at the login page using the same email address. They will be automatically linked to your organization.
                  </div>
                </div>
              </div>
            )}

            {/* Pending Invites — owner only */}
            {isOwner && invitations.length > 0 && (
              <div style={ps.section}>
                <div style={ps.sectionTitle}>
                  <Clock size={16} color={C.gold} />
                  Pending Invites
                </div>
                {invitations.map((invite) => {
                  const isExpired = new Date(invite.expires_at) < new Date()
                  return (
                    <div key={invite.id} style={ps.pendingRow}>
                      <div style={ps.pendingInfo}>
                        <div style={ps.pendingEmail as CSSProperties}>{invite.email}</div>
                        <div style={ps.pendingMeta}>
                          <span style={{
                            ...ps.roleBadge,
                            color: roleColors[invite.role] ?? roleColors.member,
                            background: (roleColors[invite.role] ?? roleColors.member) + '1A',
                            marginRight: 6,
                          }}>
                            {roleLabels[invite.role] ?? invite.role}
                          </span>
                          {isExpired
                            ? <span style={{ color: '#D46A6A' }}>Expired</span>
                            : <span>Expires {new Date(invite.expires_at).toLocaleDateString()}</span>
                          }
                        </div>
                      </div>
                      <button
                        style={ps.copyBtn}
                        onClick={() => handleCopyLink(invite.id)}
                        title="Copy signup link"
                      >
                        {copiedId === invite.id ? <Check size={12} /> : <Copy size={12} />}
                        {copiedId === invite.id ? 'Copied' : 'Link'}
                      </button>
                      <button
                        style={ps.removeBtn}
                        onClick={() => handleDeleteInvite(invite.id)}
                        title="Delete invitation"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* logout */}
            <button style={ps.logoutBtn} onClick={handleSignOut}>
              <LogOut size={18} /> Sign Out
            </button>
          </div>
        </>
      )}

      {/* Global Search Modal */}
      {showSearch && <GlobalSearch onClose={() => setShowSearch(false)} />}
    </div>
  )
}
