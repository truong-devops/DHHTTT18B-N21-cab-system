import { useEffect, useState } from 'react'
import usePolling from './usePolling'
import { getRideById } from '../services/rideApi'

export default function useRideRealtime(rideId, enabled = true) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const fetcher = async () => {
    if (!rideId) return
    try {
      const res = await getRideById(rideId)
      setData(res)
    } catch (e) {
      setError(e)
    }
  }

  useEffect(() => {
    if (!enabled) return
    fetcher()
  }, [rideId, enabled])

  usePolling(fetcher, enabled ? 3000 : null, [rideId, enabled])

  return { data, error, refresh: fetcher }
}
