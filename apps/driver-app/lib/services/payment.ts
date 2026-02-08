import { apiRequest } from '../api';
import { endpoints } from '../endpoints';

export type Payment = {
  id: string;
  rideId: string;
  amount: string;
  currency: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  method: string;
};

export type PaymentListResponse = {
  data: Payment[];
  nextCursor?: string | null;
};

export async function listPayments(limit = 5) {
  return apiRequest<PaymentListResponse>({
    method: 'GET',
    path: endpoints.payment.list,
    params: { limit },
  });
}
