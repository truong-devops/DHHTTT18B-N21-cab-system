import { getAccessTokenSync, getRefreshTokenSync, setTokens, clearTokens } from './tokenStorage'
import { logService } from '../store/logStore'

export type ApiErrorPayload = {
  status: number
  code?: string
  message?: string
  details?: unknown
  raw?: unknown
}

export class ApiError extends Error {
  status: number
  code?: string
  details?: unknown
  raw?: unknown

  constructor(payload: ApiErrorPayload) {
    super(payload.message || 'Request failed')
    this.status = payload.status
    this.code = payload.code
    this.details = payload.details
    this.raw = payload.raw
  }
}

export type RequestOptions = {
  params?: Record<string, string | number | boolean | undefined | null>
  body?: unknown
  headers?: Record<string, string>
  timeoutMs?: number
  skipAuth?: boolean
  skipRefresh?: boolean
  retry?: boolean
}

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL

let onAuthFailure: (() => void) | null = null
let refreshPromise: Promise<string | null> | null = null

export const getBaseUrl = () => BASE_URL || ''

export const setAuthFailureHandler = (handler: (() => void) | null) => {
  onAuthFailure = handler
}

const buildUrl = (path: string, params?: RequestOptions['params']) => {
  const base = `${BASE_URL}${path}`
  if (!params) return base
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
  return query ? `${base}?${query}` : base
}

const safeParse = (text: string) => {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

const createError = (status: number, data: any) => {
  const err = data?.error || {}
  return new ApiError({
    status,
    code: err.code || data?.code,
    message: err.message || data?.message || 'Request failed',
    details: err.details,
    raw: data
  })
}

const refreshAccessToken = async () => {
  const refreshToken = getRefreshTokenSync()
  if (!refreshToken || !BASE_URL) return null

  const start = Date.now()
  const res = await fetch(`${BASE_URL}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  })

  const durationMs = Date.now() - start
  const text = await res.text()
  const data = safeParse(text)
  const requestId = data?.requestId || data?.meta?.requestId || res.headers.get('x-request-id') || undefined
  const correlationId =
    data?.correlationId || data?.meta?.correlationId || res.headers.get('x-correlation-id') || undefined

  logService.add({
    id: `${Date.now()}-${Math.random()}`,
    time: new Date().toISOString(),
    method: 'POST',
    url: `${BASE_URL}/v1/auth/refresh`,
    status: res.status,
    durationMs,
    requestId,
    correlationId,
    ok: res.ok,
    error: res.ok
      ? undefined
      : {
          status: res.status,
          code: data?.error?.code || data?.code,
          message: data?.error?.message || data?.message,
          body: data
        }
  })

  if (!res.ok) {
    throw createError(res.status, data)
  }

  const tokens = data?.tokens || {}
  const accessToken = tokens.accessToken || tokens.token
  const nextRefresh = tokens.refreshToken || refreshToken
  if (!accessToken) return null
  await setTokens(accessToken, nextRefresh)
  return accessToken
}

const ensureRefresh = async () => {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

export const request = async <T>(method: string, path: string, options: RequestOptions = {}): Promise<T> => {
  if (!BASE_URL) {
    throw new ApiError({ status: 0, code: 'CONFIG_MISSING', message: 'Missing EXPO_PUBLIC_API_BASE_URL' })
  }

  const url = buildUrl(path, options.params)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 15000)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  }

  if (!options.skipAuth) {
    const token = getAccessTokenSync()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const start = Date.now()
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    })

    const durationMs = Date.now() - start
    const text = await res.text()
    const data = safeParse(text)

    const requestId = data?.requestId || data?.meta?.requestId || res.headers.get('x-request-id') || undefined
    const correlationId =
      data?.correlationId || data?.meta?.correlationId || res.headers.get('x-correlation-id') || undefined

    logService.add({
      id: `${Date.now()}-${Math.random()}`,
      time: new Date().toISOString(),
      method,
      url,
      status: res.status,
      durationMs,
      requestId,
      correlationId,
      ok: res.ok,
      error: res.ok
        ? undefined
        : {
            status: res.status,
            code: data?.error?.code || data?.code,
            message: data?.error?.message || data?.message,
            body: data
          }
    })

    if (res.status === 401 && !options.skipRefresh) {
      try {
        const newToken = await ensureRefresh()
        if (newToken && !options.retry) {
          return request<T>(method, path, { ...options, retry: true })
        }
      } catch {
        await clearTokens()
        onAuthFailure?.()
      }
    }

    if (!res.ok) {
      throw createError(res.status, data)
    }

    return data as T
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new ApiError({ status: 0, code: 'TIMEOUT', message: 'Request timeout' })
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, { ...options, body })
}
