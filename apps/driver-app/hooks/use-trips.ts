import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/contexts/auth';
import { useDriver } from '@/lib/contexts/driver';
import * as rideApi from '@/lib/services/ride';
import * as paymentApi from '@/lib/services/payment';

type Options = {
  limit?: number;
};

export type TripSummary = {
  completed: number;
  cancelled: number;
  totalAmount: number;
};

export function useTrips({ limit = 20 }: Options = {}) {
  const { isAuthenticated } = useAuth();
  const { driver } = useDriver();
  const [items, setItems] = useState<rideApi.Ride[]>([]);
  const [paymentsByRide, setPaymentsByRide] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setItems([]);
      setPaymentsByRide({});
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.all([rideApi.listHistory(limit), paymentApi.listPayments(limit)])
      .then(([ridesRes, paymentsRes]) => {
        if (!mounted) return;
        const driverId = driver?.id;
        const rides = (ridesRes.data || []).filter((ride) =>
          driverId ? ride.driverId === driverId : true,
        );
        setItems(rides);

        const paymentMap: Record<string, number> = {};
        (paymentsRes.data || []).forEach((payment) => {
          if (!payment.rideId) return;
          const amount = Number(payment.amount || 0);
          if (!Number.isFinite(amount)) return;
          paymentMap[payment.rideId] = (paymentMap[payment.rideId] || 0) + amount;
        });
        setPaymentsByRide(paymentMap);
      })
      .catch((err: any) => {
        if (!mounted) return;
        setError(err?.message ?? 'Không thể tải lịch sử');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [driver?.id, isAuthenticated, limit]);

  const summary = useMemo(() => {
    const completed = items.filter((item) => item.status?.toUpperCase() === 'COMPLETED');
    const cancelled = items.filter((item) => item.status?.toUpperCase() === 'CANCELLED');
    const totalAmount = completed.reduce(
      (sum, ride) => sum + (paymentsByRide[ride.id] ?? 0),
      0,
    );
    return { completed: completed.length, cancelled: cancelled.length, totalAmount } as TripSummary;
  }, [items, paymentsByRide]);

  return { items, paymentsByRide, summary, loading, error };
}
