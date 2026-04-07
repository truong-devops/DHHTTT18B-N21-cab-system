import type { paths, ReviewListResponse } from './review-service';

type ListReviewsQuery = NonNullable<paths['/v1/reviews']['get']['parameters']['query']>;

type FetchOptions = {
  baseUrl: string;
  headers?: Record<string, string>;
};

export async function listReviews(query: ListReviewsQuery, options: FetchOptions): Promise<ReviewListResponse> {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.riderId) params.set('riderId', query.riderId);
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.cursor) params.set('cursor', query.cursor);
  if (query.sort) params.set('sort', query.sort);

  const url = new URL('/v1/reviews', options.baseUrl);
  url.search = params.toString();

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: options.headers
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as ReviewListResponse;
}
