import { request } from './api'

export const getRideById = async (rideId) => {
  const res = await request(`/v1/rides/${rideId}`, {
    method: 'GET',
    mock: () => ({ data: { id: rideId, status: 'requested' } })
  })
  return res.data || res
}

export const listRides = async () => {
  const res = await request('/v1/rides', {
    method: 'GET',
    mock: () => ({ data: [] })
  })
  return res.data || res
}
