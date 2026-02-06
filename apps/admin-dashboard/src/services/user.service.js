import { apiRequest, isMock } from './api.service.js'
import { mockUsers } from './mock.data.js'

export const userService = {
  async list(params = {}) {
    if (isMock) {
      const items = mockUsers.filter((user) => {
        if (params.status && user.status !== params.status) return false
        if (params.role && user.role !== params.role) return false
        if (params.search && !user.email.includes(params.search)) return false
        return true
      })
      return { items, total: items.length }
    }

    const query = new URLSearchParams(params).toString()
    const payload = await apiRequest(`/v1/users${query ? `?${query}` : ''}`)
    return { items: payload?.data || [], total: payload?.data?.length || 0 }
  },

  async updateStatus(id, status) {
    if (isMock) {
      return { id, status }
    }

    return apiRequest(`/v1/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  },
}
