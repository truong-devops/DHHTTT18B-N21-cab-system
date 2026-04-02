import { apiRequest } from '../lib/api'
import { endpoints } from '../lib/endpoints'
import { createIdempotencyKey } from '../utils/idempotency'
import { mockConfig } from '../mocks/config'
import { mockCreatePayment, mockListPayments } from '../mocks/handlers/payment'

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

export type PaymentMethod = 'CASH' | 'WALLET' | 'VIETQR'

type CreatePaymentPayload = {
  rideId: string
  amount: string
  currency: string
  method: PaymentMethod
}

export async function listPayments(limit = 50) {
  if (mockConfig.useMockApi) return mockListPayments(limit)
  return apiRequest<PaymentListResponse>({
    method: 'GET',
    path: endpoints.payment.list,
    params: { limit }
  })
}

export async function createPayment(payload: CreatePaymentPayload) {
  if (mockConfig.useMockApi) return mockCreatePayment(payload)
  return apiRequest<{ data: Payment }>({
    method: 'POST',
    path: endpoints.payment.create,
    headers: {
      'Idempotency-Key': createIdempotencyKey('payment')
    },
    body: payload
  })
}
