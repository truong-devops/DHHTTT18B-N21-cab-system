import { latencyMs, mockConfig } from '../config';
import { delay } from '../utils/delay';
import { buildQuote } from '../factories/quote';
import type { LatLng, ServiceType } from '../../services/pricingApi';

export async function mockCreateQuote(_pickup: LatLng, _dropoff: LatLng, serviceType: ServiceType) {
  await delay(latencyMs());
  if (mockConfig.scenario === 'pricing_down') {
    throw new Error('Pricing Service tạm quá tải, thử lại sau');
  }
  const data = buildQuote(serviceType);
  return { success: true, data, meta: { requestId: `mock-${Date.now()}` } };
}
