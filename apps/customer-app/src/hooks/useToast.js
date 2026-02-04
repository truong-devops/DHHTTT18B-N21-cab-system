import React, { createContext, useContext, useMemo, useState } from 'react'
import { View } from 'react-native'
import Toast from '../components/common/Toast'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])

  const show = (message, variant = 'info') => {
    const id = Date.now().toString()
    setItems((prev) => [...prev, { id, message, variant }])
    setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.id !== id))
    }, 2500)
  }

  const value = useMemo(() => ({ show }), [])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View style={{ position: 'absolute', bottom: 24, left: 16, right: 16 }}>
        {items.map((item) => (
          <Toast key={item.id} message={item.message} variant={item.variant} />
        ))}
      </View>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
