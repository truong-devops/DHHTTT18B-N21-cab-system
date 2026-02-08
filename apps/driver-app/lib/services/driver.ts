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
    path: endpoints.driver.me,
  });
}

export async function setOnline(lat?: number, lng?: number) {
  return apiRequest({
    method: 'POST',
    path: endpoints.driver.online,
    body: lat && lng ? { initialLocation: { lat, lng } } : {},
  });
}

export async function setOffline() {
  return apiRequest({
    method: 'POST',
    path: endpoints.driver.offline,
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
  return apiRequest({
    method: 'POST',
    path: endpoints.driver.location,
    body: payload,
  });
}

export async function heartbeat() {
  return apiRequest({
    method: 'POST',
    path: endpoints.driver.heartbeat,
  });
}
