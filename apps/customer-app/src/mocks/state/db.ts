import { RideState, PaymentState } from '../../constants/states';
import type { Ride } from '../../services/rideApi';
import type { Payment } from '../../services/paymentApi';

export type MockUser = { id: string; email?: string; username?: string; role?: string };

export const mockUsers: MockUser[] = [{ id: 'user-001', email: 'khach@example.com', username: 'khach', role: 'user' }];

export const mockRides: Ride[] = [];
export const mockPayments: Payment[] = [];

export const mockDrivers = [
  { id: 'drv-01', name: 'Nguyễn Văn Hùng', rating: 4.9, vehicle: 'Yamaha Grande', plate: '59X2-123.45' },
  { id: 'drv-02', name: 'Trần Thị Mai', rating: 4.8, vehicle: 'Toyota Vios', plate: '51H-456.78' },
  { id: 'drv-03', name: 'Lê Hoàng', rating: 4.7, vehicle: 'Kia Seltos', plate: '60A-789.01' }
];

export const mockLocations = [
  { lat: 10.776889, lng: 106.700806, label: 'Quận 1, HCM' },
  { lat: 10.823099, lng: 106.629662, label: 'Gò Vấp, HCM' },
  { lat: 10.820148, lng: 106.68754, label: 'Phú Nhuận, HCM' }
];

export const rideStateDefault = RideState.CREATED;
export const paymentStateDefault = PaymentState.PENDING;
