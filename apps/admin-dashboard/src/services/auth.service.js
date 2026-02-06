import { apiRequest, isMock } from './api.service.js'
import { mockUser } from './mock.data.js'

export const authService = {
  async login({ email, password }) {
    if (isMock) {
      return { token: 'mock-token', user: mockUser }
    }

    const payload = await apiRequest('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: email, password }),
    })

    const user = payload?.data
    return {
      token: payload?.tokens?.accessToken,
      user: user
        ? {
            id: user.id,
            email: user.email,
            role: user.role,
            roles: user.roles || [user.role],
          }
        : null,
    }
  },

  async register({ email, password, role = 'admin' }) {
    if (isMock) {
      return { success: true }
    }

    return apiRequest('/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, role }),
    })
  },

  async me(token) {
    if (isMock) {
      return { user: mockUser }
    }

    try {
      const payload = await apiRequest('/v1/auth/verify', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      return {
        user: payload?.data
          ? {
              id: payload.data.userId,
              email: payload.data.email,
              role: payload.data.role,
              roles: payload.data.roles || [payload.data.role],
            }
          : null,
      }
    } catch (error) {
      return null
    }
  },
}
