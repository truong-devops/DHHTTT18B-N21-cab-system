import polyline from '@mapbox/polyline';
import { LatLng, RouteProfile, RouteResult, RoutingProvider } from './provider';

const getProfile = (profile: RouteProfile) => {
  // OpenRouteService doesn't provide a motorbike profile by default.
  // Use driving-car as a reasonable fallback.
  if (profile === 'motorbike') return 'driving-car';
  return 'driving-car';
};

export const orsProvider: RoutingProvider = {
  name: 'ors',
  async getRoute(origin: LatLng, destination: LatLng, profile: RouteProfile): Promise<RouteResult> {
    const apiKey = process.env.EXPO_PUBLIC_ORS_API_KEY;
    if (!apiKey) {
      throw new Error('Missing ORS API key');
    }
    const orsProfile = getProfile(profile);
    const start = `${origin.longitude},${origin.latitude}`;
    const end = `${destination.longitude},${destination.latitude}`;
    const url = `https://api.openrouteservice.org/v2/directions/${orsProfile}?api_key=${apiKey}&start=${start}&end=${end}&geometry_format=polyline`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`ORS error ${res.status}`);
    }
    const json = await res.json();
    const route = json?.routes?.[0];
    const points = route?.geometry;
    if (!points) {
      throw new Error('ORS no route geometry');
    }
    const decoded = polyline.decode(points);
    const coords = decoded.map(([lat, lng]) => ({
      latitude: lat,
      longitude: lng,
    }));

    return {
      coords,
      distanceMeters: route?.summary?.distance,
      durationSeconds: route?.summary?.duration,
    };
  },
};
