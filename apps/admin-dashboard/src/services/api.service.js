const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
export const isMock = import.meta.env.VITE_MOCK === 'true'

function getToken() {
  return localStorage.getItem('admin_token')
}

export async function apiRequest(path, options = {}) {
  const token = getToken()
  const { headers: optionHeaders, cache: optionCache, ...rest } = options
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(optionHeaders || {}),
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: optionCache ?? 'no-store',
    ...rest,
    headers,
  })

  if (response.status === 304) {
    return null
  }

  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    const message =
      payload?.error?.message || payload?.message || 'Request failed'
    const error = new Error(message)
    error.status = response.status
    error.payload = payload
    throw error
  }

  return payload
}
