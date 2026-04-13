import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as rideApi from '@/lib/services/ride';
import { WS_BASE_URL } from '@/lib/config';

type Options = {
  enabled: boolean;
  intervalMs?: number;
  limit?: number;
  wsUrl?: string;
};

const DEFAULT_INTERVAL_MS = 2500;
const MAX_RECONNECT_DELAY = 10000;

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizeBookingId(raw: any): string | null {
  const candidates = [raw?.bookingId, raw?.booking_id];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function isRealBookingRide(ride: rideApi.Ride | null | undefined): boolean {
  if (!ride) return false;
  return typeof ride.bookingId === 'string' && ride.bookingId.trim().length > 0;
}

function normalizeRide(raw: any): rideApi.Ride | null {
  if (!raw || typeof raw !== 'object') return null;
  const resolvedId =
    typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : typeof raw.rideId === 'string' && raw.rideId.trim() ? raw.rideId.trim() : '';
  if (!resolvedId) return null;
  const resolvedBookingId = normalizeBookingId(raw);

  return {
    ...(raw as rideApi.Ride),
    id: resolvedId,
    bookingId: resolvedBookingId,
    pickupLat: toFiniteNumber(raw.pickupLat),
    pickupLng: toFiniteNumber(raw.pickupLng),
    dropoffLat: toFiniteNumber(raw.dropoffLat),
    dropoffLng: toFiniteNumber(raw.dropoffLng)
  };
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
  const payload = event.ride ?? event.payload?.ride ?? event.data?.ride ?? event.payload ?? event.data ?? event;

  const normalizedPayload = normalizeRide(payload);
  if (normalizedPayload) return normalizedPayload;

  const rideId = event.rideId ?? event.payload?.rideId ?? event.data?.rideId;
  if (rideId) {
    return { id: rideId, status: 'requested' } as rideApi.Ride;
  }

  return null;
}

export function useIncomingRide({ enabled, intervalMs = DEFAULT_INTERVAL_MS, limit = 1, wsUrl }: Options) {
  const [incomingRide, setIncomingRide] = useState<rideApi.Ride | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateAt, setLastUpdateAt] = useState<number | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempt = useRef(0);

  const effectiveWsUrl = wsUrl || WS_BASE_URL;

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
      if (__DEV__) console.info('[IncomingRide] stop polling');
    }
  }, []);

  const fetchIncoming = useCallback(async () => {
    if (!enabled) return;
    setError(null);
    try {
      const res = await rideApi.listAssignments();
      const list = Array.isArray((res as any)?.data) ? (res as any).data : Array.isArray((res as any)?.data?.data) ? (res as any).data.data : [];
      const nextRide = normalizeRide(list[0]) ?? null;
      setIncomingRide(isRealBookingRide(nextRide) ? nextRide : null);
      setLastUpdateAt(Date.now());
    } catch (err: any) {
      setError(err?.message ?? 'Không thể tải chuyến mới');
    }
  }, [enabled]);

  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    if (__DEV__) console.info('[IncomingRide] start polling');
    void fetchIncoming();
    pollingRef.current = setInterval(fetchIncoming, intervalMs);
  }, [fetchIncoming, intervalMs]);

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
    if (__DEV__) console.info('[IncomingRide] schedule reconnect', delay);
    reconnectRef.current = setTimeout(() => {
      reconnectRef.current = null;
      connectWs();
    }, delay);
  }, [enabled]);

  const handleRide = useCallback(async (ride: rideApi.Ride) => {
    const normalized = normalizeRide(ride);
    if (!normalized?.id) return;
    if ((!normalized.pickupLat && !normalized.dropoffLat) || !isRealBookingRide(normalized)) {
      try {
        const detail = await rideApi.getRide(normalized.id);
        const detailed = normalizeRide(detail.data);
        setIncomingRide(isRealBookingRide(detailed) ? detailed : null);
      } catch {
        setIncomingRide(isRealBookingRide(normalized) ? normalized : null);
      }
    } else {
      setIncomingRide(normalized);
    }
    setLastUpdateAt(Date.now());
  }, []);

  const connectWs = useCallback(() => {
    if (!enabled || !effectiveWsUrl) {
      startPolling();
      return;
    }

    if (wsRef.current) return;

    try {
      const socket = new WebSocket(effectiveWsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        reconnectAttempt.current = 0;
        if (__DEV__) console.info('[IncomingRide] ws connected');
        try {
          socket.send(JSON.stringify({ action: 'subscribe', topics: ['ride.assigned', 'ride.created'] }));
        } catch {
          // best-effort subscribe
        }
        stopPolling();
      };

      socket.onmessage = (event) => {
        if (__DEV__) console.info('[IncomingRide] ws message', event?.data);
        const parsed = parseEvent(event.data);
        const ride = extractRide(parsed);
        if (ride) {
          void handleRide(ride);
        }
      };

      socket.onerror = () => {
        if (__DEV__) console.warn('[IncomingRide] ws error');
        setError('Mất kết nối realtime, chuyển qua polling.');
      };

      socket.onclose = () => {
        if (__DEV__) console.info('[IncomingRide] ws closed');
        cleanupWs();
        startPolling();
        scheduleReconnect();
      };
    } catch (err: any) {
      if (__DEV__) console.warn('[IncomingRide] ws init failed', err?.message);
      startPolling();
      scheduleReconnect();
    }
  }, [cleanupWs, enabled, effectiveWsUrl, handleRide, scheduleReconnect, startPolling, stopPolling]);

  useEffect(() => {
    if (!enabled) {
      setIncomingRide(null);
      setError(null);
      setLastUpdateAt(null);
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
  }, [cleanupWs, connectWs, enabled, stopPolling]);

  const isSearching = useMemo(() => enabled && !incomingRide, [enabled, incomingRide]);

  return { incomingRide, isSearching, lastUpdateAt, error };
}
