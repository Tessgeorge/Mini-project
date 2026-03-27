import supabase from './supabaseClient'

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '')
const API_FALLBACK_BASE_URL = API_BASE_URL.includes('localhost')
  ? API_BASE_URL.replace('localhost', '127.0.0.1')
  : null
const GET_CACHE_TTL_MS = 20_000
const responseCache = new Map()
const inflightRequests = new Map()

async function getAccessToken({ forceRefresh = false } = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')

  if (!forceRefresh) {
    return session.access_token
  }

  const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession()
  if (refreshError || !refreshedData?.session?.access_token) {
    throw new Error('Session expired. Please sign in again.')
  }
  return refreshedData.session.access_token
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

async function fetchJson(url, fetchOptions, headers) {
  return fetch(url, {
    ...fetchOptions,
    headers,
    body:
      fetchOptions.body === undefined || fetchOptions.body instanceof FormData
        ? fetchOptions.body
        : JSON.stringify(fetchOptions.body),
  })
}

export async function apiRequest(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
  const {
    skipCache = false,
    headers: customHeaders = {},
    __retry401 = false,
    ...fetchOptions
  } = options

  let token = await getAccessToken()
  const method = (fetchOptions.method || 'GET').toUpperCase()
  const isCacheableGet = method === 'GET' && !fetchOptions.body && !skipCache
  const cacheKey = getCacheKey(token, url)

  if (isCacheableGet) {
    const cached = getCachedResponse(cacheKey)
    if (cached !== null) return cached

    const inflight = inflightRequests.get(cacheKey)
    if (inflight) return inflight
  }

  const requestWithToken = async (accessToken) => {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      ...(fetchOptions.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...customHeaders,
    }

    let response
    try {
      response = await fetchJson(url, fetchOptions, headers)
    } catch (primaryError) {
      if (API_FALLBACK_BASE_URL && !path.startsWith('http')) {
        const fallbackUrl = `${API_FALLBACK_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
        try {
          response = await fetchJson(fallbackUrl, fetchOptions, headers)
        } catch {
          throw new Error(`API unreachable at ${API_BASE_URL} or ${API_FALLBACK_BASE_URL}. Start backend with "npm run dev" in etnova-backend and verify VITE_API_URL.`)
        }
      } else {
        throw new Error(`API unreachable at ${API_BASE_URL}. Start backend with "npm run dev" in etnova-backend and verify VITE_API_URL.`)
      }
    }

    if (response.status === 204) {
      return null
    }

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      const error = new Error(data?.message || `Request failed (${response.status})`)
      error.status = response.status
      throw error
    }

    return data
  }

  const fetchPromise = (async () => {
    try {
      const data = await requestWithToken(token)
      if (isCacheableGet) setCachedResponse(cacheKey, data)
      else clearApiCache()
      return data
    } catch (error) {
      if (error?.status === 401 && !__retry401) {
        try {
          token = await getAccessToken({ forceRefresh: true })
          const retryData = await requestWithToken(token)
          if (isCacheableGet) setCachedResponse(cacheKey, retryData)
          else clearApiCache()
          return retryData
        } catch {
          clearApiCache()
          await supabase.auth.signOut()
          throw new Error('Session expired. Please sign in again.')
        }
      }

      throw error
    }
  })()

  if (isCacheableGet) inflightRequests.set(cacheKey, fetchPromise)
  try {
    return await fetchPromise
  } finally {
    if (isCacheableGet) inflightRequests.delete(cacheKey)
  }
}

export { clearApiCache }
