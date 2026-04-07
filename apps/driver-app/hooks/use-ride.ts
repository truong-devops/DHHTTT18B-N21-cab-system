import { useMemo } from 'react';
import { useRideTracking } from '@/hooks/use-ride-tracking';

type Options = {
  rideId?: string | null;
  enabled?: boolean;
  intervalMs?: number;
};

export function useRide({ rideId, enabled = true, intervalMs = 2500 }: Options) {
  const tracking = useRideTracking({
    rideId,
    enabled: Boolean(rideId) && enabled,
    intervalMs
  });

  const status = useMemo(() => (tracking.ride?.status ? String(tracking.ride.status).toUpperCase() : ''), [tracking.ride?.status]);

  return {
    ...tracking,
    status
  };
}
