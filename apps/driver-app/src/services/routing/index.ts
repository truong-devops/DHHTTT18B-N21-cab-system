import { RoutingProvider } from './provider';
import { osrmProvider } from './osrmProvider';
import { googleProvider } from './googleProvider';
import { orsProvider } from './orsProvider';
import { mapboxProvider } from './mapboxProvider';

export const getRoutingProvider = (): RoutingProvider => {
  const provider = (process.env.EXPO_PUBLIC_ROUTING_PROVIDER || 'osrm').toLowerCase();
  switch (provider) {
    case 'google':
      return googleProvider;
    case 'ors':
      return orsProvider;
    case 'mapbox':
      return mapboxProvider;
    case 'osrm':
    default:
      return osrmProvider;
  }
};
