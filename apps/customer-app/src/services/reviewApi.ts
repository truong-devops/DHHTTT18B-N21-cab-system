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
  tipAmount?: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type ReviewListResponse = {
  data: Review[];
  nextCursor?: string | null;
};

type CreateReviewPayload = {
  rideId: string;
  driverId: string;
  rating: number;
  comment?: string;
  tipAmount?: number;
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

export async function listReviews(limit = 100, cursor?: string) {
  return apiRequest<ReviewListResponse>({
    method: 'GET',
    path: endpoints.review.list,
    params: {
      limit,
      cursor: cursor || undefined
    }
  });
}
