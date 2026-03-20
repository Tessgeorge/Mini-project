/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import supabase from '../config/supabaseClient'
import { apiRequest } from '../config/apiClient'

const AuthContext = createContext({
  session: null,
  user: null,
  role: null,
  loading: true,
})

async function fetchUserRole() {
  const data = await apiRequest('/profile')
  return data?.role?.toLowerCase() ?? null
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const roleRef = useRef(null)

  useEffect(() => {
    roleRef.current = role
  }, [role])

  useEffect(() => {
    let isMounted = true
    let isInitialized = false
    let activeRequestId = 0
    let lastSessionKey = null

    const toSessionKey = (nextSession) => {
      if (!nextSession?.user) return 'anon'
      return nextSession.user.id
    }

    const handleSession = async (nextSession, { force = false, event = null } = {}) => {
      const sessionKey = toSessionKey(nextSession)
      if (!force && isInitialized && sessionKey === lastSessionKey) {
        return
      }
      lastSessionKey = sessionKey

      const requestId = ++activeRequestId
      setSession(nextSession)
      setUser(nextSession?.user ?? null)

      if (!nextSession?.user) {
        if (isMounted && requestId === activeRequestId) {
          setRole(null)
          setLoading(false)
          isInitialized = true
        }
        return
      }

      // Only show loading spinner on first load, not on token refresh
      if (!isInitialized) {
        setLoading(true)
      }

      if (event === 'TOKEN_REFRESHED' && roleRef.current) {
        if (isMounted && requestId === activeRequestId) {
          setLoading(false)
          isInitialized = true
        }
        return
      }

      try {
        const nextRole = await fetchUserRole()
        if (isMounted && requestId === activeRequestId) {
          setRole(nextRole)
        }
      } catch (error) {
        if (error?.message !== 'Not authenticated' && error?.message !== 'Session expired. Please sign in again.') {
          console.error('Failed to load user role:', error)
        }
        if (isMounted && requestId === activeRequestId) {
          setRole(null)
        }
      } finally {
        if (isMounted && requestId === activeRequestId) {
          setLoading(false)
          isInitialized = true
        }
      }
    }

    const init = async () => {
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession()
      if (isMounted) {
        handleSession(initialSession, { force: true, event: 'INITIAL_SESSION' })
      }
    }

    init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!['INITIAL_SESSION', 'SIGNED_IN', 'SIGNED_OUT', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) {
        return
      }
      handleSession(nextSession, { event })
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
