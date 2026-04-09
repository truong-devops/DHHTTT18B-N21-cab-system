import { useEffect, useRef, useState } from 'react';
import { customerApi } from '../services/customerApi';
import { getDriverAvailability } from '../services/driverApi';
import { mockConfig } from '../mocks/config';
import { mockSocket, type MockSocketEvent } from '../mocks/socket';

const pollIntervalMs = 12000;
const availabilityRadiusMeters = 3000;
const reconnectDelayMs = 2000;

export type RealtimeEvent =
  | { type: 'nearby_drivers'; count: number }
  | { type: 'match_status'; status: 'searching' | 'found' | 'none'; driverId?: string }
  | { type: 'driver_location'; lat: number; lng: number; etaMinutes: number };

function getRealtimeWsUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_REALTIME_WS_URL;
  if (!fromEnv || !fromEnv.trim()) return null;
  return fromEnv.trim();
}

function asRealtimeEvent(event: unknown): RealtimeEvent | null {
  if (!event || typeof event !== 'object' || !('type' in event)) {
    return null;
  }
  const type = String((event as { type?: unknown }).type);
  if (type === 'nearby_drivers') {
    return {
      type,
      count: Number((event as { count?: unknown }).count || 0)
    };
  }
  if (type === 'match_status') {
    return {
      type,
      status: ((event as { status?: unknown }).status as 'searching' | 'found' | 'none') || 'searching',
      driverId: (event as { driverId?: string }).driverId
    };
  }
  if (type === 'driver_location') {
    return {
      type,
      lat: Number((event as { lat?: unknown }).lat || 0),
      lng: Number((event as { lng?: unknown }).lng || 0),
      etaMinutes: Number((event as { etaMinutes?: unknown }).etaMinutes || 0)
    };
  }
  return null;
}

export const useRealtimeStream = () => {
  const [nearbyDrivers, setNearbyDrivers] = useState(0);
  const [latestEvent, setLatestEvent] = useState<RealtimeEvent | null>(null);
  const poller = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let disposed = false;

    const applyEvent = (event: RealtimeEvent) => {
      if (disposed) return;
      setLatestEvent(event);
      if (event.type === 'nearby_drivers') {
        setNearbyDrivers(Number.isFinite(event.count) ? Math.max(0, event.count) : 0);
      }
    };

    if (mockConfig.useMockApi) {
      const unsubscribe = mockSocket.on((event: MockSocketEvent) => {
        const next = asRealtimeEvent(event);
        if (!next) return;
        applyEvent(next);
      });
      return () => {
        disposed = true;
        unsubscribe();
      };
    }

    const wsUrl = getRealtimeWsUrl();
    if (wsUrl) {
      const connect = () => {
        if (disposed) return;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = (message) => {
          try {
            const data = JSON.parse(String(message.data));
            if (Array.isArray(data)) {
              data.forEach((item) => {
                const next = asRealtimeEvent(item);
                if (next) applyEvent(next);
              });
              return;
            }
            const next = asRealtimeEvent(data);
            if (next) applyEvent(next);
          } catch {
            // Ignore invalid message payloads.
          }
        };

        ws.onclose = () => {
          if (disposed) return;
          reconnectTimerRef.current = setTimeout(connect, reconnectDelayMs);
        };

        ws.onerror = () => {
          ws.close();
        };
      };

      connect();

      return () => {
        disposed = true;
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
        }
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
      };
    }

    const poll = async () => {
      try {
        const pickup = customerApi.getLivePickupLocation();
        if (!pickup) {
          if (!disposed) {
            setNearbyDrivers(0);
          }
          return;
        }
        const res = await getDriverAvailability({
          lat: pickup.latitude,
          lng: pickup.longitude,
          radiusMeters: availabilityRadiusMeters,
          limit: 30
        });
        if (!disposed) {
          const count = Number(res.data?.count || 0);
          applyEvent({
            type: 'nearby_drivers',
            count: Number.isFinite(count) ? Math.max(0, count) : 0
          });
        }
      } catch {
        if (!disposed) {
          setNearbyDrivers(0);
        }
      }
    };

    void poll();
    poller.current = setInterval(() => {
      void poll();
    }, pollIntervalMs);

    return () => {
      disposed = true;
      if (poller.current) {
        clearInterval(poller.current);
      }
    };
  }, []);

  return { nearbyDrivers, latestEvent };
};
