export type RealtimeEvent =
  | { type: 'nearby_drivers'; count: number }
  | { type: 'match_status'; status: 'searching' | 'found'; driverId?: string }
  | { type: 'driver_location'; lat: number; lng: number; etaMinutes: number }

type Listener = (event: RealtimeEvent) => void

const listeners = new Set<Listener>()
let driverCount = 12

function emit(event: RealtimeEvent) {
  listeners.forEach((listener) => listener(event))
}

function emitLoop() {
  driverCount = Math.max(5, Math.min(28, driverCount + (Math.random() > 0.5 ? 1 : -1)))
  emit({ type: 'nearby_drivers', count: driverCount })

  const eta = Math.max(2, Math.round(2 + Math.random() * 6))
  emit({
    type: 'driver_location',
    lat: 10.77 + Math.random() * 0.01,
    lng: 106.69 + Math.random() * 0.01,
    etaMinutes: eta
  })

  // occasionally emit driver found event
  if (Math.random() > 0.65) {
    emit({ type: 'match_status', status: 'found', driverId: 'driver-' + Math.floor(Math.random() * 1000) })
  } else {
    emit({ type: 'match_status', status: 'searching' })
  }

  setTimeout(emitLoop, 2500 + Math.random() * 2000)
}

emitLoop()

export const realtimeMock = {
  subscribe(callback: Listener) {
    listeners.add(callback)
    return () => listeners.delete(callback)
  },
  emit
}
