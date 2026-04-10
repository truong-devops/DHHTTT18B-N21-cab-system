import { delay } from '../utils/delay';
import { latencyMs, mockConfig } from '../config';
import type { Review } from '../../services/reviewApi';

export async function mockCreateReview(payload: { rideId: string; driverId: string; rating: number; comment?: string; tipAmount?: number }) {
  await delay(latencyMs());
  if (mockConfig.scenario === 'review_down') {
    throw new Error('Review Service tạm gián đoạn');
  }
  const review: Review = {
    id: `rev-${Date.now()}`,
    rideId: payload.rideId,
    riderId: 'user-001',
    driverId: payload.driverId,
    rating: payload.rating,
    comment: payload.comment || null,
    tipAmount: typeof payload.tipAmount === 'number' ? payload.tipAmount : null,
    status: 'submitted',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  return { data: review };
}
