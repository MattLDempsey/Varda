import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'

export interface AuthUser {
  id: string
  email: string
  displayName: string
  role: 'owner' | 'admin' | 'member'
  orgId: string
  orgName: string
  phone?: string
  jobTitle?: string
  address1?: string
  address2?: string
  city?: string
  postcode?: string
}

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  needsOnboarding: boolean
  signUp: (email: string, password: string, displayName: string) => Promise<{ error?: string }>
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  createOrganization: (name: string, tradeType: string, phone?: string) => Promise<{ error?: string }>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  needsOnboarding: false,
  signUp: async () => ({}),
  signIn: async () => ({}),
  signOut: async () => {},
  createOrganization: async () => ({}),
})

async function fetchProfile(userId: string): Promise<AuthUser | 'needs_onboarding' | null> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, display_name, role, org_id, phone, job_title, address1, address2, city, postcode, organizations(id, name)')
    .eq('id', userId)
    .maybeSingle()

  if (error || !profile) return 'needs_onboarding'

  if (!profile.org_id) return 'needs_onboarding'

  // organizations comes back as object (single) due to FK from profiles.org_id
  const org = profile.organizations as unknown as { id: string; name: string } | null
  if (!org) return 'needs_onboarding'

  const { data: authUser } = await supabase.auth.getUser()
  const email = authUser?.user?.email ?? ''

  return {
    id: profile.id,
    email,
    displayName: profile.display_name ?? email,
    role: profile.role as AuthUser['role'],
    orgId: org.id,
    orgName: org.name,
    phone: profile.phone ?? undefined,
    jobTitle: profile.job_title ?? undefined,
    address1: profile.address1 ?? undefined,
    address2: profile.address2 ?? undefined,
    city: profile.city ?? undefined,
    postcode: profile.postcode ?? undefined,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [sessionUserId, setSessionUserId] = useState<string | null>(null)

  const loadProfile = useCallback(async (session: Session | null) => {
    if (!session?.user) {
      setUser(null)
      setNeedsOnboarding(false)
      setSessionUserId(null)
      setIsLoading(false)
      return
    }

    setSessionUserId(session.user.id)
    const result = await fetchProfile(session.user.id)

    if (result === 'needs_onboarding') {
      setUser(null)
      setNeedsOnboarding(true)
    } else if (result) {
      setUser(result)
      setNeedsOnboarding(false)
    } else {
      setUser(null)
      setNeedsOnboarding(true)
    }

    setIsLoading(false)
  }, [])

  // Check session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      loadProfile(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      loadProfile(session)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const signUp = async (email: string, password: string, displayName: string): Promise<{ error?: string }> => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    })

    if (error) return { error: error.message }
    return {}
  }

  const signIn = async (email: string, password: string): Promise<{ error?: string }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return {}
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setNeedsOnboarding(false)
    setSessionUserId(null)
  }

  const createOrganization = async (name: string, tradeType: string, phone?: string): Promise<{ error?: string }> => {
    if (!sessionUserId) return { error: 'Not authenticated' }

    // Use server-side SECURITY DEFINER function to bypass RLS during onboarding
    const { error } = await supabase.rpc('create_organization_for_user', {
      p_name: name,
      p_trade_type: tradeType,
      p_phone: phone ?? null,
    })

    if (error) return { error: error.message }

    // Reload the profile so user state updates
    const profile = await fetchProfile(sessionUserId)
    if (profile && profile !== 'needs_onboarding') {
      setUser(profile)
      setNeedsOnboarding(false)
    }

    return {}
  }

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      needsOnboarding,
      signUp,
      signIn,
      signOut,
      createOrganization,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
