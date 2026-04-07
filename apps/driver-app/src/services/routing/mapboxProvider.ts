import polyline from '@mapbox/polyline';
import { LatLng, RouteProfile, RouteResult, RoutingProvider } from './provider';

const getProfile = (profile: RouteProfile) => {
  // Mapbox supports "driving" and "driving-traffic". No direct motorbike.
  if (profile === 'motorbike') return 'driving';
  return 'driving';
};

export const mapboxProvider: RoutingProvider = {
  name: 'mapbox',
  async getRoute(origin: LatLng, destination: LatLng, profile: RouteProfile): Promise<RouteResult> {
    const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      throw new Error('Missing Mapbox token');
    }
    const mode = getProfile(profile);
    const start = `${origin.longitude},${origin.latitude}`;
    const end = `${destination.longitude},${destination.latitude}`;
    const url = `https://api.mapbox.com/directions/v5/mapbox/${mode}/${start};${end}?geometries=polyline6&overview=full&access_token=${token}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Mapbox error ${res.status}`);
    }
    const json = await res.json();
    const route = json?.routes?.[0];
    const points = route?.geometry;
    if (!points) {
      throw new Error('Mapbox no route geometry');
    }
    const decoded = polyline.decode(points, 6);
    const coords = decoded.map(([lat, lng]) => ({
      latitude: lat,
      longitude: lng
    }));
    return {
      coords,
      distanceMeters: route?.distance,
      durationSeconds: route?.duration
    };
  }
};
