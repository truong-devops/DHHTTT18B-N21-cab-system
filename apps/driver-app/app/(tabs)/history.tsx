import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/lib/contexts/auth';
import * as rideApi from '@/lib/services/ride';
import { palette } from '@/lib/theme';

export default function HistoryScreen() {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<rideApi.Ride[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setItems([]);
      return;
    }

    let mounted = true;
    setError(null);
    rideApi
      .listHistory(20)
      .then((res) => {
        if (mounted) setItems(res.data || []);
      })
      .catch((err: any) => {
        if (mounted) setError(err?.message ?? 'Không thể tải lịch sử');
      });

    return () => {
      mounted = false;
    };
  }, [isAuthenticated]);

  const summary = useMemo(() => {
    const completed = items.filter((item) => item.status?.toUpperCase() === 'COMPLETED');
    const cancelled = items.filter((item) => item.status?.toUpperCase() === 'CANCELLED');
    return {
      completed: completed.length,
      cancelled: cancelled.length,
      totalAmount: 0,
    };
  }, [items]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Lịch sử chuyến</Text>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Hoàn tất</Text>
            <Text style={styles.summaryValue}>{summary.completed}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Đã hủy</Text>
            <Text style={styles.summaryValue}>{summary.cancelled}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Doanh thu</Text>
            <Text style={styles.summaryValue}>{summary.totalAmount.toLocaleString('vi-VN')} đ</Text>
          </View>
        </View>

        {items.map((ride) => {
          const status = ride.status?.toUpperCase() ?? '--';
          const statusLabel = status === 'COMPLETED' ? 'Hoàn tất' : status === 'CANCELLED' ? 'Đã hủy' : status;
          const createdAt = ride.createdAt ? new Date(ride.createdAt).toLocaleString('vi-VN') : '--';
          const route = `${ride.pickupLat?.toFixed(3) ?? '--'},${ride.pickupLng?.toFixed(3) ?? '--'} → ${
            ride.dropoffLat?.toFixed(3) ?? '--'
          },${ride.dropoffLng?.toFixed(3) ?? '--'}`;

          return (
            <View key={ride.id} style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.route}>{route}</Text>
                <Text style={styles.amount}>--</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.time}>{createdAt}</Text>
                <View style={[styles.statusPill, status === 'COMPLETED' ? styles.statusOk : styles.statusCancel]}>
                  <Text style={[styles.statusText, status === 'COMPLETED' ? styles.statusOkText : styles.statusCancelText]}>
                    {statusLabel}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: palette.background,
  },
  container: {
    padding: 20,
    paddingBottom: 32,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 4,
  },
  errorCard: {
    backgroundColor: '#FFF1F1',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 12,
  },
  summaryCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: palette.redSoft,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.border,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    color: palette.muted,
    fontSize: 12,
  },
  summaryValue: {
    color: palette.text,
    fontWeight: '700',
    marginTop: 6,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.border,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  route: {
    color: palette.text,
    fontWeight: '600',
    flex: 1,
  },
  amount: {
    color: palette.redDark,
    fontWeight: '700',
  },
  time: {
    color: palette.muted,
    fontSize: 12,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusOk: {
    backgroundColor: palette.redSoft,
    borderColor: palette.border,
  },
  statusCancel: {
    backgroundColor: '#FFF7F4',
    borderColor: palette.border,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusOkText: {
    color: palette.redDark,
  },
  statusCancelText: {
    color: palette.muted,
  },
});
