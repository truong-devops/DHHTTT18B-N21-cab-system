import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { DriverInfo, RideHistoryItem, RideOption } from '../mock/data'
import { setOnAuthFailure } from '../lib/api'
import { clearTokens, getRefreshToken, hydrateTokens, setTokens } from '../lib/token-store'
import * as authApi from '../services/authApi'
import { customerApi } from '../services/customerApi'
import * as userApi from '../services/userApi'

type User = {
  id: string
  name: string
  phone: string
  email?: string | null
}

type ActiveRide = {
  id: string
  pickup: string
  destination: string
  option: RideOption
  driver: DriverInfo | null
  etaMinutes: number
  driverId?: string
}

type CustomerContextValue = {
  bootstrapped: boolean
  authenticated: boolean
  user: User | null
  destination: string
  selectedOption: RideOption | null
  activeRide: ActiveRide | null
  history: RideHistoryItem[]
  walletBalance: number
  setDestination: (destination: string) => void
  login: (identifier: string, otp: string) => Promise<void>
  logout: () => Promise<void>
  loadHistory: () => Promise<void>
  updateProfile: (data: Partial<Pick<User, 'name' | 'email' | 'phone'>>) => Promise<void>
  chooseOption: (option: RideOption) => void
  startRide: (pickup: string, destination: string) => Promise<void>
  decreaseEta: () => void
  completeRidePayment: (method: string) => Promise<void>
  submitRating: (stars: number, comment: string) => Promise<void>
}

const CustomerContext = createContext<CustomerContextValue | undefined>(undefined)

