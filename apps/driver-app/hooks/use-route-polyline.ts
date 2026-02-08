import { useEffect, useMemo, useRef, useState } from 'react';
import { getRoutingProvider } from '@/src/services/routing';
import { LatLng, RouteProfile, RouteResult } from '@/src/services/routing/provider';

type RouteState = {
  coords: LatLng[];
  distanceMeters?: number;
  durationSeconds?: number;
  isLoading: boolean;
  error: string | null;
};

const CACHE_TTL_MS = 45000;
const routeCache = new Map<string, { ts: number; data: RouteResult }>();

const roundCoord = (value: number) => value.toFixed(5);

const makeKey = (origin: LatLng, destination: LatLng, profile: RouteProfile) =>
  `${roundCoord(origin.latitude)},${roundCoord(origin.longitude)}|${roundCoord(
    destination.latitude,
  )},${roundCoord(destination.longitude)}|${profile}`;

export const useRoutePolyline = ({
  origin,
  destination,
  profile,
}: {
  origin: LatLng | null;
  destination: LatLng | null;
  profile: RouteProfile;
}): RouteState => {
  const [state, setState] = useState<RouteState>({
    coords: [],
    isLoading: false,
    error: null,
  });

  const key = useMemo(() => {
    if (!origin || !destination) return null;
    return makeKey(origin, destination, profile);
  }, [origin, destination, profile]);

  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!origin || !destination || !key) {
      setState((prev) => ({ ...prev, coords: [], isLoading: false, error: null }));
      return;
    }

    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    const cached = routeCache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      setState({
        coords: cached.data.coords,
        distanceMeters: cached.data.distanceMeters,
        durationSeconds: cached.data.durationSeconds,
        isLoading: false,
        error: null,
      });
      return;
    }

    let cancelled = false;
    const provider = getRoutingProvider();

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    provider
      .getRoute(origin, destination, profile)
      .then((data) => {
        if (cancelled) return;
        routeCache.set(key, { ts: Date.now(), data });
        setState({
          coords: data.coords,
          distanceMeters: data.distanceMeters,
          durationSeconds: data.durationSeconds,
          isLoading: false,
          error: null,
        });
      })
      .catch((err: any) => {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err?.message ?? 'Không lấy được đường đi thật',
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [origin, destination, profile, key]);

  return state;
};
