import { latencyMs, mockConfig } from '../config'
import { delay } from '../utils/delay'
import { mockDrivers, mockRides, mockLocations } from '../state/db'
import type { Ride } from '../../services/rideApi'
import { RideState } from '../../constants/states'

export async function mockCreateRide(payload: {
  pickupLat: number
  pickupLng: number
  dropoffLat?: number
  dropoffLng?: number
  status?: string
}) {
  await delay(latencyMs())
  const id = `ride-${Date.now()}`
  const ride: Ride = {
    id,
    pickupLat: payload.pickupLat,
    pickupLng: payload.pickupLng,
    dropoffLat: payload.dropoffLat,
    dropoffLng: payload.dropoffLng,
    status: payload.status || RideState.SEARCHING_DRIVER,
    driverId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  mockRides.unshift(ride)
  return { data: ride }
}

export async function mockUpdateRideStatus(id: string, status: string) {
  await delay(120)
  const ride = mockRides.find((r) => r.id === id)
  if (!ride) throw new Error('Ride not found')
  ride.status = status
  ride.updatedAt = new Date().toISOString()
  if (!ride.driverId && status !== RideState.CANCELLED) {
    // assign driver on first meaningful status
    const drv = mockDrivers[Math.floor(Math.random() * mockDrivers.length)]
    ride.driverId = drv.id
  }
  return { data: ride }
}

export async function mockListRides({ limit = 20 }: { limit?: number }) {
  await delay(80)
  return { data: mockRides.slice(0, limit) }
}

export function pickMockLocation() {
  return mockLocations[Math.floor(Math.random() * mockLocations.length)]
}
