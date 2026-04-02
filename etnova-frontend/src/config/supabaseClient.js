import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
const AUTH_PERSISTENCE_KEY = 'etnova:auth:persistence'

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
}

function getBrowserStorage(kind) {
  if (typeof window === 'undefined') return null
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

function getAuthPersistenceMode() {
  const sessionMode = getBrowserStorage('session')?.getItem(AUTH_PERSISTENCE_KEY)
  if (sessionMode === 'session') return 'session'
  const localMode = getBrowserStorage('local')?.getItem(AUTH_PERSISTENCE_KEY)
  if (localMode === 'local') return 'local'
  return 'local'
}

export function setAuthPersistence(rememberMe) {
  const localStorageRef = getBrowserStorage('local')
  const sessionStorageRef = getBrowserStorage('session')

  if (rememberMe) {
    localStorageRef?.setItem(AUTH_PERSISTENCE_KEY, 'local')
    sessionStorageRef?.removeItem(AUTH_PERSISTENCE_KEY)
    return
  }

  sessionStorageRef?.setItem(AUTH_PERSISTENCE_KEY, 'session')
  localStorageRef?.removeItem(AUTH_PERSISTENCE_KEY)
}

const supabaseAuthStorage = {
  getItem(key) {
    const mode = getAuthPersistenceMode()
    const primary = getBrowserStorage(mode)
    const secondary = getBrowserStorage(mode === 'local' ? 'session' : 'local')
    return primary?.getItem(key) ?? secondary?.getItem(key) ?? null
  },
  setItem(key, value) {
    const mode = getAuthPersistenceMode()
    const primary = getBrowserStorage(mode)
    const secondary = getBrowserStorage(mode === 'local' ? 'session' : 'local')
    primary?.setItem(key, value)
    secondary?.removeItem(key)
  },
  removeItem(key) {
    getBrowserStorage('local')?.removeItem(key)
    getBrowserStorage('session')?.removeItem(key)
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storage: supabaseAuthStorage,
  },
})

export default supabase
