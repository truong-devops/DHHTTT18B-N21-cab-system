import { apiRequest, isMock } from './api.service.js'
import { mockRides } from './mock.data.js'

export const rideService = {
  async list(params = {}) {
    if (isMock) {
      const items = mockRides.filter((ride) => {
        if (params.status && ride.status !== params.status) return false
        return true
      })
      return { items, total: items.length }
    }

    const query = new URLSearchParams(params).toString()
    const payload = await apiRequest(`/v1/rides${query ? `?${query}` : ''}`)
    return { items: payload?.data || [], total: payload?.data?.length || 0 }
  },
}
