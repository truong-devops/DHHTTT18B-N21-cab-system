import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as rideApi from '@/lib/services/ride';
import { WS_BASE_URL } from '@/lib/config';

type Options = {
  rideId?: string | null;
  enabled: boolean;
  intervalMs?: number;
  wsUrl?: string;
};

type StatusUpdate = 'ARRIVED' | 'STARTED' | 'COMPLETED' | 'ARRIVING' | 'IN_PROGRESS';
type TrackingPhase = 'pickup' | 'ontrip' | 'completed';

const DEFAULT_INTERVAL_MS = 2500;
const MAX_RECONNECT_DELAY = 10000;

const STATUS_ALIASES: Record<string, string> = {
  ARRIVED: 'ARRIVING',
  STARTED: 'IN_PROGRESS',
};

function normalizeStatus(status?: string | null) {
  return status ? status.toUpperCase() : '';
}

function mapPhase(status?: string | null): TrackingPhase {
  const normalized = normalizeStatus(status);
  if (normalized === 'IN_PROGRESS') return 'ontrip';
  if (normalized === 'COMPLETED') return 'completed';
  return 'pickup';
}

function isNetworkError(err: any) {
  if (!err) return false;
  if (typeof err.status !== 'number') return true;
  return err.status === 0;
}

function parseEvent(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function extractRide(event: any): rideApi.Ride | null {
  if (!event) return null;
  const payload =
    event.ride ??
    event.payload?.ride ??
    event.data?.ride ??
    event.payload ??
    event.data ??
    event;

  if (payload?.id) return payload as rideApi.Ride;

  const rideId = event.rideId ?? event.payload?.rideId ?? event.data?.rideId;
  if (rideId) {
    return { id: rideId } as rideApi.Ride;
  }

  return null;
}

export function useRideTracking({
  rideId,
  enabled,
  intervalMs = DEFAULT_INTERVAL_MS,
  wsUrl,
}: Options) {
  const [ride, setRide] = useState<rideApi.Ride | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [lastUpdateAt, setLastUpdateAt] = useState<number | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempt = useRef(0);
  const lastActionRef = useRef<string | null>(null);
  const connectRef = useRef<() => void>(() => {});

  const effectiveWsUrl = wsUrl || WS_BASE_URL;

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
      if (__DEV__) console.info('[RideTracking] stop polling');
    }
  }, []);

  const fetchRide = useCallback(async () => {
    if (!enabled || !rideId) return;
    setLoading(true);
    try {
      const res = await rideApi.getRide(rideId);
      setRide(res.data);
      setError(null);
      setIsOffline(false);
      setLastUpdateAt(Date.now());
    } catch (err: any) {
      const offline = isNetworkError(err);
      setIsOffline(offline);
      setError(offline ? 'Mất kết nối, đang thử lại...' : err?.message ?? 'Không thể tải chuyến');
    } finally {
      setLoading(false);
    }
  }, [enabled, rideId]);

  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    if (__DEV__) console.info('[RideTracking] start polling');
    void fetchRide();
    pollingRef.current = setInterval(fetchRide, intervalMs);
  }, [fetchRide, intervalMs]);

  const cleanupWs = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (reconnectRef.current || !enabled) return;
    const attempt = reconnectAttempt.current + 1;
    reconnectAttempt.current = attempt;
    const delay = Math.min(MAX_RECONNECT_DELAY, 1000 * attempt);
    if (__DEV__) console.info('[RideTracking] schedule reconnect', delay);
    reconnectRef.current = setTimeout(() => {
      reconnectRef.current = null;
      connectRef.current?.();
    }, delay);
  }, [enabled]);

  const handleRideUpdate = useCallback(
    async (incoming: rideApi.Ride) => {
      if (!incoming?.id) return;
      if (rideId && incoming.id !== rideId) return;
      if (!incoming.status || (!incoming.pickupLat && !incoming.dropoffLat)) {
        try {
          const detail = await rideApi.getRide(incoming.id);
          setRide(detail.data);
        } catch {
          setRide((prev) => (prev ? { ...prev, ...incoming } : incoming));
        }
      } else {
        setRide((prev) => (prev ? { ...prev, ...incoming } : incoming));
      }
      setLastUpdateAt(Date.now());
      setError(null);
      setIsOffline(false);
    },
    [rideId],
  );

  const connectWs = useCallback(() => {
    if (!enabled || !rideId || !effectiveWsUrl) {
      startPolling();
      return;
    }

    if (wsRef.current) return;

    try {
      const socket = new WebSocket(effectiveWsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        reconnectAttempt.current = 0;
        if (__DEV__) console.info('[RideTracking] ws connected');
        try {
          socket.send(
            JSON.stringify({
              action: 'subscribe',
              topics: ['ride.updated', 'ride.status.changed', 'ride.assigned'],
              rideId,
            }),
          );
        } catch {
          // best-effort subscribe
        }
        stopPolling();
      };

      socket.onmessage = (event) => {
        if (__DEV__) console.info('[RideTracking] ws message', event?.data);
        const parsed = parseEvent(event.data);
        const nextRide = extractRide(parsed);
        if (nextRide) {
          void handleRideUpdate(nextRide);
        }
      };

      socket.onerror = () => {
        if (__DEV__) console.warn('[RideTracking] ws error');
        setError('Mất kết nối realtime, chuyển qua polling.');
      };

      socket.onclose = () => {
        if (__DEV__) console.info('[RideTracking] ws closed');
        cleanupWs();
        startPolling();
        scheduleReconnect();
      };
    } catch (err: any) {
      if (__DEV__) console.warn('[RideTracking] ws init failed', err?.message);
      startPolling();
      scheduleReconnect();
    }
  }, [
    cleanupWs,
    effectiveWsUrl,
    enabled,
    handleRideUpdate,
    rideId,
    scheduleReconnect,
    startPolling,
    stopPolling,
  ]);

  useEffect(() => {
    connectRef.current = connectWs;
  }, [connectWs]);

  const updateStatus = useCallback(
    async (status: StatusUpdate) => {
      if (!rideId) return null;
      const target = STATUS_ALIASES[status] ?? status;
      const current = normalizeStatus(ride?.status);
      if (!target) return ride;
      if (current === target) return ride;
      if (lastActionRef.current === target) return ride;
      lastActionRef.current = target;
      setIsUpdating(true);
      try {
        const res = await rideApi.updateStatus(rideId, target);
        setRide(res.data);
        setError(null);
        setIsOffline(false);
        setLastUpdateAt(Date.now());
        return res.data;
      } catch (err: any) {
        const offline = isNetworkError(err);
        setIsOffline(offline);
        setError(offline ? 'Mất kết nối, đang thử lại...' : err?.message ?? 'Không thể cập nhật trạng thái');
        lastActionRef.current = null;
        throw err;
      } finally {
        setIsUpdating(false);
      }
    },
    [ride?.status, rideId],
  );

  useEffect(() => {
    if (!enabled || !rideId) {
      setRide(null);
      setError(null);
      setIsOffline(false);
      setLastUpdateAt(null);
      setLoading(false);
      stopPolling();
      cleanupWs();
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      return;
    }

    connectWs();

    return () => {
      cleanupWs();
      stopPolling();
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
    };
  }, [cleanupWs, connectWs, enabled, rideId, stopPolling]);

  const phase = useMemo(() => mapPhase(ride?.status), [ride?.status]);

  return {
    ride,
    loading,
    error,
    isOffline,
    lastUpdateAt,
    phase,
    isUpdating,
    refresh: fetchRide,
    updateStatus,
  };
}
