import { request } from './api'

export const login = ({ identifier, password }) =>
  request('/v1/auth/login', {
    method: 'POST',
    body: { identifier, password },
    mock: () => ({
      tokens: { accessToken: 'mock-token' },
      data: { id: 'u1', email: identifier }
    })
  })

export const verifyOtp = () =>
  Promise.resolve({ tokens: { accessToken: 'mock-token' }, data: { id: 'u1' } })
