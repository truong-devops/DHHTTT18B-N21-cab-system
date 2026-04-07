import type { QuoteData, ServiceType } from '../../services/pricingApi';
import { mockConfig } from '../config';

export function buildQuote(serviceType: ServiceType): QuoteData {
  const base = serviceType === 'STANDARD' ? 18000 : 30000;
  const distanceKm = 6 + Math.random() * 5;
  const durationMin = 12 + Math.random() * 8;
  const surge = mockConfig.scenario === 'surge' ? 0.35 : mockConfig.scenario === 'overload' ? 0.15 : Math.random() > 0.7 ? 0.2 : 0;

  const fare = Math.round(base + distanceKm * (serviceType === 'STANDARD' ? 8500 : 12000));
  const surgeValue = Math.round(fare * surge);
  const finalFare = fare + surgeValue;

  return {
    quoteId: `quote-${serviceType}-${Date.now()}`,
    estimatedFare: finalFare,
    currency: 'VND',
    distanceKm: Number(distanceKm.toFixed(2)),
    durationMin: Math.round(durationMin),
    breakdown: {
      base,
      perKm: serviceType === 'STANDARD' ? 8500 : 12000,
      perMin: 900,
      discount: 0,
      surge: surgeValue
    },
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
  };
}
