import { request } from './api'

export const getProfile = async () => {
  const res = await request('/v1/users/me', {
    method: 'GET',
    mock: () => ({ data: { id: 'u1', fullName: 'Mock User' } })
  })
  return res.data || res
}

export const updateProfile = async (payload) => {
  const res = await request('/v1/users/me', {
    method: 'PATCH',
    body: payload,
    mock: () => ({ data: payload })
  })
  return res.data || res
}
