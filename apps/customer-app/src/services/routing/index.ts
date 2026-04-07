import type { RoutingProvider } from './provider';
import { osrmProvider } from './osrmProvider';

export const getRoutingProvider = (): RoutingProvider => {
  return osrmProvider;
};
