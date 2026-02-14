export type RideOption = {
  id: string
  name: string
  etaMinutes: number
  price: number
  capacity: number
  surgeLabel?: string
}

export type DriverInfo = {
  id: string
  name: string
  rating: number
  vehicle: string
  plate: string
}

export type RideHistoryItem = {
  id: string
  date: string
  pickup: string
  destination: string
  amount: number
  status: 'completed' | 'cancelled'
}

export const nearbyDrivers = 12

export const destinations = [
  'IUH Campus 12 Nguyen Van Bao',
  'Tan Son Nhat Airport',
  'Ben Thanh Market',
  'Landmark 81',
  'Saigon Centre'
]

export const rideOptions: RideOption[] = [
  { id: 'bike', name: 'Bike', etaMinutes: 4, price: 32000, capacity: 1 },
  { id: 'car4', name: 'Car 4 Seat', etaMinutes: 6, price: 74000, capacity: 4, surgeLabel: 'x1.2 surge' },
  { id: 'car7', name: 'Car 7 Seat', etaMinutes: 7, price: 98000, capacity: 7 }
]

export const mockDriver: DriverInfo = {
  id: 'driver-01',
  name: 'Tran Minh Hieu',
  rating: 4.9,
  vehicle: 'Toyota Vios',
  plate: '51K-999.88'
}

export const paymentMethods = ['Cash', 'Card', 'Wallet']
