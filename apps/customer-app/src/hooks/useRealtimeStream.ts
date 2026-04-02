import { useEffect, useRef, useState } from 'react'
import { mockConfig } from '../mocks/config'
import { mockSocket, type MockSocketEvent } from '../mocks/socket'

const pollIntervalMs = 4000

export const useRealtimeStream = () => {
  const [nearbyDrivers, setNearbyDrivers] = useState(10)
  const [latestEvent, setLatestEvent] = useState<MockSocketEvent | null>(null)
  const poller = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!mockConfig.useMockApi) return

    const unsubscribe = mockSocket.on((event) => {
      setLatestEvent(event)
      if (event.type === 'nearby_drivers') setNearbyDrivers(event.count)
    })

    if (!mockSocket.isConnected()) {
      mockSocket.connect()
    }

    // fallback polling if socket down
    poller.current = setInterval(() => {
      if (!mockSocket.isConnected()) {
        mockSocket.connect()
      }
    }, pollIntervalMs)

    return () => {
      unsubscribe()
      if (poller.current) clearInterval(poller.current)
    }
  }, [])

  return { nearbyDrivers, latestEvent }
}
