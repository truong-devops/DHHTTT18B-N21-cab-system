import React from 'react';
import type { LocationPoint } from '../../mock/data';
import { CustomerLiveMap } from './CustomerLiveMap';

type Props = {
  destination?: LocationPoint | null;
  driverLocation?: LocationPoint | null;
  etaMinutes?: number;
  onLocationChange?: (coords: { latitude: number; longitude: number }) => void;
};

export const LiveRouteMap: React.FC<Props> = ({ destination, driverLocation, etaMinutes, onLocationChange }) => {
  return (
    <CustomerLiveMap
      label={etaMinutes ? `Dự kiến ${etaMinutes} phút` : 'Theo dõi hành trình'}
      destination={destination ? { latitude: destination.lat, longitude: destination.lng, label: destination.label } : undefined}
      driverLocation={driverLocation ? { latitude: driverLocation.lat, longitude: driverLocation.lng, label: driverLocation.label } : undefined}
      showRoute={Boolean(destination)}
      onLocationChange={onLocationChange}
    />
  );
};

