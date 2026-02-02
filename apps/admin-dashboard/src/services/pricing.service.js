import { apiRequest, isMock } from './api.service.js'
import { mockSurgeRules } from './mock.data.js'

export const pricingService = {
  async listRules() {
    if (isMock) {
      return { items: mockSurgeRules }
    }

    const payload = await apiRequest('/v1/pricing/surge-rules')
    return { items: payload?.data || [] }
  },

  async createRule(rule) {
    if (isMock) {
      return { ...rule, id: `s-${Date.now()}` }
    }

    return apiRequest('/v1/pricing/surge-rules', {
      method: 'POST',
      body: JSON.stringify(rule),
    })
  },

  async toggleRule(id, enabled) {
    if (isMock) {
      return { id, status: enabled ? 'ACTIVE' : 'INACTIVE' }
    }

    return apiRequest(`/v1/pricing/surge-rules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    })
  },

  async simulate(payload) {
    if (isMock) {
      return { multiplier: 1.3, estimatedFare: 98000 }
    }

    return apiRequest('/v1/pricing/simulate', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
}
