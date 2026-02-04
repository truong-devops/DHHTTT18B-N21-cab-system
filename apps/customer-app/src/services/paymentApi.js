import { request } from './api'

export const createPayment = async (payload) => {
  const res = await request('/v1/payments', {
    method: 'POST',
    body: payload,
    mock: () => ({ data: { id: 'pay_mock', status: 'INITIATED' } })
  })
  return res.data || res
}

export const getPayment = async (id) => {
  const res = await request(`/v1/payments/${id}`, {
    method: 'GET',
    mock: () => ({ data: { id, status: 'INITIATED' } })
  })
  return res.data || res
}

export const getVietQr = async (id) => {
  const res = await request(`/v1/payments/${id}/vietqr-codes`, {
    method: 'GET',
    mock: () => ({ data: { paymentId: id, vietqr: { payload: 'MOCK' } } })
  })
  return res.data || res
}
