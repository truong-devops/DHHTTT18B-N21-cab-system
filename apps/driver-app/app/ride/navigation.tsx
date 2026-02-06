import { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/components/ui/card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { mockApi } from '@/lib/mock-api';
import { palette } from '@/lib/theme';

type ActiveRide = Awaited<ReturnType<typeof mockApi.getActiveRide>>;

export default function RideNavigationScreen() {
  const [ride, setRide] = useState<ActiveRide | null>(null);

  useEffect(() => {
    mockApi.getActiveRide().then(setRide);
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <ScreenHeader
          title="Đang thực hiện cuốc"
          subtitle="Điều hướng đến điểm tiếp theo"
          variant="red"
          style={styles.header}>
          <View style={styles.headerMetrics}>
            <Text style={styles.metricValue}>{ride ? `${ride.remainingTimeMin} phút` : '--'}</Text>
            <Text style={styles.metricLabel}>Còn lại</Text>
            <Text style={styles.metricValue}>{ride ? `${ride.nextDistanceKm} km` : '--'}</Text>
            <Text style={styles.metricLabel}>Đến điểm tiếp theo</Text>
          </View>
        </ScreenHeader>

        <View style={styles.map}>
          <View style={styles.mapRoute} />
          <View style={styles.mapDotStart} />
          <View style={styles.mapDotEnd} />
          <Text style={styles.mapText}>Bản đồ giả lập tuyến đường</Text>
        </View>

        <Card>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Khách</Text>
            <Text style={styles.value}>{ride?.passenger ?? '--'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Điểm đón</Text>
            <Text style={styles.value}>{ride?.pickup ?? '--'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Điểm đến</Text>
            <Text style={styles.value}>{ride?.dropoff ?? '--'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Thanh toán</Text>
            <Text style={styles.value}>{ride?.paymentMethod ?? '--'}</Text>
          </View>
        </Card>

        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.quickAction}>
            <Text style={styles.quickActionText}>Gọi khách</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction}>
            <Text style={styles.quickActionText}>Nhắn tin</Text>
          </TouchableOpacity>
          <View style={styles.statusGroup}>
            <PrimaryButton title="ĐÃ ĐẾN" variant="ghost" style={styles.statusButton} />
            <PrimaryButton
              title="KẾT THÚC"
              style={styles.statusButton}
              onPress={() => router.push('/ride/complete')}
            />
          </View>
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
  header: {
    gap: 12,
  },
  headerMetrics: {
    alignItems: 'flex-end',
    gap: 2,
  },
  metricValue: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  metricLabel: {
    color: '#FFE7DE',
    fontSize: 10,
    marginBottom: 6,
  },
  map: {
    flex: 1,
    backgroundColor: palette.redSoft,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  mapRoute: {
    position: 'absolute',
    width: '70%',
    height: 2,
    backgroundColor: palette.redDark,
    top: '45%',
    opacity: 0.4,
  },
  mapDotStart: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: palette.red,
    left: '18%',
    top: '40%',
  },
  mapDotEnd: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: palette.red,
    backgroundColor: '#fff',
    right: '18%',
    top: '40%',
  },
  mapText: {
    color: palette.muted,
    fontSize: 12,
  },
  infoRow: {
    marginBottom: 10,
  },
  label: {
    color: palette.muted,
    fontSize: 12,
  },
  value: {
    color: palette.text,
    fontWeight: '600',
    marginTop: 4,
  },
  bottomBar: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 12,
    gap: 12,
  },
  quickAction: {
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  quickActionText: {
    color: palette.redDark,
    fontWeight: '600',
  },
  statusGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  statusButton: {
    flex: 1,
  },
});
