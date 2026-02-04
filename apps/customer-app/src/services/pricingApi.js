import { request } from './api'

export const getQuote = async (payload) => {
  const res = await request('/v1/pricing/quotes', {
    method: 'POST',
    body: payload,
    mock: () => ({ data: { estimatedFare: 32000, currency: 'VND', durationMin: 8 } })
  })
  return res.data || res
}
