import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { DriverInfo, RideHistoryItem, RideOption } from '../mock/data'
import { customerMockApi } from '../services/mockApi'

type User = {
  id: string
  name: string
  phone: string
}

type ActiveRide = {
  id: string
  pickup: string
  destination: string
  option: RideOption
  driver: DriverInfo | null
  etaMinutes: number
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
  logout: () => void
  loadHistory: () => Promise<void>
  chooseOption: (option: RideOption) => void
  startRide: (pickup: string, destination: string) => Promise<void>
  decreaseEta: () => void
  completeRidePayment: (method: string) => Promise<void>
  submitRating: (stars: number, comment: string) => Promise<void>
}

const CustomerContext = createContext<CustomerContextValue | undefined>(undefined)

export const CustomerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [bootstrapped] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [destination, setDestination] = useState('')
  const [selectedOption, setSelectedOption] = useState<RideOption | null>(null)
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null)
  const [history, setHistory] = useState<RideHistoryItem[]>([])
  const [walletBalance] = useState(450000)

  const login = useCallback(async (identifier: string, otp: string) => {
    if (!identifier.trim() || !otp.trim()) {
      throw new Error('Missing login data')
    }
    const result = await customerMockApi.verifyOtp()
    setAuthenticated(true)
    setUser(result.user)
  }, [])

  const logout = useCallback(() => {
    setAuthenticated(false)
    setUser(null)
    setDestination('')
    setSelectedOption(null)
    setActiveRide(null)
  }, [])

  const loadHistory = useCallback(async () => {
    const items = await customerMockApi.getHistory()
    setHistory(items)
  }, [])

  const chooseOption = useCallback((option: RideOption) => {
    setSelectedOption(option)
  }, [])

  const startRide = useCallback(
    async (pickup: string, destinationValue: string) => {
      if (!selectedOption) throw new Error('No ride option selected')
      const driver = await customerMockApi.findDriver(selectedOption.id)
      setActiveRide({
        id: `ride-${Date.now()}`,
        pickup,
        destination: destinationValue,
        option: selectedOption,
        driver,
        etaMinutes: selectedOption.etaMinutes
      })
    },
    [selectedOption]
  )

  const decreaseEta = useCallback(() => {
    setActiveRide((prev) => (prev ? { ...prev, etaMinutes: Math.max(prev.etaMinutes - 1, 1) } : prev))
  }, [])

  const completeRidePayment = useCallback(
    async (method: string) => {
      if (!activeRide) throw new Error('No active ride')
      await customerMockApi.createPayment(activeRide.id, method)
    },
    [activeRide]
  )

  const submitRating = useCallback(
    async (stars: number, comment: string) => {
      if (!activeRide) throw new Error('No active ride')
      await customerMockApi.submitRating(activeRide.id, stars, comment)

      setHistory((prev) => [
        {
          id: activeRide.id,
          date: new Date().toISOString().slice(0, 16).replace('T', ' '),
          pickup: activeRide.pickup,
          destination: activeRide.destination,
          amount: activeRide.option.price,
          status: 'completed'
        },
        ...prev
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
