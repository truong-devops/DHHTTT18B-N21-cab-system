import { isMock } from './api.service.js'
import { mockMonitoring } from './mock.data.js'
import { driverService } from './driver.service.js'
import { rideService } from './ride.service.js'

export const monitoringService = {
  async getCounters() {
    if (isMock) {
      return mockMonitoring.counters
    }

    const [driversResult, ridesResult] = await Promise.all([
      driverService.list({}),
      rideService.list({ limit: 100 }),
    ])

    const drivers = driversResult.items || []
    const rides = ridesResult.items || []

    const activeDrivers = drivers.filter(
      (driver) => driver.onlineStatus === 'ONLINE'
    ).length
    const busyDrivers = drivers.filter(
      (driver) => driver.onlineStatus === 'BUSY'
    ).length
    const ridesInProgress = rides.filter(
      (ride) => !['completed', 'cancelled'].includes(ride.status)
    ).length
    const alerts = drivers.filter(
      (driver) => driver.status === 'SUSPENDED'
    ).length

    return { activeDrivers, busyDrivers, ridesInProgress, alerts }
  },

  async getMapSnapshot() {
    if (isMock) {
      return mockMonitoring.map
    }

    const [driversResult, ridesResult] = await Promise.all([
      driverService.list({}),
      rideService.list({ limit: 50 }),
    ])

    const driverMarkers = (driversResult.items || [])
      .filter((driver) => driver.location?.lat && driver.location?.lng)
      .map((driver) => ({
        id: driver.id,
        type: 'driver',
        lat: driver.location.lat,
        lng: driver.location.lng,
      }))

    const rideMarkers = (ridesResult.items || [])
      .filter((ride) => ride.pickupLat && ride.pickupLng)
      .map((ride) => ({
        id: ride.id,
        type: 'ride',
        lat: ride.pickupLat,
        lng: ride.pickupLng,
      }))

    return [...driverMarkers, ...rideMarkers].slice(0, 30)
  },
}
