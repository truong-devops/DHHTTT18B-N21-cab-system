import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { router } from 'expo-router';
import { Card } from '@/components/ui/card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useRide as useRideState } from '@/hooks/use-ride';
import { useRoutePolyline } from '@/hooks/use-route-polyline';
import { useRide } from '@/lib/contexts/ride';
import { useDriver } from '@/lib/contexts/driver';
import * as paymentApi from '@/lib/services/payment';
import { palette } from '@/lib/theme';

function formatCoordinate(value: unknown, digits: number) {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toFixed(digits);
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed.toFixed(digits);
  }
  return '--';
}

function toCurrencyLabel(amount: number | null | undefined, currency = 'VND') {
  if (!Number.isFinite(amount as number)) return '--';
  const safeAmount = Math.round(Number(amount));
  const safeCurrency = String(currency || 'VND').toUpperCase();
  if (safeCurrency === 'VND') {
    return `${safeAmount.toLocaleString('vi-VN')} d`;
  }
  return `${safeAmount.toLocaleString('vi-VN')} ${safeCurrency}`;
}

export default function RideNavigationScreen() {
  const mapRef = useRef<MapView | null>(null);
  const { activeRide, setActiveRide } = useRide();
  const { driver } = useDriver();
  const rideId = activeRide?.id ?? null;
  const {
    ride: trackedRide,
    error,
    isOffline,
    updateStatus,
    isUpdating
  } = useRideState({
    rideId,
    enabled: Boolean(rideId),
    intervalMs: 2500
  });

  useEffect(() => {
    if (trackedRide) {
      setActiveRide(trackedRide);
    }
  }, [trackedRide, setActiveRide]);

  const ride = trackedRide ?? activeRide;
  const [fareLabel, setFareLabel] = useState('--');

  useEffect(() => {
    let mounted = true;
    if (!ride?.id) {
      setFareLabel('--');
      return () => {
        mounted = false;
      };
    }

    setFareLabel('--');
    paymentApi
      .getLatestPaymentByRideIds([ride.externalRideId, ride.id])
      .then((payment) => {
        if (!mounted) return;
        const amount = Number(payment?.amount);
        if (!Number.isFinite(amount)) {
          setFareLabel('--');
          return;
        }
        setFareLabel(toCurrencyLabel(amount, payment?.currency || 'VND'));
      })
      .catch(() => {
        if (!mounted) return;
        setFareLabel('--');
      });

    return () => {
      mounted = false;
    };
  }, [ride?.id]);

  const status = useMemo(() => (ride?.status ?? '').toUpperCase(), [ride?.status]);
  const canArrive = status === 'ASSIGNED' || status === 'REQUESTED';
  const canStart = status === 'ARRIVING';
  const canComplete = status === 'IN_PROGRESS';
  const primaryLabel = canStart ? 'BẮT ĐẦU' : 'ĐÃ ĐẾN';

  const pickupPoint = useMemo(() => {
    if (typeof ride?.pickupLat !== 'number' || typeof ride?.pickupLng !== 'number') return null;
    return { latitude: ride.pickupLat, longitude: ride.pickupLng };
  }, [ride?.pickupLat, ride?.pickupLng]);

  const dropoffPoint = useMemo(() => {
    if (typeof ride?.dropoffLat !== 'number' || typeof ride?.dropoffLng !== 'number') return null;
    return { latitude: ride.dropoffLat, longitude: ride.dropoffLng };
  }, [ride?.dropoffLat, ride?.dropoffLng]);

  const driverPoint = useMemo(() => {
    const lat = driver?.location?.lat;
    const lng = driver?.location?.lng;
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    return { latitude: lat, longitude: lng };
  }, [driver?.location?.lat, driver?.location?.lng]);

  const isOnTrip = status === 'IN_PROGRESS' || status === 'STARTED';
  const isCompleted = status === 'COMPLETED';

  const routeProfile = useMemo(() => {
    const raw = String(ride?.vehicleType ?? '').toUpperCase();
    if (raw.includes('BIKE') || raw.includes('MOTOR')) return 'motorbike';
    return 'car';
  }, [ride?.vehicleType]);

  const routeOrigin = useMemo(() => {
    if (isCompleted) return null;
    if (isOnTrip) return driverPoint ?? pickupPoint;
    if (driverPoint && pickupPoint) return driverPoint;
    return null;
  }, [driverPoint, isCompleted, isOnTrip, pickupPoint]);

  const routeDestination = useMemo(() => {
    if (isCompleted) return null;
    if (isOnTrip) return dropoffPoint;
    if (driverPoint && pickupPoint) return pickupPoint;
    return null;
  }, [driverPoint, dropoffPoint, isCompleted, isOnTrip, pickupPoint]);

  const {
    coords: routeCoords,
    isLoading: isRouteLoading,
    error: routeError
  } = useRoutePolyline({
    origin: routeOrigin,
    destination: routeDestination,
    profile: routeProfile
  });

  const centerPoint = useMemo(() => {
    if (isCompleted) return pickupPoint ?? driverPoint;
    if (isOnTrip && pickupPoint && dropoffPoint) {
      return {
        latitude: (pickupPoint.latitude + dropoffPoint.latitude) / 2,
        longitude: (pickupPoint.longitude + dropoffPoint.longitude) / 2
      };
    }
    return driverPoint ?? pickupPoint ?? dropoffPoint ?? null;
  }, [driverPoint, dropoffPoint, isCompleted, isOnTrip, pickupPoint]);

  const routePoints = useMemo(() => {
    if (isCompleted) return [];
    if (routeOrigin && routeDestination) return [routeOrigin, routeDestination];
    if (routeDestination) return [routeDestination];
    return [];
  }, [isCompleted, routeOrigin, routeDestination]);

  const polylineCoords = routeCoords.length >= 2 ? routeCoords : routePoints;

  const [zoomDelta, setZoomDelta] = useState({
    latitudeDelta: 0.02,
    longitudeDelta: 0.02
  });
  const [isMapOpen, setIsMapOpen] = useState(false);

  useEffect(() => {
    if (!mapRef.current || !centerPoint) return;
    mapRef.current.animateToRegion(
      {
        ...centerPoint,
        latitudeDelta: zoomDelta.latitudeDelta,
        longitudeDelta: zoomDelta.longitudeDelta
      },
      350
    );
  }, [centerPoint, zoomDelta]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (polylineCoords.length < 2) return;
    mapRef.current.fitToCoordinates(polylineCoords, {
      edgePadding: { top: 80, bottom: 120, left: 60, right: 60 },
      animated: true
    });
  }, [polylineCoords]);

  const handleZoom = (factor: number) => {
    setZoomDelta((prev) => {
      const nextLat = Math.min(0.2, Math.max(0.001, prev.latitudeDelta * factor));
      const nextLng = Math.min(0.2, Math.max(0.001, prev.longitudeDelta * factor));
      return { latitudeDelta: nextLat, longitudeDelta: nextLng };
    });
  };

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
        <ScreenHeader title="Đang thực hiện cuốc" subtitle="Điều hướng đến điểm tiếp theo" variant="red" style={styles.header}>
          <View style={styles.headerMetrics}>
            <Text style={styles.metricValue}>--</Text>
            <Text style={styles.metricLabel}>Còn lại</Text>
            <Text style={styles.metricValue}>--</Text>
            <Text style={styles.metricLabel}>Đến điểm tiếp theo</Text>
          </View>
        </ScreenHeader>

        {(error || isOffline) && (
          <Card style={styles.errorCard}>
            <Text style={styles.errorText}>{isOffline ? 'Mất kết nối, đang thử lại...' : error}</Text>
          </Card>
        )}
        {routeError && (
          <Card style={styles.routeErrorCard}>
            <Text style={styles.routeErrorText}>Đang load dữ liệu....</Text>
          </Card>
        )}
        {isRouteLoading && <Text style={styles.routeLoadingText}>Đang lấy đường đi thật...</Text>}

        <View style={styles.map}>
          <MapView
            ref={(ref: any) => {
              mapRef.current = ref;
            }}
            style={StyleSheet.absoluteFillObject}
            initialRegion={{
              latitude: ride?.pickupLat ?? 10.76,
              longitude: ride?.pickupLng ?? 106.66,
              latitudeDelta: zoomDelta.latitudeDelta,
              longitudeDelta: zoomDelta.longitudeDelta
            }}
            provider={PROVIDER_GOOGLE}
          >
            {driverPoint && !isOnTrip ? <Marker coordinate={driverPoint} title="Tài xế" pinColor={palette.redDark} /> : null}
            {pickupPoint ? <Marker coordinate={pickupPoint} title="Điểm đón" pinColor={palette.red} /> : null}
            {dropoffPoint ? <Marker coordinate={dropoffPoint} title="Điểm đến" pinColor={palette.redDark} /> : null}
            {polylineCoords.length >= 2 ? <Polyline coordinates={polylineCoords} strokeColor={palette.red} strokeWidth={4} /> : null}
          </MapView>
          <View style={styles.mapBadge}>
            <Text style={styles.mapBadgeText}>Bản đồ</Text>
          </View>
          <View style={styles.zoomControls}>
            <TouchableOpacity style={styles.zoomButton} onPress={() => handleZoom(0.7)}>
              <Text style={styles.zoomText}>＋</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.zoomButton} onPress={() => handleZoom(1.3)}>
              <Text style={styles.zoomText}>－</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.mapAction} onPress={() => setIsMapOpen(true)}>
            <MaterialIcons name="fullscreen" size={18} color={palette.redDark} />
          </TouchableOpacity>
        </View>

        <Card>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Khách</Text>
            <Text style={styles.value}>{ride.riderId ?? '--'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Điểm đón</Text>
            <Text style={styles.value}>{ride.pickupLabel || `${formatCoordinate(ride.pickupLat, 5)},${formatCoordinate(ride.pickupLng, 5)}`}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Điểm đến</Text>
            <Text style={styles.value}>{ride.dropoffLabel || `${formatCoordinate(ride.dropoffLat, 5)},${formatCoordinate(ride.dropoffLng, 5)}`}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Thanh toán</Text>
            <Text style={styles.value}>{fareLabel}</Text>
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
        <FullscreenMap
          visible={isMapOpen}
          onClose={() => setIsMapOpen(false)}
          ride={ride}
          driverPoint={driverPoint}
          pickupPoint={pickupPoint}
          dropoffPoint={dropoffPoint}
          routePoints={routePoints}
          routeCoords={polylineCoords}
          zoomDelta={zoomDelta}
        />
      </View>
    </SafeAreaView>
  );
}

