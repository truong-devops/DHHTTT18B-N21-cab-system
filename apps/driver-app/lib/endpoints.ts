export const endpoints = {
  health: '/health',
  auth: {
    register: '/v1/auth/register',
    login: '/v1/auth/login',
    refresh: '/v1/auth/refresh',
    logout: '/v1/auth/logout',
    verify: '/v1/auth/verify'
  },
  driver: {
    me: '/v1/driver/me',
    online: '/v1/driver/me/online',
    offline: '/v1/driver/me/offline',
    location: '/v1/driver/me/location',
    heartbeat: '/v1/driver/me/heartbeat',
    vehicle: '/v1/driver/me/vehicle'
  },
  ride: {
    list: '/v1/rides',
    assignments: '/v1/rides/assignments',
    detail: (id: string) => `/v1/rides/${id}`,
    summary: (id: string) => `/v1/rides/${id}/summary`,
    update: (id: string) => `/v1/rides/${id}`,
    cancel: (id: string) => `/v1/rides/${id}`,
    create: '/v1/rides'
  },
  payment: {
    list: '/v1/payments',
    detail: (id: string) => `/v1/payments/${id}`,
    vietqr: (id: string) => `/v1/payments/${id}/vietqr-codes`
  }
};

// TODO: If backend adds driver earnings summary endpoint, declare it here.
