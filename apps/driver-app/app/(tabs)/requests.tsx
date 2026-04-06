import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useRequests } from '@/hooks/use-requests';
import { useDriver } from '@/lib/contexts/driver';
import { useRide } from '@/lib/contexts/ride';
import * as rideApi from '@/src/services/rideApi';
import { palette } from '@/lib/theme';

const paymentTags = ['Tiền mặt', 'Ví', 'Thẻ'];

function formatCoordinate(value: unknown, digits: number) {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toFixed(digits);
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed.toFixed(digits);
  }
  return '--';
}

export default function RequestsScreen() {
  const [ignoredRideId, setIgnoredRideId] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const lastActionRef = useRef<string | null>(null);
  const { driver } = useDriver();
  const { setActiveRide } = useRide();
  const { incomingRide, isSearching, error, isOnline } = useRequests({
    intervalMs: 2500,
    limit: 1,
  });
  const showError = false;

  const activeRequest =
    incomingRide && incomingRide.id !== ignoredRideId ? incomingRide : null;

  useEffect(() => {
    if (incomingRide && incomingRide.id !== ignoredRideId) {
      setIgnoredRideId(null);
    }
  }, [incomingRide, ignoredRideId]);

  const requestTitle = useMemo(() => {
    const requestId = typeof activeRequest?.id === 'string' ? activeRequest.id : '';
    if (!requestId) return '--';
    return `Chuyến #${requestId.slice(0, 6)}`;
  }, [activeRequest]);

  const handleAccept = async () => {
    if (!activeRequest) return;
    if (!activeRequest.id) {
      Alert.alert('Thiếu dữ liệu chuyến', 'Không tìm thấy mã chuyến hợp lệ.');
      return;
    }
    const principalDriverId = driver?.userId || driver?.id;
    if (!principalDriverId) {
      Alert.alert('Thiếu hồ sơ', 'Không tìm thấy driverId. Hãy đăng nhập lại.');
      return;
    }
    const currentStatus = String(activeRequest.status || '').toUpperCase();
    const alreadyOwned =
      activeRequest.driverId === principalDriverId &&
      ['ASSIGNED', 'ARRIVING', 'IN_PROGRESS'].includes(currentStatus);
    if (alreadyOwned) {
      setActiveRide(activeRequest);
      router.push('/ride/navigation');
      return;
    }
    const actionKey = `accept:${activeRequest.id}`;
    if (lastActionRef.current === actionKey) return;
    lastActionRef.current = actionKey;
    setIsAccepting(true);
    try {
      const res = await rideApi.acceptRide(activeRequest.id, principalDriverId);
      setActiveRide(res.data);
      router.push('/ride/navigation');
    } catch (err: any) {
      if (err?.status === 409 || err?.code === 'INVALID_STATE_TRANSITION') {
        const stillOwned =
          activeRequest.driverId === principalDriverId &&
          ['ASSIGNED', 'ARRIVING', 'IN_PROGRESS'].includes(
            String(activeRequest.status || '').toUpperCase(),
          );
        if (stillOwned) {
          setActiveRide(activeRequest);
          router.push('/ride/navigation');
          return;
        }
        Alert.alert('Chuyến đã thay đổi', 'Chuyến này đã được nhận hoặc đã hết hiệu lực.');
        setIgnoredRideId(activeRequest.id);
        return;
      }
      Alert.alert('Không thể nhận chuyến', err?.message ?? 'Đã có lỗi xảy ra');
    } finally {
      setIsAccepting(false);
      if (lastActionRef.current === actionKey) {
        lastActionRef.current = null;
      }
    }
  };

  const handleDecline = async () => {
    if (!activeRequest) return;
    if (!activeRequest.id) {
      Alert.alert('Thiếu dữ liệu chuyến', 'Không tìm thấy mã chuyến hợp lệ.');
      return;
    }
    const actionKey = `reject:${activeRequest.id}`;
    if (lastActionRef.current === actionKey) return;
    lastActionRef.current = actionKey;
    setIsRejecting(true);
    try {
      await rideApi.rejectRide(activeRequest.id, 'DRIVER_REJECTED');
      setIgnoredRideId(activeRequest.id);
    } catch (err: any) {
      if (err?.status === 409 || err?.code === 'INVALID_STATE_TRANSITION') {
        Alert.alert('Chuyến đã thay đổi', 'Chuyến này đã được nhận hoặc đã hết hiệu lực.');
        setIgnoredRideId(activeRequest.id);
        return;
      }
      Alert.alert('Không thể từ chối', err?.message ?? 'Đã có lỗi xảy ra');
    } finally {
      setIsRejecting(false);
      if (lastActionRef.current === actionKey) {
        lastActionRef.current = null;
      }
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Chuyến nhận</Text>
          <View style={styles.timerPill}>
            <Text style={styles.timerText}>03:24</Text>
          </View>
        </View>

        <View style={styles.mapPreview}>
          <View style={styles.mapBadge}>
            <Text style={styles.mapBadgeText}>Bản đồ giả lập</Text>
          </View>
          <View style={styles.mapPin} />
          <Text style={styles.mapText}>Khu vực trung tâm, Q1</Text>
        </View>

        {!activeRequest ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>
              {isSearching ? 'Đang tải yêu cầu...' : isOnline ? 'Chưa có yêu cầu mới' : 'Tài xế đang OFFLINE'}
            </Text>
            {showError && error ? <Text style={styles.emptySub}>{error}</Text> : null}
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.eyebrow}>Yêu cầu mới</Text>
                <Text style={styles.requestTitle}>{requestTitle}</Text>
              </View>
              <View style={styles.pricePill}>
                <Text style={styles.priceText}>--</Text>
                <Text style={styles.priceSub}>đang cập nhật</Text>
              </View>
            </View>

            <View style={styles.chipRow}>
              <View style={styles.chip}>
                <Text style={styles.chipText}>Tiêu chuẩn</Text>
              </View>
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  {activeRequest.pickupLabel ||
                    `${formatCoordinate(activeRequest.pickupLat, 3)},${formatCoordinate(activeRequest.pickupLng, 3)}`}
                </Text>
              </View>
              <View style={styles.chip}>
                <Text style={styles.chipText}>{paymentTags[0]}</Text>
              </View>
            </View>

            <View style={styles.timeline}>
              <View style={styles.timelineLine}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineBar} />
                <View style={styles.timelineDotOutline} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.label}>Điểm đón</Text>
                <Text style={styles.value}>
                  {activeRequest.pickupLabel ||
                    `${formatCoordinate(activeRequest.pickupLat, 5)},${formatCoordinate(activeRequest.pickupLng, 5)}`}
                </Text>
                <Text style={styles.label}>Điểm đến</Text>
                <Text style={styles.value}>
                  {activeRequest.dropoffLabel ||
                    `${formatCoordinate(activeRequest.dropoffLat, 5)},${formatCoordinate(activeRequest.dropoffLng, 5)}`}
                </Text>
              </View>
            </View>

            <View style={styles.noteBox}>
              <Text style={styles.noteLabel}>Ghi chú</Text>
              <Text style={styles.noteText}>Chưa có</Text>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.secondary, (isAccepting || isRejecting) && styles.disabledButton]}
                onPress={handleDecline}
                disabled={isAccepting || isRejecting}>
                <Text style={styles.secondaryText}>Từ chối</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primary, (isAccepting || isRejecting) && styles.disabledButton]}
                onPress={handleAccept}
                disabled={isAccepting || isRejecting}>
                <Text style={styles.primaryText}>
                  {isAccepting ? 'Đang nhận...' : 'Nhận chuyến'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.text,
  },
  timerPill: {
    backgroundColor: palette.redSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  timerText: {
    color: palette.redDark,
    fontWeight: '700',
    fontSize: 12,
  },
  mapPreview: {
    backgroundColor: palette.redSoft,
    borderRadius: 20,
    padding: 16,
    minHeight: 140,
    justifyContent: 'flex-end',
    position: 'relative',
  },
  mapBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: palette.border,
  },
  mapBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: palette.redDark,
  },
  mapPin: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: palette.red,
    alignSelf: 'center',
  },
  mapText: {
    textAlign: 'center',
    color: palette.muted,
    fontSize: 12,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  emptyText: {
    color: palette.muted,
    textAlign: 'center',
  },
  emptySub: {
    color: palette.muted,
    textAlign: 'center',
    marginTop: 6,
    fontSize: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  eyebrow: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: palette.muted,
  },
  requestTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.text,
    marginTop: 4,
  },
  pricePill: {
    backgroundColor: palette.redSoft,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  priceText: {
    color: palette.redDark,
    fontWeight: '700',
    fontSize: 14,
  },
  priceSub: {
    color: palette.muted,
    fontSize: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
  },
  chipText: {
    color: palette.text,
    fontSize: 12,
  },
  timeline: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  timelineLine: {
    width: 12,
    alignItems: 'center',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.red,
  },
  timelineBar: {
    width: 2,
    flex: 1,
    backgroundColor: palette.border,
    marginVertical: 4,
  },
  timelineDotOutline: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: palette.red,
    backgroundColor: '#fff',
  },
  timelineContent: {
    flex: 1,
    gap: 6,
  },
  label: {
    fontSize: 12,
    color: palette.muted,
  },
  value: {
    color: palette.text,
    fontWeight: '600',
  },
  noteBox: {
    backgroundColor: palette.redSoft,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  noteLabel: {
    fontSize: 12,
    color: palette.muted,
  },
  noteText: {
    color: palette.text,
    marginTop: 6,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
  primary: {
    flex: 1,
    backgroundColor: palette.red,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700',
  },
  secondary: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  secondaryText: {
    color: palette.redDark,
    fontWeight: '700',
  },
});
