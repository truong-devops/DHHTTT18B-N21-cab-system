import { mockConfig } from '../config'

export type MockSocketEvent =
  | { type: 'nearby_drivers'; count: number }
  | { type: 'match_status'; status: 'searching' | 'found' | 'none'; driverId?: string }
  | { type: 'driver_location'; lat: number; lng: number; etaMinutes: number }

const listeners = new Set<(event: MockSocketEvent) => void>()
let connected = true
let intervalId: ReturnType<typeof setInterval> | null = null

function emit(event: MockSocketEvent) {
  listeners.forEach((cb) => cb(event))
}

function tick() {
  if (!connected) return
  const driverCount = 8 + Math.floor(Math.random() * 12)
  emit({ type: 'nearby_drivers', count: driverCount })

  const eta = Math.max(2, Math.round(3 + Math.random() * 5))
  emit({
    type: 'driver_location',
    lat: 10.77 + Math.random() * 0.01,
    lng: 106.69 + Math.random() * 0.01,
    etaMinutes: eta
  })

  const matchRoll = Math.random()
  if (mockConfig.scenario === 'no_driver') {
    emit({ type: 'match_status', status: 'none' })
  } else if (matchRoll > 0.6) {
    emit({ type: 'match_status', status: 'found', driverId: 'drv-' + Math.floor(Math.random() * 10) })
  } else {
    emit({ type: 'match_status', status: 'searching' })
  }
}

export const mockSocket = {
  connect() {
    if (intervalId) clearInterval(intervalId)
    connected = true
    intervalId = setInterval(tick, 2000 + Math.random() * 1500)
    tick()
  },
  disconnect() {
    connected = false
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  },
  on(cb: (event: MockSocketEvent) => void) {
    listeners.add(cb)
    return () => listeners.delete(cb)
  },
  isConnected: () => connected
}

// auto-connect on import for mock mode
mockSocket.connect()
