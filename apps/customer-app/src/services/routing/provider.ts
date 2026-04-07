export type RouteProfile = 'car' | 'motorbike';

export type LatLng = {
  latitude: number;
  longitude: number;
};

export type RouteResult = {
  coords: LatLng[];
  distanceMeters?: number;
  durationSeconds?: number;
};

export interface RoutingProvider {
  name: string;
  getRoute: (origin: LatLng, destination: LatLng, profile: RouteProfile) => Promise<RouteResult>;
}