function FullscreenMap({
  visible,
  onClose,
  ride,
  driverPoint,
  pickupPoint,
  dropoffPoint,
  routePoints,
  routeCoords,
  zoomDelta
}: {
  visible: boolean;
  onClose: () => void;
  ride: any;
  driverPoint: { latitude: number; longitude: number } | null;
  pickupPoint: { latitude: number; longitude: number } | null;
  dropoffPoint: { latitude: number; longitude: number } | null;
  routePoints: { latitude: number; longitude: number }[];
  routeCoords: { latitude: number; longitude: number }[];
  zoomDelta: { latitudeDelta: number; longitudeDelta: number };
}) {
  const polylineCoords = routeCoords.length >= 2 ? routeCoords : routePoints;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Bản đồ</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Text style={styles.modalCloseText}>Đóng</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.modalMap}>
          <MapView
            style={StyleSheet.absoluteFillObject}
            initialRegion={{
              latitude: ride?.pickupLat ?? 10.76,
              longitude: ride?.pickupLng ?? 106.66,
              latitudeDelta: zoomDelta.latitudeDelta,
              longitudeDelta: zoomDelta.longitudeDelta
            }}
            provider={PROVIDER_GOOGLE}
          >
            {driverPoint ? <Marker coordinate={driverPoint} title="Tài xế" pinColor={palette.redDark} /> : null}
            {pickupPoint ? <Marker coordinate={pickupPoint} title="Điểm đón" pinColor={palette.red} /> : null}
            {dropoffPoint ? <Marker coordinate={dropoffPoint} title="Điểm đến" pinColor={palette.redDark} /> : null}
            {polylineCoords.length >= 2 ? <Polyline coordinates={polylineCoords} strokeColor={palette.red} strokeWidth={4} /> : null}
          </MapView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: palette.background
  },
  emptyState: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    gap: 12
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.text
  },
  emptySubtitle: {
    color: palette.muted,
    lineHeight: 20
  },
  emptyError: {
    color: palette.redDark,
    fontSize: 12
  },
  errorCard: {
    borderColor: palette.red,
    backgroundColor: '#FFF2ED'
  },
  errorText: {
    color: palette.redDark,
    fontSize: 12
  },
  routeErrorCard: {
    borderColor: palette.red,
    backgroundColor: '#FFF2ED'
  },
  routeErrorText: {
    color: palette.redDark,
    fontSize: 12
  },
  routeLoadingText: {
    color: palette.muted,
    fontSize: 12
  },
  container: {
    flex: 1,
    padding: 20,
    gap: 16
  },
  header: {
    gap: 12
  },
  headerMetrics: {
    alignItems: 'flex-end',
    gap: 2
  },
  metricValue: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14
  },
  metricLabel: {
    color: '#FFE7DE',
    fontSize: 10,
    marginBottom: 6
  },
  map: {
    flex: 1,
    backgroundColor: palette.redSoft,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden'
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
    borderColor: palette.border
  },
  mapBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: palette.redDark
  },
  zoomControls: {
    position: 'absolute',
    right: 12,
    top: 12,
    gap: 8
  },
  zoomButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border
  },
  zoomText: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.redDark
  },
  mapAction: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalSafe: {
    flex: 1,
    backgroundColor: palette.background
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text
  },
  modalClose: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: palette.border
  },
  modalCloseText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.redDark
  },
  modalMap: {
    flex: 1,
    backgroundColor: palette.surface
  },
  infoRow: {
    marginBottom: 10
  },
  label: {
    color: palette.muted,
    fontSize: 12
  },
  value: {
    color: palette.text,
    fontWeight: '600',
    marginTop: 4
  },
  bottomBar: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 12,
    gap: 12
  },
  quickAction: {
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center'
  },
  quickActionText: {
    color: palette.redDark,
    fontWeight: '600'
  },
  statusGroup: {
    flexDirection: 'row',
    gap: 12
  },
  statusButton: {
    flex: 1
  }
});
