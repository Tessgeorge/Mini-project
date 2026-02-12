import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import supabase from '../config/supabaseClient'

const AuthContext = createContext({
  session: null,
  user: null,
  role: null,
  loading: true,
})

async function fetchUserRole(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data?.role?.toLowerCase() ?? null
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const handleSession = async (nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)

      if (!nextSession?.user) {
        setRole(null)
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const nextRole = await fetchUserRole(nextSession.user.id)
        if (isMounted) {
          setRole(nextRole)
        }
      } catch (error) {
        console.error('Failed to load user role:', error)
        if (isMounted) {
          setRole(null)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    const init = async () => {
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession()
      if (isMounted) {
        handleSession(initialSession)
      }
    }

    init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      handleSession(nextSession)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(
    () => ({ session, user, role, loading }),
    [session, user, role, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
