import type { ApiError } from '../lib/api';
import { apiRequest } from '../lib/api';
import { endpoints } from '../lib/endpoints';

type RawItem = {
  id?: string | number | null;
  placeId?: string | null;
  name?: string | null;
  label?: string | null;
  title?: string | null;
  description?: string | null;
  address?: string | null;
};

type PlacesAutocompleteResponse =
  | {
      data?: {
        items?: RawItem[] | null;
        suggestions?: RawItem[] | null;
      } | null;
      items?: RawItem[] | null;
      suggestions?: RawItem[] | null;
    }
  | null;

type PlacesRecentResponse =
  | {
      data?: {
        items?: RawItem[] | null;
        recent?: RawItem[] | null;
      } | null;
      items?: RawItem[] | null;
      recent?: RawItem[] | null;
    }
  | null;

export type PlaceSuggestion = {
  id: string;
  label: string;
  subtitle?: string;
};

let backendPlacesUnavailable = false;

function asApiError(error: unknown): ApiError | null {
  if (!error || typeof error !== 'object' || !('status' in error)) return null;
  const candidate = error as ApiError;
  return typeof candidate.status === 'number' ? candidate : null;
}

function isGatewayPlacesNotConfigured(error: unknown) {
  const apiError = asApiError(error);
  if (!apiError) return false;
  if (apiError.status !== 404) return false;
  const message = String(apiError.message || '').toLowerCase();
  return message.includes('unknown domain: places');
}

function normalizeItem(item: RawItem): PlaceSuggestion | null {
  const label = String(item.label || item.name || item.title || '').trim();
  if (!label) return null;
  const idRaw = item.id || item.placeId || label;
  const id = String(idRaw);
  const subtitle = String(item.description || item.address || '').trim();
  return {
    id,
    label,
    subtitle: subtitle || undefined
  };
}

function extractItems(payload: PlacesAutocompleteResponse | PlacesRecentResponse): RawItem[] {
  if (!payload || typeof payload !== 'object') return [];
  const root = payload as {
    items?: RawItem[] | null;
    suggestions?: RawItem[] | null;
    recent?: RawItem[] | null;
    data?: {
      items?: RawItem[] | null;
      suggestions?: RawItem[] | null;
      recent?: RawItem[] | null;
    } | null;
  };
  const directItems = Array.isArray(root.items) ? root.items : [];
  const directSuggestions = Array.isArray(root.suggestions) ? root.suggestions : [];
  const dataItems = Array.isArray(root.data?.items) ? root.data?.items || [] : [];
  const dataSuggestions = Array.isArray(root.data?.suggestions) ? root.data?.suggestions || [] : [];
  const dataRecent = Array.isArray(root.data?.recent) ? root.data?.recent || [] : [];
  const recent = Array.isArray(root.recent) ? root.recent : [];
  return [...directItems, ...directSuggestions, ...dataItems, ...dataSuggestions, ...dataRecent, ...recent];
}

function dedupeSuggestions(items: PlaceSuggestion[]) {
  const unique: PlaceSuggestion[] = [];
  items.forEach((item) => {
    const duplicated = unique.some((existing) => existing.label.toLowerCase() === item.label.toLowerCase());
    if (!duplicated) {
      unique.push(item);
    }
  });
  return unique;
}

export async function searchPlaces(params: { query: string; limit?: number; lat?: number; lng?: number }) {
  if (backendPlacesUnavailable) return null;
  try {
    const result = await apiRequest<PlacesAutocompleteResponse>({
      method: 'GET',
      path: endpoints.places.autocomplete,
      params: {
        q: params.query,
        limit: params.limit || 8,
        lat: params.lat,
        lng: params.lng
      }
    });
    const items = extractItems(result)
      .map(normalizeItem)
      .filter((item): item is PlaceSuggestion => Boolean(item));
    return dedupeSuggestions(items);
  } catch (error) {
    if (isGatewayPlacesNotConfigured(error)) {
      backendPlacesUnavailable = true;
    }
    return null;
  }
}

export async function listRecentDestinationsFromApi(limit = 8) {
  if (backendPlacesUnavailable) return null;
  try {
    const result = await apiRequest<PlacesRecentResponse>({
      method: 'GET',
      path: endpoints.places.recent,
      params: { limit }
    });
    const items = extractItems(result)
      .map(normalizeItem)
      .filter((item): item is PlaceSuggestion => Boolean(item));
    return dedupeSuggestions(items).map((item) => item.label);
  } catch (error) {
    if (isGatewayPlacesNotConfigured(error)) {
      backendPlacesUnavailable = true;
    }
    return null;
  }
}

export async function pushRecentDestinationToApi(label: string) {
  if (backendPlacesUnavailable) return false;
  const normalized = label.trim();
  if (!normalized) return false;
  try {
    await apiRequest<{ ok?: boolean }>({
      method: 'POST',
      path: endpoints.places.recent,
      body: { label: normalized }
    });
    return true;
  } catch (error) {
    if (isGatewayPlacesNotConfigured(error)) {
      backendPlacesUnavailable = true;
    }
    return false;
  }
}
