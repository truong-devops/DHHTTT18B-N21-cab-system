import { apiRequest } from '../lib/api'
import { endpoints } from '../lib/endpoints'
import { createIdempotencyKey } from '../utils/idempotency'
import { mockConfig } from '../mocks/config'
import { mockCreateRide, mockListRides, mockUpdateRideStatus } from '../mocks/handlers/ride'

export type Ride = {
  id: string
  externalRideId?: string | null
  bookingId?: string | null
  riderId?: string | null
  driverId?: string | null
  pickupLat?: number | null
  pickupLng?: number | null
  dropoffLat?: number | null
  dropoffLng?: number | null
  status: string
  statusUpdatedAt?: string
  createdAt?: string
  updatedAt?: string
}

export type RideListResponse = {
  data: Ride[]
  nextCursor?: string | null
}

type CreateRidePayload = {
  pickupLat: number
  pickupLng: number
  dropoffLat?: number
  dropoffLng?: number
  status?: string
}

export async function createRide(payload: CreateRidePayload) {
  if (mockConfig.useMockApi) return mockCreateRide(payload)
  return apiRequest<{ data: Ride }>({
    method: 'POST',
    path: endpoints.ride.list,
    headers: {
      'Idempotency-Key': createIdempotencyKey('ride')
    },
    body: payload
  })
}

type RideListParams = {
  limit?: number
  cursor?: string
  status?: string
  riderId?: string | null
}

export async function listRides({ limit = 20, cursor, status, riderId }: RideListParams = {}) {
  if (mockConfig.useMockApi) return mockListRides({ limit })
  return apiRequest<RideListResponse>({
    method: 'GET',
    path: endpoints.ride.list,
    params: {
      limit,
      cursor,
      status: status ? status.toLowerCase() : undefined,
      riderId: riderId ?? undefined
    }
  })
}

export async function updateRideStatus(id: string, status: string) {
  if (mockConfig.useMockApi) return mockUpdateRideStatus(id, status)
  return apiRequest<{ data: Ride }>({
    method: 'PATCH',
    path: endpoints.ride.update(id),
    body: { status }
  })
}
