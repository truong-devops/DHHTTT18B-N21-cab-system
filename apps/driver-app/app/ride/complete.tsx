import { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/components/ui/card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { mockApi } from '@/lib/mock-api';
import { palette } from '@/lib/theme';

type RideSummary = Awaited<ReturnType<typeof mockApi.getRideSummary>>;

export default function RideCompleteScreen() {
  const [summary, setSummary] = useState<RideSummary | null>(null);

  useEffect(() => {
    mockApi.getRideSummary().then(setSummary);
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <ScreenHeader title="Hoàn thành cuốc xe" subtitle="Tổng kết chuyến đi" variant="light" />

        <View style={styles.content}>
          <Card style={styles.summaryCard}>
            <Text style={styles.totalLabel}>Tổng tiền</Text>
            <Text style={styles.totalValue}>
              {summary ? `${summary.totalAmount.toLocaleString('vi-VN')} đ` : '--'}
            </Text>
            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Quãng đường</Text>
                <Text style={styles.metricValue}>{summary ? `${summary.distanceKm} km` : '--'}</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Thời gian</Text>
                <Text style={styles.metricValue}>{summary ? `${summary.durationMin} phút` : '--'}</Text>
              </View>
            </View>
          </Card>

          <PrimaryButton title="HOÀN THÀNH" onPress={() => router.replace('/')} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: palette.background,
  },
  container: {
    flex: 1,
    padding: 20,
    gap: 16,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 16,
  },
  summaryCard: {
    alignItems: 'center',
    gap: 12,
  },
  totalLabel: {
    color: palette.muted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  totalValue: {
    color: palette.red,
    fontSize: 32,
    fontWeight: '800',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 10,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    color: palette.muted,
    fontSize: 12,
  },
  metricValue: {
    color: palette.text,
    fontWeight: '700',
    marginTop: 4,
  },
});
