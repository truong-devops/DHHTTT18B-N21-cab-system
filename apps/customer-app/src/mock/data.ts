export type RidePriceBreakdown = {
  baseFare: number;
  distanceFee: number;
  timeFee: number;
  surgeFee: number;
  discount: number;
  subtotal: number;
  total: number;
  distanceKm?: number;
  durationMin?: number;
  currency?: string;
};

export type RideOption = {
  id: string;
  name: string;
  etaMinutes: number;
  price: number;
  capacity: number;
  surgeLabel?: string;
  surgeMultiplier?: number;
  vehicleIcon?: 'motorbike.fill' | 'car.fill';
  priceBreakdown?: RidePriceBreakdown;
  quoteId?: string;
  serviceType?: 'STANDARD' | 'PREMIUM';
};

export type DriverInfo = {
  id: string;
  name: string;
  rating?: number | null;
  vehicle?: string | null;
  plate?: string | null;
};

export type RideHistoryItem = {
  id: string;
  date: string;
  pickup: string;
  destination: string;
  amount: number;
  status: 'completed' | 'cancelled';
};

export type LocationPoint = {
  label: string;
  lat: number;
  lng: number;
};

export const nearbyDrivers = 12;

export const pickupPoint: LocationPoint = {
  label: 'Vị trí hiện tại',
  lat: 10.776889,
  lng: 106.700806
};

export const destinationPoints: LocationPoint[] = [
  { label: 'IUH Cơ sở 12 Nguyễn Văn Bảo', lat: 10.822558, lng: 106.686917 },
  { label: 'Sân bay Tân Sơn Nhất', lat: 10.818855, lng: 106.65199 },
  { label: 'Chợ Bến Thành', lat: 10.772477, lng: 106.698025 },
  { label: 'Landmark 81', lat: 10.794142, lng: 106.721979 },
  { label: 'Saigon Centre', lat: 10.773468, lng: 106.700978 }
];

export const destinations = destinationPoints.map((item) => item.label);

export const rideOptions: RideOption[] = [
  { id: 'bike', name: 'Xe máy', etaMinutes: 4, price: 32000, capacity: 1, serviceType: 'STANDARD' },
  {
    id: 'car4',
    name: 'Xe 4 chỗ',
    etaMinutes: 6,
    price: 74000,
    capacity: 4,
    surgeLabel: 'Tăng giá x1.2',
    serviceType: 'STANDARD'
  },
  { id: 'car7', name: 'Xe 7 chỗ', etaMinutes: 7, price: 98000, capacity: 7, serviceType: 'PREMIUM' }
];

export const mockDriver: DriverInfo = {
  id: 'driver-01',
  name: 'Tran Minh Hieu',
  rating: 4.9,
  vehicle: 'Toyota Vios',
  plate: '51K-999.88'
};

export const paymentMethods = ['Tiền mặt', 'Ví', 'VietQR'];
