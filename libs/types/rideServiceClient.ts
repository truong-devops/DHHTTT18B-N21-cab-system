import type { paths, RideListResponse } from "./ride-service";

type ListRidesQuery = NonNullable<
  paths["/v1/rides"]["get"]["parameters"]["query"]
>;

type FetchOptions = {
  baseUrl: string;
  headers?: Record<string, string>;
};

export async function listRides(
  query: ListRidesQuery,
  options: FetchOptions
): Promise<RideListResponse> {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.riderId) params.set("riderId", query.riderId);
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.sort) params.set("sort", query.sort);

  const url = new URL("/v1/rides", options.baseUrl);
  url.search = params.toString();

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: options.headers
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as RideListResponse;
}
