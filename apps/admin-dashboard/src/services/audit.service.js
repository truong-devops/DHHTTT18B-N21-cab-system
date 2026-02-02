import { apiRequest, isMock } from './api.service.js'
import { mockAudits, mockLogs } from './mock.data.js'

export const auditService = {
  async listLogs(params = {}) {
    if (isMock) {
      return { items: mockLogs, total: mockLogs.length }
    }

    const query = new URLSearchParams(params).toString()
    const payload = await apiRequest(`/v1/logs${query ? `?${query}` : ''}`)
    return { items: payload?.data || [], total: payload?.data?.length || 0 }
  },

  async listAudits(params = {}) {
    if (isMock) {
      return { items: mockAudits, total: mockAudits.length }
    }

    const query = new URLSearchParams(params).toString()
    const payload = await apiRequest(`/v1/audits${query ? `?${query}` : ''}`)
    return { items: payload?.data || [], total: payload?.data?.length || 0 }
  },
}
