import { useEffect, useMemo } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/components/ui/card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useRideTracking } from '@/hooks/use-ride-tracking';
import { useRide } from '@/lib/contexts/ride';
import { palette } from '@/lib/theme';

export default function RideNavigationScreen() {
  const { activeRide, setActiveRide } = useRide();
  const rideId = activeRide?.id ?? null;
  const { ride: trackedRide, error, isOffline, updateStatus, isUpdating } = useRideTracking({
    rideId,
    enabled: Boolean(rideId),
    intervalMs: 2500,
  });

  useEffect(() => {
    if (trackedRide) {
      setActiveRide(trackedRide);
    }
  }, [trackedRide, setActiveRide]);

  const ride = trackedRide ?? activeRide;
  const status = useMemo(() => (ride?.status ?? '').toUpperCase(), [ride?.status]);
  const canArrive = status === 'ASSIGNED' || status === 'REQUESTED';
  const canStart = status === 'ARRIVING';
  const canComplete = status === 'IN_PROGRESS';
  const primaryLabel = canStart ? 'BẮT ĐẦU' : 'ĐÃ ĐẾN';

  const handlePrimaryAction = async () => {
    if (!ride) return;
    if (!canArrive && !canStart) return;
    const nextStatus = canArrive ? 'ARRIVED' : 'STARTED';
    try {
      const res = await updateStatus(nextStatus);
      if (res) setActiveRide(res);
    } catch (err: any) {
      Alert.alert('Không thể cập nhật', err?.message ?? 'Đã có lỗi xảy ra');
    }
  };

  const handleComplete = async () => {
    if (!ride) return;
    if (!canComplete) {
      Alert.alert('Chưa thể kết thúc', 'Bạn cần bắt đầu chuyến trước khi kết thúc.');
      return;
    }
    try {
      const res = await updateStatus('COMPLETED');
      if (res) setActiveRide(res);
      router.push('/ride/complete');
    } catch (err: any) {
      Alert.alert('Không thể kết thúc', err?.message ?? 'Đã có lỗi xảy ra');
    }
  };

  if (!ride) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Chưa có chuyến đang chạy</Text>
          <Text style={styles.emptySubtitle}>Vui lòng nhận chuyến trước khi điều hướng.</Text>
          {error ? <Text style={styles.emptyError}>{error}</Text> : null}
          <PrimaryButton title="Về trang chính" onPress={() => router.replace('/')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <ScreenHeader
          title="Đang thực hiện cuốc"
          subtitle="Điều hướng đến điểm tiếp theo"
          variant="red"
          style={styles.header}>
          <View style={styles.headerMetrics}>
            <Text style={styles.metricValue}>--</Text>
            <Text style={styles.metricLabel}>Còn lại</Text>
            <Text style={styles.metricValue}>--</Text>
            <Text style={styles.metricLabel}>Đến điểm tiếp theo</Text>
          </View>
        </ScreenHeader>

        {(error || isOffline) && (
          <Card style={styles.errorCard}>
            <Text style={styles.errorText}>
              {isOffline ? 'Mất kết nối, đang thử lại...' : error}
            </Text>
          </Card>
        )}

        <View style={styles.map}>
          <View style={styles.mapRoute} />
          <View style={styles.mapDotStart} />
          <View style={styles.mapDotEnd} />
          <Text style={styles.mapText}>Bản đồ giả lập tuyến đường</Text>
        </View>

        <Card>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Khách</Text>
            <Text style={styles.value}>{ride.riderId ?? '--'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Điểm đón</Text>
            <Text style={styles.value}>
              {ride.pickupLat?.toFixed(5) ?? '--'},{ride.pickupLng?.toFixed(5) ?? '--'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Điểm đến</Text>
            <Text style={styles.value}>
              {ride.dropoffLat?.toFixed(5) ?? '--'},{ride.dropoffLng?.toFixed(5) ?? '--'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Thanh toán</Text>
            <Text style={styles.value}>--</Text>
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
            <PrimaryButton
              title={isUpdating ? 'ĐANG XỬ LÝ' : primaryLabel}
              variant="ghost"
              style={styles.statusButton}
              onPress={handlePrimaryAction}
              disabled={isUpdating || !(canArrive || canStart)}
            />
            <PrimaryButton
              title={isUpdating ? 'ĐANG XỬ LÝ' : 'KẾT THÚC'}
              style={styles.statusButton}
              onPress={handleComplete}
              disabled={isUpdating || !canComplete}
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
  emptyState: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.text,
  },
  emptySubtitle: {
    color: palette.muted,
    lineHeight: 20,
  },
  emptyError: {
    color: palette.redDark,
    fontSize: 12,
  },
  errorCard: {
    borderColor: palette.red,
    backgroundColor: '#FFF2ED',
  },
  errorText: {
    color: palette.redDark,
    fontSize: 12,
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
