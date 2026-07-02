import { createContext, useContext, useState, type ReactNode } from 'react'

interface User { id: string; tfc_id: string }

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (tfcId: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // In-memory only: nothing persisted to localStorage. A page refresh
  // remounts the app with no user, sending the user back to the login
  // screen (requirement #2 - reset to initial state on refresh).
  const [user, setUser] = useState<User | null>(null)
  const isLoading = false

  const login = async (tfcId: string, password: string) => {
    try {
      const url = import.meta.env.VITE_SUPABASE_URL as string
      const res = await fetch(`${url}/functions/v1/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tfc_id: tfcId.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) return { success: false, error: data.error || 'Login failed' }
      const userData = { id: data.user.id, tfc_id: data.user.tfc_id }
      setUser(userData)
      return { success: true }
    } catch {
      return { success: false, error: 'Unable to connect to server' }
    }
  }

  const logout = () => {
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, isLoading, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
