let authToken = null

export const setAuthToken = (token) => {
  authToken = token
}

const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000'
const mockEnabled = String(process.env.EXPO_PUBLIC_MOCK || '').toLowerCase() === 'true'

export const request = async (path, options = {}) => {
  if (mockEnabled && typeof options.mock === 'function') {
    return options.mock()
  }
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(options.headers || {})
  }
  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (!res.ok) {
    const err = new Error(data?.error?.message || data?.message || 'Request failed')
    err.code = data?.error?.code || data?.code || res.status
    err.details = data?.error?.details || data?.details
    throw err
  }
  return data
}

export const getMockEnabled = () => mockEnabled
