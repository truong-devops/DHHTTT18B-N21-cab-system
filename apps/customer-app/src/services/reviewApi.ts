import { apiRequest } from '../lib/api'
import { endpoints } from '../lib/endpoints'
import { mockConfig } from '../mocks/config'
import { mockCreateReview } from '../mocks/handlers/review'

export type Review = {
  id: string
  rideId: string
  riderId: string
  driverId: string
  rating: number
  comment?: string | null
  status: string
  createdAt: string
  updatedAt: string
}

type CreateReviewPayload = {
  rideId: string
  driverId: string
  rating: number
  comment?: string
}

export async function createReview(payload: CreateReviewPayload) {
  const keyBase = String(payload.rideId || '').trim() || Date.now().toString()
  if (mockConfig.useMockApi) return mockCreateReview(payload)
  return apiRequest<{ data: Review }>({
    method: 'POST',
    path: endpoints.review.create,
    headers: {
      'Idempotency-Key': `review-${keyBase}`
    },
    body: payload
  })
}
