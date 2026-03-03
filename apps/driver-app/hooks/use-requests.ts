import { useMemo } from 'react';
import { useIncomingRide } from '@/hooks/use-incoming-ride';
import { useDriver } from '@/lib/contexts/driver';
import { useRide } from '@/lib/contexts/ride';

type Options = {
  intervalMs?: number;
  limit?: number;
};

export function useRequests({ intervalMs = 2500, limit = 1 }: Options = {}) {
  const { driver } = useDriver();
  const { activeRide } = useRide();
  const isOnline = driver?.onlineStatus === 'ONLINE' || driver?.onlineStatus === 'BUSY';
  const activeStatus = (activeRide?.status ?? '').toUpperCase();
  const hasActiveRide =
    Boolean(activeRide?.id) &&
    !['COMPLETED', 'CANCELED', 'CANCELLED'].includes(activeStatus);
  const incoming = useIncomingRide({
    enabled: isOnline && !hasActiveRide,
    intervalMs,
    limit,
  });

  const state = useMemo(
    () => ({
      isOnline,
      incomingRide: incoming.incomingRide,
      isSearching: incoming.isSearching,
      lastUpdateAt: incoming.lastUpdateAt,
      error: incoming.error,
    }),
    [incoming.error, incoming.incomingRide, incoming.isSearching, incoming.lastUpdateAt, isOnline],
  );

  return state;
}
