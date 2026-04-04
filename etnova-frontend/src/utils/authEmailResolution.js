import { publicApiRequest } from '../config/apiClient'

export async function resolveAuthEmail(loginEmail) {
  const normalized = String(loginEmail || '').trim().toLowerCase()
  if (!normalized) {
    throw new Error('Email is required.')
  }

  try {
    const data = await publicApiRequest('/auth/resolve-email', {
      method: 'POST',
      body: { email: normalized },
    })

    return {
      loginEmail: data?.login_email || normalized,
      authEmail: data?.auth_email || normalized,
    }
  } catch {
    return {
      loginEmail: normalized,
      authEmail: normalized,
    }
  }
}
