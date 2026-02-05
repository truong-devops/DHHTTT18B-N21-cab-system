import { api } from './api'

export const driverApi = {
  me: async () => api.get('/v1/driver/me'),
  setOnline: async (location?: { lat: number; lng: number }) =>
    api.post('/v1/driver/me/online', location ? { initialLocation: location } : undefined),
  setOffline: async () => api.post('/v1/driver/me/offline'),
  updateLocation: async (location: { lat: number; lng: number }) =>
    api.post('/v1/driver/me/location', location),
  heartbeat: async () => api.post('/v1/driver/me/heartbeat')
}
