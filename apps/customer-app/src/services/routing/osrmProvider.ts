import polyline from '@mapbox/polyline'
import type { LatLng, RouteProfile, RouteResult, RoutingProvider } from './provider'

const DEFAULT_OSRM_BASE = 'https://router.project-osrm.org'

const getProfile = (profile: RouteProfile) => {
  if (profile === 'motorbike') return 'driving'
  return 'driving'
}

export const osrmProvider: RoutingProvider = {
  name: 'osrm',
  async getRoute(origin: LatLng, destination: LatLng, profile: RouteProfile): Promise<RouteResult> {
    const baseUrl = process.env.EXPO_PUBLIC_OSRM_BASE_URL || DEFAULT_OSRM_BASE
    const mode = getProfile(profile)
    const start = `${origin.longitude},${origin.latitude}`
    const end = `${destination.longitude},${destination.latitude}`
    const url = `${baseUrl}/route/v1/${mode}/${start};${end}?overview=full&geometries=polyline`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeout))
    if (!res.ok) {
      throw new Error(`OSRM error ${res.status}`)
    }

    const json = await res.json()
    const route = json?.routes?.[0]
    if (!route?.geometry) {
      throw new Error('OSRM no route geometry')
    }

    const decoded = polyline.decode(route.geometry)
    const coords = decoded.map(([latitude, longitude]) => ({ latitude, longitude }))

    return {
      coords,
      distanceMeters: route.distance,
      durationSeconds: route.duration
    }
  }
}
