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

const ROLE_CACHE_KEY = 'etnova_role_cache'

async function fetchUserRole() {
  const data = await apiRequest('/profile')
  return data?.role?.toLowerCase() ?? null
}

function readCachedRole(userId) {
  if (!userId) return null
  try {
    const raw = sessionStorage.getItem(ROLE_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.userId !== userId || !parsed?.role) return null
    return String(parsed.role).toLowerCase()
  } catch {
    return null
  }
}

function writeCachedRole(userId, role) {
  if (!userId || !role) return
  try {
    sessionStorage.setItem(
      ROLE_CACHE_KEY,
      JSON.stringify({ userId, role: String(role).toLowerCase() }),
    )
  } catch {
    // best-effort only
  }
}

function clearCachedRole() {
  try {
    sessionStorage.removeItem(ROLE_CACHE_KEY)
  } catch {
    // best-effort only
  }
}

async function clearLocalSupabaseSession() {
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    // best-effort cleanup only
  }
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
          clearCachedRole()
          setLoading(false)
          isInitialized = true
        }
        return
      }

      const cachedRole = readCachedRole(nextSession.user.id)
      if (cachedRole) {
        setRole(cachedRole)
      }

      // Only show loading spinner on first load, not on token refresh
      if (!isInitialized && !cachedRole) {
        setLoading(true)
      }

      if ((event === 'TOKEN_REFRESHED' && roleRef.current) || (cachedRole && !force)) {
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
          writeCachedRole(nextSession.user.id, nextRole)
        }
      } catch (error) {
        if (error?.message !== 'Not authenticated' && error?.message !== 'Session expired. Please sign in again.') {
          console.error('Failed to load user role:', error)
        }
        if (isMounted && requestId === activeRequestId) {
          setRole(null)
          clearCachedRole()
        }
      } finally {
        if (isMounted && requestId === activeRequestId) {
          setLoading(false)
          isInitialized = true
        }
      }
    }

    const init = async () => {
      try {
        const {
          data: sessionData,
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) throw sessionError

        if (isMounted) {
          handleSession(sessionData?.session ?? null, { force: true, event: 'INITIAL_SESSION' })
        }
      } catch (error) {
        await clearLocalSupabaseSession()
        if (isMounted) {
          setSession(null)
          setUser(null)
          setRole(null)
          clearCachedRole()
          setLoading(false)
        }
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
