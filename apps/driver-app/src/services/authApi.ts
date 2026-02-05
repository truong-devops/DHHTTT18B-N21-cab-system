import { api, request } from './api'

export type AuthTokens = {
  accessToken: string
  refreshToken: string
  expiresIn?: string
}

export type AuthResponse = {
  data?: any
  tokens?: AuthTokens
  token?: string
  user?: any
}

const unwrapTokens = (res: AuthResponse) => {
  const tokens = res.tokens || {
    accessToken: res.token || '',
    refreshToken: ''
  }
  return {
    user: res.data || res.user,
    tokens
  }
}

export const authApi = {
  requestOtp: async (identifier: string) => {
    // Backend hiện dùng login trực tiếp; requestOtp gọi login để trả lỗi thật nếu sai
    const res = await api.post<AuthResponse>('/v1/auth/login', { identifier, password: '' })
    return unwrapTokens(res)
  },
  login: async (identifier: string, password: string) => {
    const res = await api.post<AuthResponse>('/v1/auth/login', { identifier, password })
    return unwrapTokens(res)
  },
  verifyOtp: async (identifier: string, otp: string) => {
    const res = await api.post<AuthResponse>('/v1/auth/login', { identifier, password: otp })
    return unwrapTokens(res)
  },
  refresh: async (refreshToken: string) => {
    const res = await request<AuthResponse>('POST', '/v1/auth/refresh', {
      body: { refreshToken },
      skipAuth: true,
      skipRefresh: true
    })
    return unwrapTokens(res)
  },
  me: async () => api.get('/v1/auth/verify')
}
