import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { authApi, setTokens } from '../services/api'
import type { User } from '../types'
import { supabase, configured } from '../services/supabase'
import { disablePush } from '../services/push'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  isAdmin: boolean
  isBarber: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // On mount — check if session is still alive
  useEffect(() => {
    let live = true
    const refresh = () => {
      if (!configured) { setLoading(false); return }
      void authApi.me().then(u => { if (live) setUser(u) }).catch(() => { if (live) setUser(null) }).finally(() => { if (live) setLoading(false) })
    }
    refresh()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { setTimeout(refresh, 0) })
    const timer = setInterval(refresh, 60000)
    return () => { live = false; subscription.unsubscribe(); clearInterval(timer) }
  }, [])

  const login = async (username: string, password: string) => {
    await authApi.login(username, password)
    setTokens(null)
    const u = await authApi.me()
    setUser(u)
  }

  const logout = async () => {
    try {
      if ('serviceWorker' in navigator && 'PushManager' in window) await disablePush()
    } finally {
      try { await authApi.logout() } finally { setTokens(null); setUser(null) }
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      isAdmin:  user?.role === 'Admin',
      isBarber: user?.role === 'Barber',
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
