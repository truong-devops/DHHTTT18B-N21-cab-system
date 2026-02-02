import { createContext, useEffect, useMemo, useState } from 'react'
import { authService } from '../services/auth.service.js'

const AuthContext = createContext(null)

const STORAGE_KEY = 'admin_token'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem(STORAGE_KEY))
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let mounted = true

    async function init() {
      if (!token) {
        setReady(true)
        return
      }

      const result = await authService.me(token)
      if (!mounted) return

      if (result?.user) {
        setUser(result.user)
      } else {
        localStorage.removeItem(STORAGE_KEY)
        setToken(null)
      }
      setReady(true)
    }

    init()
    return () => {
      mounted = false
    }
  }, [token])

  const login = async (payload) => {
    const result = await authService.login(payload)
    if (result?.token) {
      localStorage.setItem(STORAGE_KEY, result.token)
      setToken(result.token)
    }
    if (result?.user) {
      setUser(result.user)
    }
    return result
  }

  const register = async (payload) => authService.register(payload)

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setToken(null)
    setUser(null)
  }

  const hasRole = (roles) => {
    if (!user) return false
    const userRoles = new Set([user.role, ...(user.roles || [])])
    return roles.some((role) => userRoles.has(role))
  }

  const value = useMemo(
    () => ({ user, token, ready, login, register, logout, hasRole }),
    [user, token, ready]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export { AuthContext }
