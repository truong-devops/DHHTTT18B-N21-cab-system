import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { useDriver } from '@/lib/contexts/driver';
import * as driverApi from '@/lib/services/driver';
import { WS_BASE_URL } from '@/lib/config';

type Options = {
  intervalMs?: number;
};

type OnlineState = 'online' | 'offline' | 'sending';

type LocationSnapshot = {
  lat: number;
  lng: number;
  heading?: number | null;
  speed?: number | null;
  accuracy?: number | null;
  recordedAt?: string | null;
};

const DEFAULT_INTERVAL_MS = 2500;
const MAX_RECONNECT_DELAY = 10000;

function mapLocation(
  coords: Location.LocationObject['coords'],
  timestamp?: number,
): LocationSnapshot {
  return {
    lat: coords.latitude,
    lng: coords.longitude,
    heading: Number.isFinite(coords.heading) ? coords.heading : null,
    speed: Number.isFinite(coords.speed) ? coords.speed : null,
    accuracy: Number.isFinite(coords.accuracy) ? coords.accuracy : null,
    recordedAt: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
  };
}

async function ensureLocationPermission() {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.status === 'granted') return true;
  const requested = await Location.requestForegroundPermissionsAsync();
  return requested.status === 'granted';
}

export function useDriverOnline({ intervalMs = DEFAULT_INTERVAL_MS }: Options = {}) {
  const { driver, setOnline, setOffline } = useDriver();
  const [error, setError] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const inFlightRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const wsConnectedRef = useRef(false);
  const reconnectRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempt = useRef(0);
  const connectRef = useRef<() => void>(() => {});

  const isOnline = driver?.onlineStatus === 'ONLINE' || driver?.onlineStatus === 'BUSY';

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const cleanupWs = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    wsConnectedRef.current = false;
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (reconnectRef.current || !WS_BASE_URL) return;
    const attempt = reconnectAttempt.current + 1;
    reconnectAttempt.current = attempt;
    const delay = Math.min(MAX_RECONNECT_DELAY, 1000 * attempt);
    if (__DEV__) console.info('[GPS] WS reconnect in', delay, 'ms');
    reconnectRef.current = setTimeout(() => {
      reconnectRef.current = null;
      connectRef.current?.();
    }, delay);
  }, []);

  const connectWs = useCallback(() => {
    if (!WS_BASE_URL) return;
    if (wsRef.current) return;

    try {
      const socket = new WebSocket(WS_BASE_URL);
      wsRef.current = socket;

      socket.onopen = () => {
        wsConnectedRef.current = true;
        reconnectAttempt.current = 0;
        if (__DEV__) console.info('[GPS] WS connected');
      };

      socket.onerror = () => {
        if (__DEV__) console.warn('[GPS] WS error');
        wsConnectedRef.current = false;
      };

      socket.onclose = () => {
        if (__DEV__) console.info('[GPS] WS disconnected');
        cleanupWs();
        scheduleReconnect();
      };
    } catch (err: any) {
      if (__DEV__) console.warn('[GPS] WS init failed', err?.message);
      scheduleReconnect();
    }
  }, [cleanupWs, scheduleReconnect]);

  useEffect(() => {
    connectRef.current = connectWs;
  }, [connectWs]);

  const emitLocationWs = useCallback((payload: LocationSnapshot) => {
    if (!wsRef.current || !wsConnectedRef.current) return false;
    try {
      wsRef.current.send(
        JSON.stringify({
          topic: 'driver.location.updated',
          payload,
        }),
      );
      if (__DEV__) console.info('[GPS] WS -> driver.location.updated');
      return true;
    } catch (err: any) {
      if (__DEV__) console.warn('[GPS] WS send failed', err?.message);
      wsConnectedRef.current = false;
      return false;
    }
  }, []);

  const sendLocationOnce = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsSending(true);
    setError(null);
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        throw new Error('Vui lòng bật GPS để gửi vị trí.');
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const payload = mapLocation(location.coords, location.timestamp);
      const sentViaWs = emitLocationWs(payload);
      if (!sentViaWs) {
        await driverApi.sendLocation(payload);
        if (__DEV__) console.info('[GPS] HTTP -> /v1/driver/me/location');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Không thể gửi vị trí.');
    } finally {
      inFlightRef.current = false;
      setIsSending(false);
    }
  }, []);

  const startInterval = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      void sendLocationOnce();
    }, intervalMs);
  }, [intervalMs, sendLocationOnce]);

  const startOnline = useCallback(async () => {
    setIsSwitching(true);
    setError(null);
    try {
      const granted = await ensureLocationPermission();
      if (!granted) {
        throw new Error('Bạn cần cấp quyền vị trí để bật nhận chuyến.');
      }
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        throw new Error('Vui lòng bật GPS để bật nhận chuyến.');
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const snapshot = mapLocation(location.coords, location.timestamp);
      await setOnline(snapshot.lat, snapshot.lng);
      const sentViaWs = emitLocationWs(snapshot);
      if (!sentViaWs) {
        await driverApi.sendLocation(snapshot);
        if (__DEV__) console.info('[GPS] HTTP -> /v1/driver/me/location');
      }
      startInterval();
    } catch (err: any) {
      setError(err?.message ?? 'Không thể bật nhận chuyến.');
      throw err;
    } finally {
      setIsSwitching(false);
    }
  }, [setOnline, startInterval]);

  const stopOnline = useCallback(async () => {
    setIsSwitching(true);
    setError(null);
    try {
      stopInterval();
      cleanupWs();
      await setOffline();
    } catch (err: any) {
      setError(err?.message ?? 'Không thể tắt nhận chuyến.');
      throw err;
    } finally {
      setIsSwitching(false);
    }
  }, [setOffline, stopInterval]);

  useEffect(() => {
    if (!isOnline) {
      stopInterval();
      cleanupWs();
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      return;
    }

    let cancelled = false;
    const bootstrap = async () => {
      try {
        const granted = await ensureLocationPermission();
        if (!granted) {
          if (!cancelled) setError('Bạn cần cấp quyền vị trí để gửi vị trí.');
          return;
        }
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) {
          if (!cancelled) setError('Vui lòng bật GPS để gửi vị trí.');
          return;
        }
        if (cancelled) return;
        connectWs();
        await sendLocationOnce();
        startInterval();
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? 'Không thể gửi vị trí.');
        }
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [cleanupWs, connectWs, isOnline, sendLocationOnce, startInterval, stopInterval]);

  useEffect(
    () => () => {
      stopInterval();
      cleanupWs();
    },
    [cleanupWs, stopInterval],
  );

  const state: OnlineState = useMemo(() => {
    if (isSwitching || isSending) return 'sending';
    return isOnline ? 'online' : 'offline';
  }, [isOnline, isSending, isSwitching]);

  return {
    isOnline,
    state,
    error,
    sending: isSending || isSwitching,
    startOnline,
    stopOnline,
    sendLocationOnce,
  };
}
