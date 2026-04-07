import { latencyMs, mockConfig } from '../config';
import { delay } from '../utils/delay';
import { mockPayments } from '../state/db';
import type { Payment } from '../../services/paymentApi';
import type { PaymentMethod } from '../../services/paymentApi';
import { PaymentState } from '../../constants/states';

export async function mockListPayments(limit = 50) {
  await delay(60);
  return { data: mockPayments.slice(0, limit) };
}

export async function mockCreatePayment(payload: { rideId: string; amount: string; currency: string; method: PaymentMethod }) {
  await delay(latencyMs());
  const status =
    mockConfig.scenario === 'payment_timeout'
      ? PaymentState.TIMEOUT
      : mockConfig.scenario === 'payment_fail'
        ? PaymentState.FAILED
        : PaymentState.SUCCESS;

  const payment: Payment = {
    id: `pay-${Date.now()}`,
    rideId: payload.rideId,
    amount: payload.amount,
    currency: payload.currency,
    status,
    method: payload.method,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  mockPayments.unshift(payment);
  if (status === PaymentState.TIMEOUT) throw new Error('Thanh toán quá thời gian, vui lòng thử lại');
  if (status === PaymentState.FAILED) throw new Error('Thanh toán thất bại');
  return { data: payment };
}
