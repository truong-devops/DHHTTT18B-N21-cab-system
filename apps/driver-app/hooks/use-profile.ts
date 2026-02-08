import { useMemo } from 'react';
import { useAuth } from '@/lib/contexts/auth';
import { useDriver } from '@/lib/contexts/driver';
import { useEarnings } from '@/hooks/use-earnings';

export function useProfile() {
  const auth = useAuth();
  const driver = useDriver();
  const earnings = useEarnings({ limit: 10 });

  const walletTotal = useMemo(() => earnings.summary.total, [earnings.summary.total]);

  return {
    auth,
    driver,
    walletTotal,
    earnings,
  };
}
