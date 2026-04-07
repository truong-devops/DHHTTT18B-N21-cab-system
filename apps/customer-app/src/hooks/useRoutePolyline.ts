import { useEffect, useMemo, useRef, useState } from 'react';
import { getRoutingProvider } from '../services/routing';
import type { LatLng, RouteProfile, RouteResult } from '../services/routing/provider';

type RouteState = {
  coords: LatLng[];
  distanceMeters?: number;
  durationSeconds?: number;
  isLoading: boolean;
  error: string | null;
};

const CACHE_TTL_MS = 45000;
const ROUTE_REFRESH_MS = 12000;
const ORIGIN_MOVE_THRESHOLD_METERS = 40;
const DESTINATION_MOVE_THRESHOLD_METERS = 20;
const routeCache = new Map<string, { ts: number; data: RouteResult }>();

const roundCoord = (value: number) => value.toFixed(5);

const makeKey = (origin: LatLng, destination: LatLng, profile: RouteProfile) =>
  `${roundCoord(origin.latitude)},${roundCoord(origin.longitude)}|${roundCoord(
    destination.latitude
  )},${roundCoord(destination.longitude)}|${profile}`;

const toRad = (value: number) => (value * Math.PI) / 180;

const distanceMeters = (a: LatLng, b: LatLng) => {
  const earthRadius = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
};

export const useRoutePolyline = ({
  origin,
  destination,
  profile
}: {
  origin: LatLng | null;
  destination: LatLng | null;
  profile: RouteProfile;
}): RouteState => {
  const [state, setState] = useState<RouteState>({
    coords: [],
    isLoading: false,
    error: null
  });

  const key = useMemo(() => {
    if (!origin || !destination) return null;
    return makeKey(origin, destination, profile);
  }, [origin, destination, profile]);

  const lastKeyRef = useRef<string | null>(null);
  const lastFetchAtRef = useRef(0);
  const lastOriginRef = useRef<LatLng | null>(null);
  const lastDestinationRef = useRef<LatLng | null>(null);
  const lastRequestIdRef = useRef(0);

  useEffect(() => {
    if (!origin || !destination || !key) {
      setState((prev) => ({ ...prev, coords: [], isLoading: false, error: null }));
      return;
    }

    if (lastKeyRef.current === key) return;

    const cached = routeCache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      lastKeyRef.current = key;
      lastFetchAtRef.current = Date.now();
      lastOriginRef.current = origin;
      lastDestinationRef.current = destination;
      setState({
        coords: cached.data.coords,
        distanceMeters: cached.data.distanceMeters,
        durationSeconds: cached.data.durationSeconds,
        isLoading: false,
        error: null
      });
      return;
    }

    const now = Date.now();
    const previousOrigin = lastOriginRef.current;
    const previousDestination = lastDestinationRef.current;
    const movedFromLastOrigin = previousOrigin ? distanceMeters(previousOrigin, origin) : Number.POSITIVE_INFINITY;
    const movedFromLastDestination = previousDestination ? distanceMeters(previousDestination, destination) : Number.POSITIVE_INFINITY;
    const canReuseRecentRoute =
      now - lastFetchAtRef.current < ROUTE_REFRESH_MS &&
      movedFromLastOrigin < ORIGIN_MOVE_THRESHOLD_METERS &&
      movedFromLastDestination < DESTINATION_MOVE_THRESHOLD_METERS;

    if (canReuseRecentRoute) {
      lastKeyRef.current = key;
      return;
    }

    lastKeyRef.current = key;
    lastFetchAtRef.current = now;
    lastOriginRef.current = origin;
    lastDestinationRef.current = destination;
    lastRequestIdRef.current += 1;
    const requestId = lastRequestIdRef.current;

    const provider = getRoutingProvider();

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    provider
      .getRoute(origin, destination, profile)
      .then((data) => {
        if (requestId !== lastRequestIdRef.current) return;
        routeCache.set(key, { ts: Date.now(), data });
        setState({
          coords: data.coords,
          distanceMeters: data.distanceMeters,
          durationSeconds: data.durationSeconds,
          isLoading: false,
          error: null
        });
      })
      .catch((error: any) => {
        if (requestId !== lastRequestIdRef.current) return;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error?.message || 'Không thể lấy lộ trình từ OSRM.'
        }));
      });
  }, [destination, key, origin, profile]);

  return state;
};
