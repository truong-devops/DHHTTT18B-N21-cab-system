import { request } from './api'

export const submitReview = (payload) =>
  request('/v1/reviews', {
    method: 'POST',
    body: payload,
    mock: () => ({ data: { id: 'rev_mock' } })
  })
