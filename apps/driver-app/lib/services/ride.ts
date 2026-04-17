import { apiRequest } from '../api';
import { endpoints } from '../endpoints';

export type Ride = {
  id: string;
  externalRideId?: string | null;
  bookingId?: string | null;
  riderId?: string | null;
  driverId?: string | null;
  quoteFareAmount?: number | null;
  quoteCurrency?: string | null;
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

export type RideSummaryFare = {
  amount: number;
  currency: string;
  paymentStatus?: string | null;
  paymentId?: string | null;
  method?: string | null;
  source?: string | null;
};

export type RideSummaryBreakdown = {
  base: number;
  distance: number;
  time: number;
  surge: number;
  discount: number;
  total: number;
};

export type RideSummary = {
  rideId: string;
  status: string;
  distanceMeters: number | null;
  durationSeconds: number | null;
  fare: RideSummaryFare;
  breakdown: RideSummaryBreakdown;
};

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function pickFirstString(candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    const normalized = toNonEmptyString(candidate);
    if (normalized) return normalized;
  }
  return null;
}

function pickFirstNumber(candidates: unknown[]): number | null {
  for (const candidate of candidates) {
    const normalized = toFiniteNumber(candidate);
    if (normalized !== null) return normalized;
  }
  return null;
}

function extractDataObject(payload: any): any {
  if (payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    return payload.data;
  }
  if (payload?.data?.data && typeof payload.data.data === 'object' && !Array.isArray(payload.data.data)) {
    return payload.data.data;
  }
  return payload;
}

