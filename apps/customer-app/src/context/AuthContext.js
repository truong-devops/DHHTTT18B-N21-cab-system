import React, { createContext, useMemo, useState } from 'react'

export const AuthContext = createContext(null)

export default function AuthProvider({ children }) {
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)

  const login = (tokenValue, userValue) => {
    setToken(tokenValue)
    setUser(userValue || null)
  }

  const logout = () => {
    setToken(null)
    setUser(null)
  }

  const value = useMemo(
    () => ({ token, user, loading, setLoading, login, logout }),
    [token, user, loading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
