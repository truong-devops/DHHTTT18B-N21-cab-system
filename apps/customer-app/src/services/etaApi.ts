import { apiRequest } from '../lib/api';
import { endpoints } from '../lib/endpoints';
import type { LatLng } from './pricingApi';

export type EtaEstimateResponse = {
  data: {
    distance_km: number;
    traffic_level: number;
    eta_minutes: number;
  };
};

export async function estimateEta(pickup: LatLng, drop: LatLng) {
  return apiRequest<EtaEstimateResponse>({
    method: 'POST',
    path: endpoints.eta.estimate,
    body: {
      pickup,
      drop
    }
  });
}
