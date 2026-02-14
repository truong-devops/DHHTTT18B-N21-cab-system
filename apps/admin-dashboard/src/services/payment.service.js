import { apiRequest, isMock } from './api.service.js'

function buildIdemKey() {
  const uuid = globalThis.crypto?.randomUUID?.()
  return uuid ? `idem_${uuid}` : `idem_${Date.now()}`
}

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

  async create(payload, idempotencyKey, authToken) {
    const idem = idempotencyKey || buildIdemKey()
    const headers = {
      'Idempotency-Key': idem,
    }
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`
    }
    const result = await apiRequest('/v1/payments', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
    return { data: result?.data || null, idempotencyKey: idem }
  },

  async getVietQr(paymentId, authToken) {
    const headers = {}
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`
    }
    const result = await apiRequest(`/v1/payments/${paymentId}/vietqr-codes`, {
      headers,
    })
    return result?.data || null
  },

  async confirmDev(paymentId, authToken) {
    const headers = {}
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`
    }
    const result = await apiRequest(`/v1/payments/${paymentId}/confirm-dev`, {
      method: 'POST',
      headers,
    })
    return result?.data || null
  },
}
