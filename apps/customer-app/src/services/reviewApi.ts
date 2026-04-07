import { apiRequest } from '../lib/api';
import { endpoints } from '../lib/endpoints';
import { createIdempotencyKey } from '../utils/idempotency';

export type Review = {
  id: string;
  rideId: string;
  riderId: string;
  driverId: string;
  rating: number;
  comment?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type CreateReviewPayload = {
  rideId: string;
  driverId: string;
  rating: number;
  comment?: string;
};

export async function createReview(payload: CreateReviewPayload) {
  const rideIdPart = String(payload.rideId || '').trim() || 'ride';
  const idempotencyKey = createIdempotencyKey(`review-${rideIdPart}`);
  return apiRequest<{ data: Review }>({
    method: 'POST',
    path: endpoints.review.create,
    headers: {
      'Idempotency-Key': idempotencyKey
    },
    body: payload
  });
}
