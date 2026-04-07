import { useEffect, useRef, useState } from 'react';
import { customerApi } from '../services/customerApi';
import { getDriverAvailability } from '../services/driverApi';

const pollIntervalMs = 12000;
const availabilityRadiusMeters = 3000;

type RealtimeEvent = {
  type: string;
  status?: string;
  driverId?: string;
  etaMinutes?: number;
};

export const useRealtimeStream = () => {
  const [nearbyDrivers, setNearbyDrivers] = useState(0);
  const latestEvent: RealtimeEvent | null = null;
  const poller = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let disposed = false;
    const poll = async () => {
      try {
        const pickup = customerApi.getLivePickupLocation();
        if (!pickup) {
          if (!disposed) setNearbyDrivers(0);
          return;
        }
        const res = await getDriverAvailability({
          lat: pickup.latitude,
          lng: pickup.longitude,
          radiusMeters: availabilityRadiusMeters,
          limit: 30
        });
        if (!disposed) {
          setNearbyDrivers(Number(res.data?.count || 0));
        }
      } catch {
        if (!disposed) setNearbyDrivers(0);
      }
    };

    void poll();
    poller.current = setInterval(() => {
      void poll();
    }, pollIntervalMs);

    return () => {
      disposed = true;
      if (poller.current) clearInterval(poller.current);
    };
  }, []);

  return { nearbyDrivers, latestEvent };
};
