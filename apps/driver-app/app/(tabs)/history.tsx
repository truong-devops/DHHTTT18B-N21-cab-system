import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { mockApi } from '@/lib/mock-api';
import { palette } from '@/lib/theme';

type HistoryItem = Awaited<ReturnType<typeof mockApi.getRideHistory>>[number];

export default function HistoryScreen() {
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    mockApi.getRideHistory().then(setItems);
  }, []);

  const summary = useMemo(() => {
    const completed = items.filter((item) => item.status === 'COMPLETED');
    const cancelled = items.filter((item) => item.status === 'CANCELLED');
    const totalAmount = completed.reduce((sum, item) => sum + item.amount, 0);
    return {
      completed: completed.length,
      cancelled: cancelled.length,
      totalAmount,
    };
  }, [items]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Lịch sử chuyến</Text>

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
            <Text style={styles.summaryValue}>
              {summary.totalAmount.toLocaleString('vi-VN')} đ
            </Text>
          </View>
        </View>

        {items.map((ride) => (
          <View key={ride.id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.route}>{ride.route}</Text>
              <Text style={styles.amount}>
                {ride.amount === 0 ? '0 đ' : `${ride.amount.toLocaleString('vi-VN')} đ`}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.time}>{ride.time}</Text>
              <View style={[styles.statusPill, ride.status === 'COMPLETED' ? styles.statusOk : styles.statusCancel]}>
                <Text style={[styles.statusText, ride.status === 'COMPLETED' ? styles.statusOkText : styles.statusCancelText]}>
                  {ride.status === 'COMPLETED' ? 'Hoàn tất' : 'Đã hủy'}
                </Text>
              </View>
            </View>
          </View>
        ))}
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
  },
  route: {
    color: palette.text,
    fontWeight: '600',
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
