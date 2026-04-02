import { apiRequest } from '../lib/api'
import { endpoints } from '../lib/endpoints'
import { mockConfig } from '../mocks/config'
import { mockHealth, mockLogin, mockLogout, mockRegister, mockVerify } from '../mocks/handlers/auth'

export type AuthUser = {
  id: string
  email?: string | null
  username?: string | null
  role?: string | null
  status?: string | null
  createdAt?: string | null
}

export type AuthResponse = {
  data: AuthUser
  tokens: {
    accessToken: string
    refreshToken: string
    expiresIn: string
  }
}

export type VerifyResponse = {
  data: {
    userId: string
    role?: string | null
    roles?: string[] | null
  }
}

function parseRegisterPayload(identifier: string, password: string) {
  const normalized = identifier.trim()
  const isEmail = normalized.includes('@')
  return {
    email: isEmail ? normalized : undefined,
    username: isEmail ? undefined : normalized,
    password,
    role: 'user'
  }
}

export async function login(identifier: string, password: string) {
  if (mockConfig.useMockApi) return mockLogin(identifier, password)
  return apiRequest<AuthResponse>({
    method: 'POST',
    path: endpoints.auth.login,
    body: { identifier: identifier.trim(), password },
    auth: false
  })
}

export async function register(identifier: string, password: string) {
  if (mockConfig.useMockApi) return mockRegister(identifier, password)
  return apiRequest<AuthResponse>({
    method: 'POST',
    path: endpoints.auth.register,
    body: parseRegisterPayload(identifier, password),
    auth: false
  })
}

export async function verify() {
  if (mockConfig.useMockApi) return mockVerify()
  return apiRequest<VerifyResponse>({
    method: 'GET',
    path: endpoints.auth.verify
  })
}

export async function logout(refreshToken: string) {
  if (mockConfig.useMockApi) return mockLogout()
  return apiRequest<{ ok: boolean }>({
    method: 'POST',
    path: endpoints.auth.logout,
    body: { refreshToken },
    auth: false,
    retryAuth: false
  })
}

export async function healthCheck() {
  if (mockConfig.useMockApi) return mockHealth()
  return apiRequest<{ ok: boolean }>({
    method: 'GET',
    path: endpoints.health,
    auth: false,
    retryAuth: false
  })
}
