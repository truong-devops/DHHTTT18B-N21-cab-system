import { useCallback, useEffect, useRef, useState } from 'react';
import * as rideApi from '@/lib/services/ride';

type Options = {
  enabled: boolean;
  intervalMs?: number;
  limit?: number;
};

export function useIncomingRides({ enabled, intervalMs = 2500, limit = 5 }: Options) {
  const [rides, setRides] = useState<rideApi.Ride[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRides = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await rideApi.listRequested(limit);
      setRides(res.data || []);
    } catch (err: any) {
      setError(err?.message ?? 'Không thể tải chuyến mới');
    } finally {
      setLoading(false);
    }
  }, [enabled, limit]);

  useEffect(() => {
    if (!enabled) {
      setRides([]);
      setError(null);
      setLoading(false);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    void fetchRides();
    pollingRef.current = setInterval(fetchRides, intervalMs);
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [enabled, intervalMs, fetchRides]);

  return { rides, loading, error, refresh: fetchRides };
}
