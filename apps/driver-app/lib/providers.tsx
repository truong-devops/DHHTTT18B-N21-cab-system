import React from 'react';
import { AuthProvider } from '@/lib/contexts/auth';
import { DriverProvider } from '@/lib/contexts/driver';
import { RideProvider } from '@/lib/contexts/ride';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DriverProvider>
        <RideProvider>{children}</RideProvider>
      </DriverProvider>
    </AuthProvider>
  );
}