function extractDataList(payload: any): any[] {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

export function normalizeRide(raw: any): Ride | null {
  if (!raw || typeof raw !== 'object') return null;

  const pickup = raw.pickup && typeof raw.pickup === 'object' ? raw.pickup : null;
  const dropoff =
    raw.dropoff && typeof raw.dropoff === 'object' ? raw.dropoff : raw.drop && typeof raw.drop === 'object' ? raw.drop : null;

  const id = pickFirstString([raw.id, raw.rideId, raw.ride_id]);
  if (!id) return null;

  return {
    id,
    externalRideId: pickFirstString([raw.externalRideId, raw.external_ride_id]),
    bookingId: pickFirstString([raw.bookingId, raw.booking_id]),
    riderId: pickFirstString([raw.riderId, raw.rider_id]),
    driverId: pickFirstString([raw.driverId, raw.driver_id]),
    quoteFareAmount: pickFirstNumber([raw.quoteFareAmount, raw.quote_fare_amount]),
    quoteCurrency: pickFirstString([raw.quoteCurrency, raw.quote_currency]),
    pickupLat: pickFirstNumber([raw.pickupLat, raw.pickup_lat, pickup?.lat]),
    pickupLng: pickFirstNumber([raw.pickupLng, raw.pickup_lng, pickup?.lng]),
    pickupLabel: pickFirstString([raw.pickupLabel, raw.pickup_label, pickup?.label, pickup?.address]),
    dropoffLat: pickFirstNumber([raw.dropoffLat, raw.dropoff_lat, dropoff?.lat]),
    dropoffLng: pickFirstNumber([raw.dropoffLng, raw.dropoff_lng, dropoff?.lng]),
    dropoffLabel: pickFirstString([raw.dropoffLabel, raw.dropoff_label, dropoff?.label, dropoff?.address]),
    vehicleType: pickFirstString([raw.vehicleType, raw.vehicle_type]),
    status: pickFirstString([raw.status]) || 'requested',
    statusUpdatedAt: pickFirstString([raw.statusUpdatedAt, raw.status_updated_at]) || undefined,
    createdAt: pickFirstString([raw.createdAt, raw.created_at]) || undefined,
    updatedAt: pickFirstString([raw.updatedAt, raw.updated_at]) || undefined
  };
}

function normalizeRideObjectPayload(payload: any) {
  const raw = extractDataObject(payload);
  const normalized = normalizeRide(raw);
  if (normalized) return { data: normalized };
  return payload as { data: Ride };
}

function normalizeRideListPayload(payload: any): RideListResponse {
  const list = extractDataList(payload)
    .map((item) => normalizeRide(item))
    .filter((item): item is Ride => Boolean(item));

  return {
    data: list,
    nextCursor: payload?.nextCursor ?? payload?.data?.nextCursor ?? null
  };
}

function normalizeRideSummaryPayload(payload: any): { data: RideSummary } {
  const raw = extractDataObject(payload);
  const breakdown = raw?.breakdown || {};
  const fare = raw?.fare || {};

  return {
    data: {
      rideId: pickFirstString([raw?.rideId, raw?.ride_id]) || '',
      status: pickFirstString([raw?.status]) || '',
      distanceMeters: pickFirstNumber([raw?.distanceMeters, raw?.distance_meters]),
      durationSeconds: pickFirstNumber([raw?.durationSeconds, raw?.duration_seconds]),
      fare: {
        amount: pickFirstNumber([fare.amount, breakdown.total]) || 0,
        currency: pickFirstString([fare.currency]) || 'VND',
        paymentStatus: pickFirstString([fare.paymentStatus, fare.payment_status]),
        paymentId: pickFirstString([fare.paymentId, fare.payment_id]),
        method: pickFirstString([fare.method]),
        source: pickFirstString([fare.source])
      },
      breakdown: {
        base: pickFirstNumber([breakdown.base]) || 0,
        distance: pickFirstNumber([breakdown.distance]) || 0,
        time: pickFirstNumber([breakdown.time]) || 0,
        surge: pickFirstNumber([breakdown.surge]) || 0,
        discount: pickFirstNumber([breakdown.discount]) || 0,
        total: pickFirstNumber([breakdown.total]) || 0
      }
    }
  };
}

export async function listRequested(limit = 5) {
  const response = await apiRequest<any>({
    method: 'GET',
    path: endpoints.ride.list,
    params: { status: 'requested', limit }
  });
  return normalizeRideListPayload(response);
}

export async function listAssignments() {
  const response = await apiRequest<any>({
    method: 'GET',
    path: endpoints.ride.assignments
  });
  return normalizeRideListPayload(response);
}

type RideListParams = {
  limit?: number;
  cursor?: string;
  status?: string;
  driverId?: string | null;
  riderId?: string | null;
};

export async function listHistory({ limit = 20, cursor, status, driverId, riderId }: RideListParams = {}) {
  const response = await apiRequest<any>({
    method: 'GET',
    path: endpoints.ride.list,
    params: {
      limit,
      cursor,
      status: status ? status.toLowerCase() : undefined,
      driverId: driverId ?? undefined,
      riderId: riderId ?? undefined
    }
  });
  return normalizeRideListPayload(response);
}

export async function getRide(id: string) {
  const response = await apiRequest<any>({
    method: 'GET',
    path: endpoints.ride.detail(id)
  });
  return normalizeRideObjectPayload(response);
}

export async function getRideSummary(id: string) {
  const response = await apiRequest<any>({
    method: 'GET',
    path: endpoints.ride.summary(id)
  });
  return normalizeRideSummaryPayload(response);
}

export async function assignRide(id: string, driverId: string) {
  const response = await apiRequest<any>({
    method: 'PATCH',
    path: endpoints.ride.update(id),
    body: { driverId, status: 'ASSIGNED' }
  });
  return normalizeRideObjectPayload(response);
}

export async function updateStatus(id: string, status: string) {
  const response = await apiRequest<any>({
    method: 'PATCH',
    path: endpoints.ride.update(id),
    body: { status }
  });
  return normalizeRideObjectPayload(response);
}

export async function rejectRide(id: string, reason?: string) {
  const response = await apiRequest<any>({
    method: 'DELETE',
    path: endpoints.ride.cancel(id),
    body: reason ? { reason } : undefined
  });
  return normalizeRideObjectPayload(response);
}
