import polyline from '@mapbox/polyline';
import { LatLng, RouteProfile, RouteResult, RoutingProvider } from './provider';

const getMode = (profile: RouteProfile) => {
  // Google Directions does not have a dedicated motorbike mode in many regions.
  // Fallback to driving for motorbike.
  return 'driving';
};

export const googleProvider: RoutingProvider = {
  name: 'google',
  async getRoute(origin: LatLng, destination: LatLng, profile: RouteProfile): Promise<RouteResult> {
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error('Missing Google Maps API key');
    }
    const mode = getMode(profile);
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&mode=${mode}&key=${apiKey}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Google Directions error ${res.status}`);
    }
    const json = await res.json();
    const route = json?.routes?.[0];
    const leg = route?.legs?.[0];
    const points = route?.overview_polyline?.points;
    if (!points) {
      throw new Error('Google Directions no route geometry');
    }
    const decoded = polyline.decode(points);
    const coords = decoded.map(([lat, lng]) => ({
      latitude: lat,
      longitude: lng
    }));
    return {
      coords,
      distanceMeters: leg?.distance?.value,
      durationSeconds: leg?.duration?.value
    };
  }
};
