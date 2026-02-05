import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { Toast } from '../components/common/Toast'

export type ToastItem = {
  id: string
  message: string
  variant?: 'info' | 'success' | 'danger'
}

type ToastContextValue = {
  push: (message: string, variant?: ToastItem['variant']) => void
  remove: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([])

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const push = useCallback(
    (message: string, variant: ToastItem['variant'] = 'info') => {
      const id = `${Date.now()}_${Math.random()}`
      setItems((prev) => [...prev, { id, message, variant }])
      setTimeout(() => remove(id), 2500)
    },
    [remove]
  )

  const value = useMemo(() => ({ push, remove }), [push, remove])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast items={items} />
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return ctx
}
