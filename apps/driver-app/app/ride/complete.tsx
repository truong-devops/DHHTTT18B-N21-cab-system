import { useEffect } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/components/ui/card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useRideTracking } from '@/hooks/use-ride-tracking';
import { useRide } from '@/lib/contexts/ride';
import { palette } from '@/lib/theme';

export default function RideCompleteScreen() {
  const { activeRide, setActiveRide } = useRide();
  const rideId = activeRide?.id ?? null;
  const { ride: trackedRide } = useRideTracking({ rideId, enabled: Boolean(rideId), intervalMs: 4000 });
  const ride = trackedRide ?? activeRide;

  useEffect(() => {
    if (trackedRide) {
      setActiveRide(trackedRide);
    }
  }, [trackedRide, setActiveRide]);

  if (!ride) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <ScreenHeader title="Hoàn thành cuốc xe" subtitle="Không tìm thấy chuyến" variant="light" />
          <View style={styles.content}>
            <Card style={styles.summaryCard}>
              <Text style={styles.totalLabel}>Chuyến đã kết thúc</Text>
              <Text style={styles.totalValue}>--</Text>
              <Text style={styles.metricLabel}>Không có dữ liệu chuyến.</Text>
            </Card>
            <PrimaryButton
              title="Về màn hình chính"
              onPress={() => {
                setActiveRide(null);
                router.replace('/');
              }}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <ScreenHeader title="Hoàn thành cuốc xe" subtitle="Tổng kết chuyến đi" variant="light" />

        <View style={styles.content}>
          <Card style={styles.summaryCard}>
            <Text style={styles.totalLabel}>Tổng tiền</Text>
            <Text style={styles.totalValue}>
              --
            </Text>
            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Quãng đường</Text>
                <Text style={styles.metricValue}>--</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Thời gian</Text>
                <Text style={styles.metricValue}>--</Text>
              </View>
            </View>
            <Text style={styles.metricLabel}>Mã chuyến: {ride.externalRideId ?? ride.id}</Text>
          </Card>

          <PrimaryButton
            title="HOÀN THÀNH"
            onPress={() => {
              setActiveRide(null);
              router.replace('/');
            }}
          />
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
