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

function toNormalizedId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

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
      setError(null);
      setLoading(false);
      return;
    }

    const primaryDriverId = toNormalizedId(driver?.id);
    const userDriverId = toNormalizedId(driver?.userId);
    const driverIds = Array.from(new Set([primaryDriverId, userDriverId].filter((value): value is string => Boolean(value))));

    if (!driverIds.length) {
      setItems([]);
      setPaymentsByRide({});
      setError(null);
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.all([Promise.all(driverIds.map((driverId) => rideApi.listHistory({ limit, driverId }))), paymentApi.listPayments({ limit })])
      .then(([rideResponses, paymentsRes]) => {
        if (!mounted) return;

        const rideMap = new Map<string, rideApi.Ride>();
        rideResponses.forEach((response) => {
          (response.data || []).forEach((ride) => {
            if (!ride?.id) return;
            const existing = rideMap.get(ride.id);
            if (!existing) {
              rideMap.set(ride.id, ride);
              return;
            }
            if (toTimestamp(ride.createdAt) >= toTimestamp(existing.createdAt)) {
              rideMap.set(ride.id, { ...existing, ...ride });
            }
          });
        });

        const mergedRides = Array.from(rideMap.values())
          .sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt))
          .slice(0, limit);
        setItems(mergedRides);

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
        setError(err?.message ?? 'Khong the tai lich su');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [driver?.id, driver?.userId, isAuthenticated, limit]);

  const summary = useMemo(() => {
    const completed = items.filter((item) => item.status?.toUpperCase() === 'COMPLETED');
    const cancelled = items.filter((item) => item.status?.toUpperCase() === 'CANCELLED');
    const totalAmount = completed.reduce((sum, ride) => {
      const byInternalId = paymentsByRide[ride.id];
      const byExternalId =
        typeof ride.externalRideId === 'string' && ride.externalRideId.trim() ? paymentsByRide[ride.externalRideId] : undefined;
      return sum + (byInternalId ?? byExternalId ?? 0);
    }, 0);
    return { completed: completed.length, cancelled: cancelled.length, totalAmount } as TripSummary;
  }, [items, paymentsByRide]);

  return { items, paymentsByRide, summary, loading, error };
}
