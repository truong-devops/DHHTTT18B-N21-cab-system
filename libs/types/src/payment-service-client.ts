import { paths } from './payment-service';

export type ListPaymentsQuery = NonNullable<paths['/v1/payments']['get']['parameters']['query']>;
export type PaymentListResponse = paths['/v1/payments']['get']['responses']['200']['content']['application/json'];

function buildQuery(params: ListPaymentsQuery = {}) {
  const search = new URLSearchParams();
  if (params.limit != null) {
    search.set('limit', String(params.limit));
  }
  if (params.cursor) {
    search.set('cursor', params.cursor);
  }
  if (params.sort) {
    search.set('sort', params.sort);
  }
  if (params.status) {
    search.set('status', params.status);
  }
  if (params.rideId) {
    search.set('rideId', params.rideId);
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export function createPaymentServiceClient({ baseUrl, fetchImpl = fetch }: { baseUrl: string; fetchImpl?: typeof fetch }) {
  const base = baseUrl.replace(/\/$/, '');

  return {
    async listPayments(query: ListPaymentsQuery = {}, init: RequestInit = {}): Promise<PaymentListResponse> {
      const url = `${base}/v1/payments${buildQuery(query)}`;
      const response = await fetchImpl(url, {
        ...init,
        method: 'GET'
      });
      if (!response.ok) {
        throw new Error(`Payment service error: ${response.status}`);
      }
      return response.json();
    }
  };
}
