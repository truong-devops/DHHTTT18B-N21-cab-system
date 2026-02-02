import { apiRequest, isMock } from './api.service.js'
import { mockMonitoring } from './mock.data.js'

export const monitoringService = {
  async getCounters() {
    if (isMock) {
      return mockMonitoring.counters
    }

    const payload = await apiRequest('/v1/monitoring/counters')
    return payload?.data || {}
  },

  async getMapSnapshot() {
    if (isMock) {
      return mockMonitoring.map
    }

    const payload = await apiRequest('/v1/monitoring/map')
    return payload?.data || []
  },
}
