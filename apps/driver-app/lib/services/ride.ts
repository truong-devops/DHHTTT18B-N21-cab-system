import { apiRequest } from '../api';
import { endpoints } from '../endpoints';

export type Ride = {
  id: string;
  externalRideId?: string | null;
  bookingId?: string | null;
  riderId?: string | null;
  driverId?: string | null;
  pickupLat?: number | null;
  pickupLng?: number | null;
  pickupLabel?: string | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  dropoffLabel?: string | null;
  vehicleType?: string | null;
  status: string;
  statusUpdatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type RideListResponse = {
  data: Ride[];
  nextCursor?: string | null;
};

export async function listRequested(limit = 5) {
  return apiRequest<RideListResponse>({
    method: 'GET',
    path: endpoints.ride.list,
    params: { status: 'requested', limit },
  });
}

export async function listAssignments() {
  return apiRequest<RideListResponse>({
    method: 'GET',
    path: endpoints.ride.assignments,
  });
}

type RideListParams = {
  limit?: number;
  cursor?: string;
  status?: string;
  driverId?: string | null;
  riderId?: string | null;
};

export async function listHistory({ limit = 20, cursor, status, driverId, riderId }: RideListParams = {}) {
  return apiRequest<RideListResponse>({
    method: 'GET',
    path: endpoints.ride.list,
    params: {
      limit,
      cursor,
      status: status ? status.toLowerCase() : undefined,
      driverId: driverId ?? undefined,
      riderId: riderId ?? undefined,
    },
  });
}

export async function getRide(id: string) {
  return apiRequest<{ data: Ride }>({
    method: 'GET',
    path: endpoints.ride.detail(id),
  });
}

export async function assignRide(id: string, driverId: string) {
  return apiRequest<{ data: Ride }>({
    method: 'PATCH',
    path: endpoints.ride.update(id),
    body: { driverId, status: 'ASSIGNED' },
  });
}

export async function updateStatus(id: string, status: string) {
  return apiRequest<{ data: Ride }>({
    method: 'PATCH',
    path: endpoints.ride.update(id),
    body: { status },
  });
}

export async function rejectRide(id: string, reason?: string) {
  return apiRequest<{ data: Ride }>({
    method: 'DELETE',
    path: endpoints.ride.cancel(id),
    body: reason ? { reason } : undefined,
  });
}
