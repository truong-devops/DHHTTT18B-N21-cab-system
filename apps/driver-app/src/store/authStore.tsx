import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { hydrateTokens, setTokens as persistTokens, clearTokens } from '../services/tokenStorage'
import { setAuthFailureHandler } from '../services/api'

export type AuthUser = {
  id: string
  phone?: string
  name?: string
  role?: string
  email?: string
}

type AuthContextValue = {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  needsKyc: boolean
  loading: boolean
  bootstrapped: boolean
  login: (user: AuthUser, accessToken: string, refreshToken: string) => Promise<void>
  logout: () => Promise<void>
  setLoading: (value: boolean) => void
  completeKyc: () => void
  setNeedsKyc: (value: boolean) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState<string | null>(null)
  const [needsKyc, setNeedsKyc] = useState(false)
  const [loading, setLoading] = useState(false)
  const [bootstrapped, setBootstrapped] = useState(false)

  useEffect(() => {
    setAuthFailureHandler(() => {
      void logout()
    })
  }, [])

  useEffect(() => {
    const bootstrap = async () => {
      const tokens = await hydrateTokens()
      setAccessToken(tokens.accessToken)
      setRefreshToken(tokens.refreshToken)
      setBootstrapped(true)
    }
    bootstrap()
  }, [])

  const login = async (nextUser: AuthUser, nextAccess: string, nextRefresh: string) => {
    setUser(nextUser)
    setAccessToken(nextAccess)
    setRefreshToken(nextRefresh)
    await persistTokens(nextAccess, nextRefresh)
    setNeedsKyc(true)
  }

  const logout = async () => {
    setUser(null)
    setAccessToken(null)
    setRefreshToken(null)
    setNeedsKyc(false)
    await clearTokens()
  }

  const completeKyc = () => {
    setNeedsKyc(false)
  }

  const value = useMemo(
    () => ({
      user,
      accessToken,
      refreshToken,
      needsKyc,
      loading,
      bootstrapped,
      login,
      logout,
      setLoading,
      completeKyc,
      setNeedsKyc
    }),
    [user, accessToken, refreshToken, needsKyc, loading, bootstrapped]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuthStore = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuthStore must be used within AuthProvider')
  }
  return ctx
}
