export const endpoints = {
  health: '/health',
  auth: {
    register: '/v1/auth/register',
    login: '/v1/auth/login',
    refresh: '/v1/auth/refresh',
    logout: '/v1/auth/logout',
    verify: '/v1/auth/verify'
  },
  pricing: {
    quotes: '/v1/pricing/quotes'
  },
  ride: {
    list: '/v1/rides',
    detail: (id: string) => `/v1/rides/${id}`,
    update: (id: string) => `/v1/rides/${id}`
  },
  payment: {
    list: '/v1/payments',
    create: '/v1/payments',
    detail: (id: string) => `/v1/payments/${id}`,
    vietqr: (id: string) => `/v1/payments/${id}/vietqr-codes`
  },
  review: {
    list: '/v1/reviews',
    create: '/v1/reviews'
  }
}
