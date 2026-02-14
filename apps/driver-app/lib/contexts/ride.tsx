import React, { createContext, useContext, useMemo, useState } from 'react';
import type { Ride } from '@/lib/services/ride';

type RideContextValue = {
  activeRide: Ride | null;
  setActiveRide: (ride: Ride | null) => void;
};

const RideContext = createContext<RideContextValue | undefined>(undefined);

export function RideProvider({ children }: { children: React.ReactNode }) {
  const [activeRide, setActiveRide] = useState<Ride | null>(null);

  const value = useMemo(
    () => ({
      activeRide,
      setActiveRide,
    }),
    [activeRide],
  );

  return <RideContext.Provider value={value}>{children}</RideContext.Provider>;
}

export function useRide() {
  const ctx = useContext(RideContext);
  if (!ctx) {
    throw new Error('useRide must be used within RideProvider');
  }
  return ctx;
}
