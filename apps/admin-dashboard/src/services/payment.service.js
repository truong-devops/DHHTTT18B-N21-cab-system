import { apiRequest, isMock } from './api.service.js'

export const paymentService = {
  async list(params = {}) {
    if (isMock) {
      return { items: [], total: 0 }
    }

    const query = new URLSearchParams(params).toString()
    const payload = await apiRequest(`/v1/payments${query ? `?${query}` : ''}`)
    const items = payload?.data || []
    return { items, total: items.length, nextCursor: payload?.nextCursor || null }
  },
}
