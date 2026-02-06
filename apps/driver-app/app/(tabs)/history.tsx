import { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { mockApi } from '@/lib/mock-api';
import { palette } from '@/lib/theme';

type HistoryItem = Awaited<ReturnType<typeof mockApi.getRideHistory>>[number];

export default function HistoryScreen() {
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    mockApi.getRideHistory().then(setItems);
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Lịch sử chuyến</Text>
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
                <Text style={styles.statusText}>
                  {ride.status === 'COMPLETED' ? 'Hoàn tất' : 'Đã huỷ'}
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
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 4,
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
    backgroundColor: '#FFF7F7',
    borderColor: 'rgba(229, 57, 53, 0.2)',
  },
  statusText: {
    color: palette.redDark,
    fontSize: 12,
    fontWeight: '600',
  },
});
