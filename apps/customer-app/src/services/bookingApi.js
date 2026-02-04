import { request } from './api'

export const createBooking = async (payload) => {
  const res = await request('/v1/bookings', {
    method: 'POST',
    body: payload,
    mock: () => ({ booking: { bookingId: 'bk_mock', rideId: 'ride_mock', status: 'CREATED' } })
  })
  return res.booking || res
}

export const cancelBooking = async (bookingId) => {
  const res = await request(`/v1/bookings/${bookingId}/cancel`, {
    method: 'POST',
    mock: () => ({ booking: { bookingId, status: 'CANCELED' } })
  })
  return res.booking || res
}
