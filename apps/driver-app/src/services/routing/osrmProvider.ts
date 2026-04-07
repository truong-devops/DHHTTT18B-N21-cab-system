import polyline from '@mapbox/polyline';
import { LatLng, RouteProfile, RouteResult, RoutingProvider } from './provider';

const DEFAULT_OSRM_BASE = 'https://router.project-osrm.org';

const getProfile = (profile: RouteProfile) => {
  // OSRM public usually supports "driving". Motorbike is not a default profile.
  // Fallback to driving when motorbike is requested.
  if (profile === 'motorbike') return 'driving';
  return 'driving';
};

export const osrmProvider: RoutingProvider = {
  name: 'osrm',
  async getRoute(origin: LatLng, destination: LatLng, profile: RouteProfile): Promise<RouteResult> {
    const baseUrl = process.env.EXPO_PUBLIC_OSRM_BASE_URL || DEFAULT_OSRM_BASE;
    const mode = getProfile(profile);
    const start = `${origin.longitude},${origin.latitude}`;
    const end = `${destination.longitude},${destination.latitude}`;
    const url = `${baseUrl}/route/v1/${mode}/${start};${end}?overview=full&geometries=polyline`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`OSRM error ${res.status}`);
    }
    const json = await res.json();
    const route = json?.routes?.[0];
    if (!route?.geometry) {
      throw new Error('OSRM no route geometry');
    }

    const decoded = polyline.decode(route.geometry);
    const coords = decoded.map(([lat, lng]) => ({
      latitude: lat,
      longitude: lng
    }));

    return {
      coords,
      distanceMeters: route.distance,
      durationSeconds: route.duration
    };
  }
};
