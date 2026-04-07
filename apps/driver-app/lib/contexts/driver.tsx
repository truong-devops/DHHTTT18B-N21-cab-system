import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as driverApi from '@/lib/services/driver';
import { useAuth } from '@/lib/contexts/auth';

export type DriverProfile = driverApi.DriverProfileResponse['data']['driver'] & {
  vehicle?: driverApi.DriverProfileResponse['data']['vehicle'];
  location?: driverApi.DriverProfileResponse['data']['location'];
};

type DriverContextValue = {
  driver: DriverProfile | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setOnline: (lat?: number, lng?: number) => Promise<void>;
  setOffline: () => Promise<void>;
};

const DriverContext = createContext<DriverContextValue | undefined>(undefined);

export function DriverProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setDriver(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await driverApi.getMe();
      setDriver({
        ...result.data.driver,
        vehicle: result.data.vehicle,
        location: result.data.location
      });
    } catch (err: any) {
      setError(err?.message ?? 'Không thể tải thông tin tài xế');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const setOnline = useCallback(
    async (lat?: number, lng?: number) => {
      await driverApi.setOnline(lat, lng);
      await refresh();
    },
    [refresh]
  );

  const setOffline = useCallback(async () => {
    await driverApi.setOffline();
    await refresh();
  }, [refresh]);

  useEffect(() => {
    if (isAuthenticated) {
      void refresh();
    } else {
      setDriver(null);
    }
  }, [isAuthenticated, refresh]);

  const value = useMemo(
    () => ({
      driver,
      loading,
      error,
      refresh,
      setOnline,
      setOffline
    }),
    [driver, loading, error, refresh, setOnline, setOffline]
  );

  return <DriverContext.Provider value={value}>{children}</DriverContext.Provider>;
}

export function useDriver() {
  const ctx = useContext(DriverContext);
  if (!ctx) {
    throw new Error('useDriver must be used within DriverProvider');
  }
  return ctx;
}