export const CustomerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [bootstrapped, setBootstrapped] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [destination, setDestination] = useState('')
  const [selectedOption, setSelectedOption] = useState<RideOption | null>(null)
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null)
  const [history, setHistory] = useState<RideHistoryItem[]>([])
  const [walletBalance] = useState(450000)

  const resetState = useCallback(() => {
    setAuthenticated(false)
    setUser(null)
    setDestination('')
    setSelectedOption(null)
    setActiveRide(null)
    setHistory([])
  }, [])

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken()
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken)
      } catch {
        // ignore logout failures during client cleanup
      }
    }

    await clearTokens()
    resetState()
  }, [resetState])

  const syncUserFromProfile = useCallback(async (identifier: string, userId: string) => {
    try {
      const profile = await userApi.getUserById(userId)
      setAuthenticated(true)
      setUser({
        id: profile.data.id,
        name: profile.data.fullName || identifier,
        phone: profile.data.phone || (identifier.includes('@') ? 'Không có' : identifier),
        email: profile.data.email
      })
    } catch {
      setAuthenticated(true)
      setUser({
        id: userId,
        name: identifier,
        phone: identifier.includes('@') ? 'Không có' : identifier
      })
    }
  }, [])

  const login = useCallback(
    async (identifier: string, otp: string) => {
      const normalizedIdentifier = typeof identifier === 'string' ? identifier.trim() : ''
      const normalizedCredential = typeof otp === 'string' ? otp.trim() : ''
      if (!normalizedIdentifier) {
        throw new Error('Thiếu số điện thoại/email.')
      }
      if (!normalizedCredential) {
        throw new Error('Thiếu OTP/mật khẩu.')
      }

      const result = await customerApi.verifyOtp(normalizedIdentifier, normalizedCredential)
      await setTokens(result.accessToken, result.refreshToken)

      try {
        const verified = await authApi.verify()
        await syncUserFromProfile(result.user.name, verified.data.userId)
      } catch {
        setAuthenticated(true)
        setUser(result.user)
      }
    },
    [syncUserFromProfile]
  )

  useEffect(() => {
    setOnAuthFailure(() => {
      void logout()
    })
    return () => setOnAuthFailure(null)
  }, [logout])

  useEffect(() => {
    let mounted = true

    hydrateTokens()
      .then(async ({ accessToken }) => {
        if (!mounted || !accessToken) return

        try {
          const verified = await authApi.verify()
          if (!mounted) return
          await syncUserFromProfile('Khách hàng', verified.data.userId)
        } catch {
          await clearTokens()
          if (mounted) {
            resetState()
          }
        }
      })
      .finally(() => {
        if (mounted) {
          setBootstrapped(true)
        }
      })

    return () => {
      mounted = false
    }
  }, [resetState, syncUserFromProfile])

  const loadHistory = useCallback(async () => {
    if (!user?.id) {
      setHistory([])
      return
    }
    const items = await customerApi.getHistory(user.id)
    setHistory(items)
  }, [user?.id])

  const chooseOption = useCallback((option: RideOption) => {
    setSelectedOption(option)
  }, [])

  const updateProfile = useCallback(
    async (data: Partial<Pick<User, 'name' | 'email' | 'phone'>>) => {
      if (!user?.id) throw new Error('Không tìm thấy user')
      const updated = await userApi.updateUser(user.id, {
        fullName: data.name ?? user.name,
        email: data.email ?? user.email ?? undefined,
        phone: data.phone ?? user.phone
      })
      setUser({
        id: updated.data.id,
        name: updated.data.fullName || user.name,
        phone: updated.data.phone || user.phone,
        email: updated.data.email || user.email
      })
    },
    [user]
  )

  const startRide = useCallback(
    async (pickup: string, destinationValue: string) => {
      if (!selectedOption) {
        throw new Error('Chưa chọn loại xe')
      }

      const result = await customerApi.startRide({
        pickupLabel: pickup,
        destinationLabel: destinationValue,
        option: selectedOption
      })

      setActiveRide({
        id: result.ride.id,
        pickup,
        destination: destinationValue,
        option: selectedOption,
        driver: result.driver,
        etaMinutes: selectedOption.etaMinutes,
        driverId: result.ride.driverId || result.ride.id
      })
    },
    [selectedOption]
  )

  const decreaseEta = useCallback(() => {
    setActiveRide((prev) => (prev ? { ...prev, etaMinutes: Math.max(prev.etaMinutes - 1, 1) } : prev))
  }, [])

  const completeRidePayment = useCallback(
    async (method: string) => {
      if (!activeRide) throw new Error('Không có chuyến đi đang hoạt động')
      await customerApi.createPayment(activeRide.id, method, activeRide.option.price)
    },
    [activeRide]
  )

  const submitRating = useCallback(
    async (stars: number, comment: string) => {
      if (!activeRide) throw new Error('Không có chuyến đi đang hoạt động')

      await customerApi.submitRating(activeRide.id, activeRide.driverId, stars, comment)

      setHistory((prev) => [
        {
          id: activeRide.id,
          date: new Date().toISOString().slice(0, 16).replace('T', ' '),
          pickup: activeRide.pickup,
          destination: activeRide.destination,
          amount: activeRide.option.price,
          status: 'completed'
        },
        ...prev.filter((item) => item.id !== activeRide.id)
      ])

      setSelectedOption(null)
      setActiveRide(null)
      setDestination('')
    },
    [activeRide]
  )

  const value = useMemo(
    () => ({
      bootstrapped,
      authenticated,
      user,
      destination,
      selectedOption,
      activeRide,
      history,
      walletBalance,
      setDestination,
      login,
      logout,
      loadHistory,
      updateProfile,
      chooseOption,
      startRide,
      decreaseEta,
      completeRidePayment,
      submitRating
    }),
    [
      bootstrapped,
      authenticated,
      user,
      destination,
      selectedOption,
      activeRide,
      history,
      walletBalance,
      login,
      logout,
      loadHistory,
      updateProfile,
      chooseOption,
      startRide,
      decreaseEta,
      completeRidePayment,
      submitRating
    ]
  )

  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>
}

export const useCustomerStore = () => {
  const ctx = useContext(CustomerContext)
  if (!ctx) throw new Error('useCustomerStore must be used inside CustomerProvider')
  return ctx
}
