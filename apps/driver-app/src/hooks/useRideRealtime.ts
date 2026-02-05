import { useEffect, useState } from 'react'
import { usePolling } from './usePolling'
import { rideApi } from '../services/rideApi'

export type RealtimeSnapshot = {
  etaMinutes?: number
  distanceKm?: number
  price?: number
  status?: string
}

export const useRideRealtime = (rideId?: string) => {
  const [snapshot, setSnapshot] = useState<RealtimeSnapshot | null>(null)

  useEffect(() => {
    if (!rideId) setSnapshot(null)
  }, [rideId])

  usePolling(
    async () => {
      if (!rideId) return
      const ride: any = await rideApi.getRide(rideId)
      const data = ride?.data || ride
      setSnapshot({
        status: data?.status,
        // Nếu BE chưa trả ETA/price thì UI sẽ hiển thị placeholder
        etaMinutes: data?.etaMinutes,
        distanceKm: data?.distanceKm,
        price: data?.price
      })
    },
    2500,
    Boolean(rideId)
  )

  return snapshot
}
