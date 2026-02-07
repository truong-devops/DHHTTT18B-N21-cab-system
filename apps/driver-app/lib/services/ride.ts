import { apiRequest } from '../api';

export type Ride = {
  id: string;
  externalRideId?: string | null;
  bookingId?: string | null;
  riderId?: string | null;
  driverId?: string | null;
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
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
    path: '/v1/rides',
    params: { status: 'requested', limit },
  });
}

export async function listHistory(limit = 20) {
  return apiRequest<RideListResponse>({
    method: 'GET',
    path: '/v1/rides',
    params: { limit },
  });
}

export async function getRide(id: string) {
  return apiRequest<{ data: Ride }>({
    method: 'GET',
    path: `/v1/rides/${id}`,
  });
}

export async function assignRide(id: string, driverId: string) {
  return apiRequest<{ data: Ride }>({
    method: 'PATCH',
    path: `/v1/rides/${id}`,
    body: { driverId, status: 'ASSIGNED' },
  });
}

export async function updateStatus(id: string, status: string) {
  return apiRequest<{ data: Ride }>({
    method: 'PATCH',
    path: `/v1/rides/${id}`,
    body: { status },
  });
}

export async function rejectRide(id: string, reason?: string) {
  return apiRequest<{ data: Ride }>({
    method: 'DELETE',
    path: `/v1/rides/${id}`,
    body: reason ? { reason } : undefined,
  });
}
