import { apiRequest, isMock } from './api.service.js'
import { mockDrivers } from './mock.data.js'

export const driverService = {
  async list(params = {}) {
    if (isMock) {
      const items = mockDrivers.filter((driver) => {
        if (params.status && driver.status !== params.status) return false
        if (params.onlineStatus && driver.onlineStatus !== params.onlineStatus)
          return false
        if (params.vehicleType && driver.vehicleType !== params.vehicleType)
          return false
        return true
      })
      return { items, total: items.length }
    }

    const query = new URLSearchParams(params).toString()
    const payload = await apiRequest(
      `/v1/admin/drivers${query ? `?${query}` : ''}`
    )
    return {
      items: payload?.data?.items || payload?.data || [],
      total: payload?.data?.items?.length || 0,
    }
  },

  async approve(id) {
    if (isMock) {
      return { id, status: 'APPROVED' }
    }

    return apiRequest(`/v1/admin/drivers/${id}/approve`, { method: 'PATCH' })
  },

  async suspend(id) {
    if (isMock) {
      return { id, status: 'SUSPENDED' }
    }

    return apiRequest(`/v1/admin/drivers/${id}/suspend`, { method: 'PATCH' })
  },
}
