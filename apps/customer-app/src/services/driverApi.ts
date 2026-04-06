import { apiRequest } from '../lib/api'
import { endpoints } from '../lib/endpoints'

type DriverAvailabilityItem = {
  driverId: string
  distanceMeters?: number | null
  location?: {
    lat: number
    lng: number
    recordedAt?: string | null
  } | null
  vehicle?: {
    type?: string | null
    plate?: string | null
  } | null
}

export type DriverAvailabilityResponse = {
  data: {
    count: number
    items: DriverAvailabilityItem[]
  }
}

export async function getDriverAvailability(params: {
  lat: number
  lng: number
  radiusMeters?: number
  limit?: number
}) {
  return apiRequest<DriverAvailabilityResponse>({
    method: 'GET',
    path: endpoints.driver.availability,
    params
  })
}

export type DriverProfileResponse = {
  data: {
    driver: {
      id: string
      userId?: string | null
      fullName?: string | null
      phone?: string | null
      status?: string | null
      onlineStatus?: string | null
    } | null
    vehicle: {
      id: string
      driverId: string
      vehicleType?: string | null
      plateNumber?: string | null
      brand?: string | null
      model?: string | null
      color?: string | null
      isActive?: boolean
    } | null
    location?: {
      lat: number
      lng: number
      recordedAt?: string | null
    } | null
  }
}

export async function getDriverProfileById(driverId: string) {
  return apiRequest<DriverProfileResponse>({
    method: 'GET',
    path: endpoints.drivers.profile(driverId)
  })
}
