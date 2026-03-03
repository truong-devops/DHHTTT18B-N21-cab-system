import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/contexts/auth';
import * as paymentApi from '@/lib/services/payment';

type Options = {
  limit?: number;
};

export type EarningsSummary = {
  total: number;
  pending: number;
  today: number;
};

export function useEarnings({ limit = 20 }: Options = {}) {
  const { isAuthenticated } = useAuth();
  const [payments, setPayments] = useState<paymentApi.Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setPayments([]);
      setError(null);
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);
    paymentApi
      .listPayments(limit)
      .then((res) => {
        if (!mounted) return;
        setPayments(res.data || []);
      })
      .catch((err: any) => {
        if (!mounted) return;
        setError(err?.message ?? 'Không thể tải thu nhập');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isAuthenticated, limit]);

  const summary = useMemo(() => {
    const total = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const pending = payments
      .filter((item) => item.status?.toUpperCase() !== 'PAID')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const today = payments
      .filter((item) => {
        if (!item.createdAt) return false;
        const created = new Date(item.createdAt).toDateString();
        return created === new Date().toDateString();
      })
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return { total, pending, today } as EarningsSummary;
  }, [payments]);

  return { payments, summary, loading, error };
}
