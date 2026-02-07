import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { useDriver } from '@/lib/contexts/driver';
import * as driverApi from '@/lib/services/driver';

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

  const isOnline = driver?.onlineStatus === 'ONLINE' || driver?.onlineStatus === 'BUSY';

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
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
      await driverApi.sendLocation(payload);
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
      await driverApi.sendLocation(snapshot);
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
  }, [isOnline, sendLocationOnce, startInterval, stopInterval]);

  useEffect(() => () => stopInterval(), [stopInterval]);

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
