import { api } from './api'

export const rideApi = {
  getIncoming: async () => {
    const res: any = await api.get('/v1/rides?status=requested')
    return Array.isArray(res?.data) ? res.data : res?.data ? [res.data] : []
  },
  getRide: async (rideId: string) => api.get(`/v1/rides/${rideId}`),
  accept: async (rideId: string, driverId: string) =>
    api.patch(`/v1/rides/${rideId}`, { driverId, status: 'ASSIGNED' }),
  reject: async (rideId: string) => api.patch(`/v1/rides/${rideId}`, { status: 'CANCELED' }),
  updateStatus: async (rideId: string, status: string) => api.patch(`/v1/rides/${rideId}`, { status }),
  history: async () => api.get('/v1/rides?limit=20')
}
