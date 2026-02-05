import { useEffect, useState } from 'react'
import { paymentApi } from '../services/paymentApi'

export const useEarnings = () => {
  const [amount, setAmount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const data: any = await paymentApi.earnings()
      const amountValue = data?.data?.today ?? data?.today ?? data?.amount
      setAmount(typeof amountValue === 'number' ? amountValue : 0)
    } catch (err: any) {
      setError(err?.message || 'Không thể tải thu nhập')
      setAmount(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  return { amount, error, loading, refresh }
}
