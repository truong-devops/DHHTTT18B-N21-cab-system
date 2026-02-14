import { apiRequest, isMock } from './api.service.js'
import { mockSurgeRules } from './mock.data.js'

const unwrap = (payload) => payload?.data ?? payload

export const pricingService = {
  async listRules() {
    if (isMock) {
      return { items: mockSurgeRules }
    }

    const payload = await apiRequest('/v1/pricing/surge-rules')
    const data = unwrap(payload)
    const items = Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data)
        ? data
        : []
    return { items }
  },

  async createRule(rule) {
    if (isMock) {
      return { ...rule, id: `s-${Date.now()}` }
    }

    const payload = await apiRequest('/v1/pricing/surge-rules', {
      method: 'POST',
      body: JSON.stringify(rule),
    })
    return unwrap(payload)
  },

  async toggleRule(id, enabled) {
    if (isMock) {
      return { id, status: enabled ? 'ACTIVE' : 'INACTIVE' }
    }

    const payload = await apiRequest(`/v1/pricing/surge-rules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    })
    return unwrap(payload)
  },

  async simulate(payload) {
    if (isMock) {
      return { multiplier: 1.3, estimatedFare: 98000 }
    }

    const response = await apiRequest('/v1/pricing/simulate', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return unwrap(response)
  },
}
