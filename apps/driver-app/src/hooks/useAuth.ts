import { authApi } from '../services/authApi'
import { useAuthStore } from '../store/authStore'

export const useAuth = () => {
  const { login, logout, setLoading, accessToken, refreshToken, user } = useAuthStore()

  const loginWithPassword = async (identifier: string, password: string) => {
    setLoading(true)
    try {
      const res = await authApi.login(identifier, password)
      const tokens = res.tokens
      if (!tokens?.accessToken || !tokens?.refreshToken) {
        throw new Error('Missing tokens from server')
      }
      const nextUser = res.user || { id: res.user?.id || res.data?.id || identifier, email: identifier }
      await login(nextUser, tokens.accessToken, tokens.refreshToken)
      return res
    } finally {
      setLoading(false)
    }
  }

  const refresh = async () => {
    if (!refreshToken) throw new Error('Missing refresh token')
    const res = await authApi.refresh(refreshToken)
    const tokens = res.tokens
    if (!tokens?.accessToken || !tokens?.refreshToken) {
      throw new Error('Missing tokens from server')
    }
    const nextUser = res.user || user || { id: 'driver' }
    await login(nextUser, tokens.accessToken, tokens.refreshToken)
    return res
  }

  return {
    accessToken,
    refreshToken,
    user,
    loginWithPassword,
    refresh,
    logout
  }
}
