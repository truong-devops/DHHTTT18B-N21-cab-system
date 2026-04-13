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

type ListPaymentsOptions = {
  limit?: number;
  rideId?: string | null;
  status?: string | null;
};

export async function listPayments({ limit = 5, rideId, status }: ListPaymentsOptions = {}) {
  return apiRequest<PaymentListResponse>({
    method: 'GET',
    path: endpoints.payment.list,
    params: {
      limit,
      rideId: rideId ?? undefined,
      status: status ?? undefined
    }
  });
}

function normalizeRideIds(rideIds: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      rideIds
        .map((rideId) => (typeof rideId === 'string' ? rideId.trim() : ''))
        .filter((rideId) => Boolean(rideId))
    )
  );
}

function hasPositiveAmount(payment: Payment | null | undefined) {
  const amount = Number(payment?.amount);
  return Number.isFinite(amount) && amount > 0;
}

export async function getLatestPaymentByRideIds(rideIds: Array<string | null | undefined>) {
  const candidates = normalizeRideIds(rideIds);
  if (!candidates.length) return null;

  for (const rideId of candidates) {
    const res = await listPayments({ rideId, limit: 1, status: 'PAID' });
    const paid = Array.isArray(res?.data) ? res.data[0] : null;
    if (hasPositiveAmount(paid)) return paid;
  }

  for (const rideId of candidates) {
    const fallback = await listPayments({ rideId, limit: 1 });
    const payment = Array.isArray(fallback?.data) ? fallback.data[0] : null;
    if (hasPositiveAmount(payment)) return payment;
  }

  return null;
}

export async function getLatestPaymentByRideId(rideId: string) {
  return getLatestPaymentByRideIds([rideId]);
}
