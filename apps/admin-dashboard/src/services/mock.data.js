export const mockUser = {
  id: 'admin-1',
  email: 'admin@test.com',
  role: 'admin',
  roles: ['admin'],
}

export const mockUsers = [
  {
    id: 'u-101',
    email: 'user1@test.com',
    fullName: 'Alex Rider',
    phone: '0900000001',
    role: 'customer',
    status: 'ACTIVE',
  },
  {
    id: 'u-102',
    email: 'driver1@test.com',
    fullName: 'Driver One',
    phone: '0900000002',
    role: 'driver',
    status: 'ACTIVE',
  },
  {
    id: 'u-103',
    email: 'ops@test.com',
    fullName: 'Ops Manager',
    phone: '0900000003',
    role: 'ops',
    status: 'SUSPENDED',
  },
]

export const mockDrivers = [
  {
    id: 'd-201',
    userId: 'u-102',
    fullName: 'Driver One',
    status: 'APPROVED',
    onlineStatus: 'ONLINE',
    vehicleType: 'CAR',
    plateNumber: '51A-12345',
    lastLocation: { lat: 10.76, lng: 106.66 },
  },
  {
    id: 'd-202',
    userId: 'u-104',
    fullName: 'Driver Two',
    status: 'PENDING',
    onlineStatus: 'OFFLINE',
    vehicleType: 'BIKE',
    plateNumber: '59X-88888',
    lastLocation: { lat: 10.77, lng: 106.67 },
  },
]

export const mockRides = [
  {
    id: 'r-301',
    status: 'completed',
    rider: 'Alex Rider',
    driver: 'Driver One',
    pickup: 'District 1',
    dropoff: 'District 3',
    fare: 85000,
    paymentStatus: 'success',
  },
  {
    id: 'r-302',
    status: 'cancelled',
    rider: 'Sarah',
    driver: 'Driver Two',
    pickup: 'District 5',
    dropoff: 'District 2',
    fare: 0,
    paymentStatus: 'failed',
  },
]

export const mockSurgeRules = [
  {
    id: 's-401',
    name: 'Airport Peak',
    multiplier: 1.5,
    status: 'ACTIVE',
    zone: 'Airport',
  },
  {
    id: 's-402',
    name: 'Late Night',
    multiplier: 1.2,
    status: 'INACTIVE',
    zone: 'All',
  },
]

export const mockLogs = [
  {
    id: 'log-1',
    service: 'driver-service',
    level: 'INFO',
    message: 'Driver approved',
    requestId: 'req-1001',
    timestamp: '2026-02-02T02:00:00Z',
  },
  {
    id: 'log-2',
    service: 'ride-service',
    level: 'WARN',
    message: 'Ride delayed',
    requestId: 'req-1002',
    timestamp: '2026-02-02T02:05:00Z',
  },
]

export const mockAudits = [
  {
    id: 'audit-1',
    actor: 'admin@test.com',
    action: 'APPROVE_DRIVER',
    target: 'Driver One',
    timestamp: '2026-02-02T02:10:00Z',
  },
  {
    id: 'audit-2',
    actor: 'ops@test.com',
    action: 'UPDATE_SURGE',
    target: 'Airport Peak',
    timestamp: '2026-02-02T02:12:00Z',
  },
]

export const mockMonitoring = {
  counters: {
    activeDrivers: 128,
    busyDrivers: 42,
    ridesInProgress: 36,
    alerts: 3,
  },
  map: [
    { id: 'd-201', type: 'driver', lat: 10.76, lng: 106.66 },
    { id: 'r-301', type: 'ride', lat: 10.765, lng: 106.664 },
  ],
}
