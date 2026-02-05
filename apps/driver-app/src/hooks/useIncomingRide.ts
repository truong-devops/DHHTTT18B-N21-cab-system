import { useRef, useState } from 'react'
import { usePolling } from './usePolling'
import { rideApi } from '../services/rideApi'

export const useIncomingRide = (enabled: boolean) => {
  const [ride, setRide] = useState<any | null>(null)
  const lastRideId = useRef<string | null>(null)

  const refresh = async () => {
    if (!enabled) return null
    const rides = await rideApi.getIncoming()
    const nextRide = rides?.[0]
    if (!nextRide?.id) return null
    if (lastRideId.current === nextRide.id) return nextRide
    lastRideId.current = nextRide.id
    setRide(nextRide)
    return nextRide
  }

  usePolling(refresh, 2500, enabled)

  return { ride, refresh }
}
