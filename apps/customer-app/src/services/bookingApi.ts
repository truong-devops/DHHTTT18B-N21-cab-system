import { apiRequest } from '../lib/api';
import { endpoints } from '../lib/endpoints';
import { createIdempotencyKey } from '../utils/idempotency';

export type BookingVehicleType = 'BIKE' | 'CAR' | 'SUV';

type LatLngAddress = {
  lat: number;
  lng: number;
  address?: string;
};

export type Booking = {
  bookingId?: string | null;
  booking_id?: string | null;
  rideId?: string | null;
  ride_id?: string | null;
  userId?: string | null;
  user_id?: string | null;
  status?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
};

type CreateBookingPayload = {
  pickup: LatLngAddress;
  dropoff: LatLngAddress;
  vehicleType: BookingVehicleType;
};

export type CreateBookingResponse = {
  booking?: Booking | null;
};

export async function createBooking(payload: CreateBookingPayload) {
  return apiRequest<CreateBookingResponse>({
    method: 'POST',
    path: endpoints.booking.create,
    headers: {
      'Idempotency-Key': createIdempotencyKey('booking')
    },
    body: payload
  });
}
