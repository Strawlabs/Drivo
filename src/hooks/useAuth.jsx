import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext(null)

/*
  Fetches the user's role from the users table.
  Returns 'rider' | 'driver' | 'admin' | null (null = authenticated but no profile yet)
*/
async function fetchRole(userId) {
  const { data } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  return data?.role ?? null
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)   // 'rider' | 'driver' | 'admin' | null
  const [loading, setLoading] = useState(true)

  async function refreshRole() {
    const session = await supabase.auth.getSession()
    const u = session.data?.session?.user ?? null
    if (u) {
      const newRole = await fetchRole(u.id)
      setRole(newRole)
      return newRole
    }
    return null
  }

  useEffect(() => {
    // On mount: check for an existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      setRole(u ? await fetchRole(u.id) : null)
      setLoading(false)
    })

    // Listen for login / logout / token refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      setRole(u ? await fetchRole(u.id) : null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, role, loading, refreshRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
