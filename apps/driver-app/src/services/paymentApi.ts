import { api } from './api'

export const paymentApi = {
  earnings: async () => api.get('/v1/payments/driver/earnings')
}
