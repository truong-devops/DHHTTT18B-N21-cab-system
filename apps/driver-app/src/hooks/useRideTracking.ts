import { useEffect, useState } from 'react'
import { usePolling } from './usePolling'
import { rideApi } from '../services/rideApi'

export const useRideTracking = (rideId?: string) => {
  const [ride, setRide] = useState<any | null>(null)

  useEffect(() => {
    if (!rideId) setRide(null)
  }, [rideId])

  usePolling(
    async () => {
      if (!rideId) return
      const res: any = await rideApi.getRide(rideId)
      setRide(res?.data || res)
    },
    2500,
    Boolean(rideId)
  )

  return ride
}
