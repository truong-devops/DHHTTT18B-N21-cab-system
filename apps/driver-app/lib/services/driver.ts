import { apiRequest } from '../api';
import { endpoints } from '../endpoints';

export type DriverProfileResponse = {
  data: {
    driver: {
      id: string;
      userId: string;
      status: string;
      onlineStatus: string;
      fullName: string;
      phone: string | null;
      createdAt: string;
      updatedAt: string;
    };
    vehicle?: {
      id: string;
      driverId: string;
      vehicleType: string;
      plateNumber: string;
      brand: string;
      model: string;
      color: string;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
    };
    location?: {
      lat: number;
      lng: number;
      heading?: number | null;
      speed?: number | null;
      accuracyM?: number | null;
      recordedAt?: string | null;
    };
  };
};

export async function getMe() {
  return apiRequest<DriverProfileResponse>({
    method: 'GET',
    path: endpoints.driver.me
  });
}

export async function setOnline(lat?: number, lng?: number) {
  const hasInitialLocation = Number.isFinite(lat as number) && Number.isFinite(lng as number);
  return apiRequest({
    method: 'POST',
    path: endpoints.driver.online,
    body: hasInitialLocation ? { initialLocation: { lat, lng } } : {}
  });
}

export async function setOffline() {
  return apiRequest({
    method: 'POST',
    path: endpoints.driver.offline
  });
}

export type DriverLocationPayload = {
  lat: number;
  lng: number;
  heading?: number | null;
  speed?: number | null;
  accuracy?: number | null;
  recordedAt?: string | null;
};

export async function sendLocation(payload: DriverLocationPayload) {
  // Backend validates optional numeric fields as number-only, so skip null/NaN.
  const body: Record<string, unknown> = {
    lat: payload.lat,
    lng: payload.lng
  };
  if (Number.isFinite(payload.heading as number)) body.heading = payload.heading;
  if (Number.isFinite(payload.speed as number)) body.speed = payload.speed;
  if (Number.isFinite(payload.accuracy as number)) body.accuracy = payload.accuracy;
  if (payload.recordedAt) body.recordedAt = payload.recordedAt;

  return apiRequest({
    method: 'POST',
    path: endpoints.driver.location,
    body
  });
}

export async function heartbeat() {
  return apiRequest({
    method: 'POST',
    path: endpoints.driver.heartbeat
  });
}
