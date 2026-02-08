import { useMemo } from 'react';
import { useIncomingRide } from '@/hooks/use-incoming-ride';
import { useDriver } from '@/lib/contexts/driver';

type Options = {
  intervalMs?: number;
  limit?: number;
};

export function useRequests({ intervalMs = 2500, limit = 1 }: Options = {}) {
  const { driver } = useDriver();
  const isOnline = driver?.onlineStatus === 'ONLINE' || driver?.onlineStatus === 'BUSY';
  const incoming = useIncomingRide({
    enabled: isOnline,
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
