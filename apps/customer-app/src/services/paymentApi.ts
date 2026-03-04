import { apiRequest } from '../lib/api'
import { endpoints } from '../lib/endpoints'
import { createIdempotencyKey } from '../utils/idempotency'

export type Payment = {
  id: string
  rideId: string
  amount: string
  currency: string
  status: string
  createdAt: string
  updatedAt: string
  method?: string | null
}

export type PaymentListResponse = {
  data: Payment[]
  nextCursor?: string | null
}

type PaymentMethod = 'CASH' | 'WALLET' | 'VIETQR'

type CreatePaymentPayload = {
  rideId: string
  amount: string
  currency: string
  method: PaymentMethod
}

export async function listPayments(limit = 50) {
  return apiRequest<PaymentListResponse>({
    method: 'GET',
    path: endpoints.payment.list,
    params: { limit }
  })
}

export async function createPayment(payload: CreatePaymentPayload) {
  return apiRequest<{ data: Payment }>({
    method: 'POST',
    path: endpoints.payment.create,
    headers: {
      'Idempotency-Key': createIdempotencyKey('payment')
    },
    body: payload
  })
}
