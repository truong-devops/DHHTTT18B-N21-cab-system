import { apiRequest } from '../lib/api'
import { endpoints } from '../lib/endpoints'
import { mockConfig } from '../mocks/config'
import { mockCreateQuote } from '../mocks/handlers/pricing'

export type LatLng = {
  lat: number
  lng: number
}

export type ServiceType = 'STANDARD' | 'PREMIUM'

export type QuoteData = {
  quoteId: string
  estimatedFare: number
  currency: string
  distanceKm: number
  durationMin: number
  breakdown?: {
    base: number
    perKm: number
    perMin: number
    discount: number
    surge: number
  }
  expiresAt?: string
}

type PricingEnvelope<T> = {
  success: boolean
  data: T
  meta?: {
    requestId?: string | null
    traceId?: string | null
  }
}

export async function createQuote(pickup: LatLng, dropoff: LatLng, serviceType: ServiceType) {
  if (mockConfig.useMockApi) return mockCreateQuote(pickup, dropoff, serviceType)
  return apiRequest<PricingEnvelope<QuoteData>>({
    method: 'POST',
    path: endpoints.pricing.quotes,
    body: { pickup, dropoff, serviceType }
  })
}
