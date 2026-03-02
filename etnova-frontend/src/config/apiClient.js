import supabase from './supabaseClient'

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '')
const GET_CACHE_TTL_MS = 20_000
const responseCache = new Map()
const inflightRequests = new Map()

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Not authenticated')
  return token
}

function getCacheKey(token, url) {
  return `${token}:${url}`
}

function getCachedResponse(cacheKey) {
  const cached = responseCache.get(cacheKey)
  if (!cached) return null
  if (Date.now() > cached.expiresAt) {
    responseCache.delete(cacheKey)
    return null
  }
  return cached.data
}

function setCachedResponse(cacheKey, data) {
  responseCache.set(cacheKey, {
    data,
    expiresAt: Date.now() + GET_CACHE_TTL_MS,
  })
}

function clearApiCache() {
  responseCache.clear()
  inflightRequests.clear()
}

export async function apiRequest(path, options = {}) {
  const token = await getAccessToken()
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
  const method = (options.method || 'GET').toUpperCase()
  const isCacheableGet = method === 'GET' && !options.body && !options.skipCache
  const cacheKey = getCacheKey(token, url)

  if (isCacheableGet) {
    const cached = getCachedResponse(cacheKey)
    if (cached !== null) return cached

    const inflight = inflightRequests.get(cacheKey)
    if (inflight) return inflight
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  }

  const fetchPromise = (async () => {
    let response
    try {
      response = await fetch(url, {
        ...options,
        headers,
        body:
          options.body === undefined || options.body instanceof FormData
            ? options.body
            : JSON.stringify(options.body),
      })
    } catch {
      throw new Error(`API unreachable at ${API_BASE_URL}. Start backend and verify VITE_API_URL.`)
    }

    if (response.status === 204) {
      if (!isCacheableGet) clearApiCache()
      return null
    }

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data?.message || `Request failed (${response.status})`)
    }

    if (isCacheableGet) setCachedResponse(cacheKey, data)
    else clearApiCache()
    return data
  })()

  if (isCacheableGet) inflightRequests.set(cacheKey, fetchPromise)
  try {
    return await fetchPromise
  } finally {
    if (isCacheableGet) inflightRequests.delete(cacheKey)
  }
}

export { clearApiCache }
