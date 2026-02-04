import { request } from './api'

export const listNotifications = () =>
  request('/v1/notifications', {
    method: 'GET',
    mock: () => ({ data: { items: [] } })
  })
