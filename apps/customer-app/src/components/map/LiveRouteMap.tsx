import React from 'react';
import { CustomerLiveMap } from './CustomerLiveMap';
import type { LocationPoint } from '../../mock/data';

type Props = {
  destination?: LocationPoint | null;
  etaMinutes?: number;
  onLocationChange?: (coords: { latitude: number; longitude: number }) => void;
};

export const LiveRouteMap: React.FC<Props> = ({ destination, etaMinutes, onLocationChange }) => {
  return (
    <CustomerLiveMap
      label={etaMinutes ? `ETA ${etaMinutes} phút` : 'Theo dõi hành trình'}
      destination={destination ? { latitude: destination.lat, longitude: destination.lng, label: destination.label } : undefined}
      showRoute={Boolean(destination)}
      onLocationChange={onLocationChange}
    />
  );
};
