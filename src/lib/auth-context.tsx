'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import type { User, Session } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    getSupabaseBrowser().auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = getSupabaseBrowser().auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabaseBrowser().auth.signInWithPassword({ email, password })
    if (error) {
      // Translate common errors to Dutch
      const msg = error.message === 'Invalid login credentials'
        ? 'Onjuist e-mailadres of wachtwoord'
        : error.message === 'Email not confirmed'
          ? 'Bevestig eerst je e-mailadres'
          : error.message
      return { error: msg }
    }
    return { error: null }
  }, [])

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const { error, data } = await getSupabaseBrowser().auth.signUp({
      email,
      password,
      options: { data: { name } },
    })

    if (error) {
      const msg = error.message === 'User already registered'
        ? 'Er bestaat al een account met dit e-mailadres'
        : error.message.includes('Password')
          ? 'Wachtwoord moet minimaal 6 tekens bevatten'
          : error.message
      return { error: msg }
    }

    // Create default user_settings for the new user
    if (data.user) {
      await createDefaultSettings(data.user.id, name)
    }

    return { error: null }
  }, [])

  const signOut = useCallback(async () => {
    await getSupabaseBrowser().auth.signOut()
  }, [])

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

// Create default settings when a new user signs up
async function createDefaultSettings(userId: string, name: string) {
  try {
    await fetch('/api/settings/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, name }),
    })
  } catch {
    // Non-critical, settings will be created on first use
  }
}
