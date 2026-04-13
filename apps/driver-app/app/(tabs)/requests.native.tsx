import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useRequests } from '@/hooks/use-requests';
import { useDriver } from '@/lib/contexts/driver';
import { useRide } from '@/lib/contexts/ride';
import * as rideApi from '@/src/services/rideApi';
import * as paymentApi from '@/lib/services/payment';
import { palette } from '@/lib/theme';

const paymentTags = ['Tiền mặt', 'Ví', 'Thẻ'];

const DEFAULT_REGION = {
  latitude: 10.76,
  longitude: 106.66,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01
};

type GeoPoint = {
  latitude: number;
  longitude: number;
};

const SMOOTHING_ALPHA = 0.2;
const MIN_MOVE_METERS = 4;

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function distanceMeters(a: GeoPoint, b: GeoPoint) {
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

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

export default function RequestsScreen() {
  const [ignoredRideId, setIgnoredRideId] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [fareText, setFareText] = useState('--');
  const [fareSubText, setFareSubText] = useState('dang cap nhat');
  const lastActionRef = useRef<string | null>(null);
  const lastAlertRideIdRef = useRef<string | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const locationRef = useRef<Location.LocationSubscription | null>(null);
  const smoothedRef = useRef<GeoPoint | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [driverLocation, setDriverLocation] = useState<GeoPoint>({
    latitude: DEFAULT_REGION.latitude,
    longitude: DEFAULT_REGION.longitude
  });
  const [zoomDelta, setZoomDelta] = useState({
    latitudeDelta: DEFAULT_REGION.latitudeDelta,
    longitudeDelta: DEFAULT_REGION.longitudeDelta
  });
  const { driver } = useDriver();
  const { setActiveRide } = useRide();
  const { incomingRide, isSearching, error, isOnline } = useRequests({
    intervalMs: 2500,
    limit: 1
  });
  const showError = false;

  const activeRequest = incomingRide && incomingRide.id !== ignoredRideId ? incomingRide : null;

  useEffect(() => {
    if (incomingRide && incomingRide.id !== ignoredRideId) {
      setIgnoredRideId(null);
    }
  }, [incomingRide, ignoredRideId]);

  useEffect(() => {
    let mounted = true;
    if (!activeRequest?.id) {
      setFareText('--');
      setFareSubText('dang cap nhat');
      return () => {
        mounted = false;
      };
    }

    setFareText('--');
    setFareSubText('dang cap nhat');

    paymentApi
      .getLatestPaymentByRideIds([activeRequest.externalRideId, activeRequest.id])
      .then((payment) => {
        if (!mounted) return;
        const amount = Number(payment?.amount);
        if (!Number.isFinite(amount)) {
          setFareText('--');
          setFareSubText('chua co du lieu');
          return;
        }
        setFareText(toCurrencyLabel(amount, payment?.currency || 'VND'));
        setFareSubText('tam tinh');
      })
      .catch(() => {
        if (!mounted) return;
        setFareText('--');
        setFareSubText('chua co du lieu');
      });

    return () => {
      mounted = false;
    };
  }, [activeRequest?.id]);

  // Hiển thị thông báo nhận chuyến ngay khi có ride mới
  useEffect(() => {
    if (!activeRequest) return;
    if (typeof activeRequest.id !== 'string' || !activeRequest.id) return;
    if (lastAlertRideIdRef.current === activeRequest.id) return;

    const visibleRideCode =
      typeof activeRequest.externalRideId === 'string' && activeRequest.externalRideId.trim() ? activeRequest.externalRideId : activeRequest.id;

    lastAlertRideIdRef.current = activeRequest.id;
    Alert.alert(
      'Chuyến mới',
      `#${visibleRideCode.slice(0, 6)} tại ${
        activeRequest.pickupLabel || `${formatCoordinate(activeRequest.pickupLat, 3)}, ${formatCoordinate(activeRequest.pickupLng, 3)}`
      }`,
      [
        {
          text: 'Từ chối',
          style: 'destructive',
          onPress: () => {
            void handleDecline();
          }
        },
        {
          text: 'Nhận ngay',
          onPress: () => {
            void handleAccept();
          }
        }
      ],
      { cancelable: true }
    );
  }, [activeRequest]);

  useEffect(() => {
    let isMounted = true;

    const startWatch = async () => {
      try {
        const current = await Location.getForegroundPermissionsAsync();
        if (current.status !== 'granted') {
          const requested = await Location.requestForegroundPermissionsAsync();
          if (requested.status !== 'granted') {
            if (isMounted) setGpsError('Chưa có quyền vị trí.');
            return;
          }
        }

        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000,
            distanceInterval: 5
          },
          (loc) => {
            const next = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude
            };
            const prev = smoothedRef.current ?? next;
            const smoothed = {
              latitude: prev.latitude + SMOOTHING_ALPHA * (next.latitude - prev.latitude),
              longitude: prev.longitude + SMOOTHING_ALPHA * (next.longitude - prev.longitude)
            };
            const delta = distanceMeters(prev, smoothed);
            if (delta >= MIN_MOVE_METERS || !smoothedRef.current) {
              smoothedRef.current = smoothed;
              if (isMounted) setDriverLocation(smoothed);
            }
            if (isMounted) setGpsError(null);
          }
        );
        locationRef.current = subscription;
      } catch (err: any) {
        if (isMounted) setGpsError(err?.message ?? 'Không thể lấy vị trí.');
      }
    };

    void startWatch();

    return () => {
      isMounted = false;
      if (locationRef.current) {
        locationRef.current.remove();
        locationRef.current = null;
      }
    };
  }, []);

  const requestTitle = useMemo(() => {
    const requestId =
      typeof activeRequest?.externalRideId === 'string' && activeRequest.externalRideId.trim()
        ? activeRequest.externalRideId
        : typeof activeRequest?.id === 'string'
          ? activeRequest.id
          : '';
    if (!requestId) return '--';
    return `Chuyến #${requestId.slice(0, 6)}`;
  }, [activeRequest]);

  const pickupPoint = useMemo(() => {
    if (!activeRequest) return null;
    if (typeof activeRequest.pickupLat !== 'number' || typeof activeRequest.pickupLng !== 'number') {
      return null;
    }
    return {
      latitude: activeRequest.pickupLat,
      longitude: activeRequest.pickupLng
    };
  }, [activeRequest]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.animateToRegion(
      {
        ...driverLocation,
        latitudeDelta: zoomDelta.latitudeDelta,
        longitudeDelta: zoomDelta.longitudeDelta
      },
      350
    );
  }, [driverLocation, zoomDelta]);

  const handleZoom = (factor: number) => {
    setZoomDelta((prev) => {
      const nextLat = Math.min(0.12, Math.max(0.001, prev.latitudeDelta * factor));
      const nextLng = Math.min(0.12, Math.max(0.001, prev.longitudeDelta * factor));
      return { latitudeDelta: nextLat, longitudeDelta: nextLng };
    });
  };

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
    const alreadyOwned = activeRequest.driverId === principalDriverId && ['ASSIGNED', 'ARRIVING', 'IN_PROGRESS'].includes(currentStatus);
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
          ['ASSIGNED', 'ARRIVING', 'IN_PROGRESS'].includes(String(activeRequest.status || '').toUpperCase());
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
          <MapView
            ref={(ref: any) => {
              mapRef.current = ref;
            }}
            style={StyleSheet.absoluteFillObject}
            initialRegion={DEFAULT_REGION}
            provider={PROVIDER_GOOGLE}
            scrollEnabled={false}
            zoomEnabled={false}
          >
            <Marker coordinate={driverLocation} title="Tài xế" description="Vị trí hiện tại" />
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
          <Text style={styles.mapText}>{gpsError ? gpsError : 'Khu vực trung tâm, Q1'}</Text>
        </View>

        {!activeRequest ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>{isSearching ? 'Đang tải yêu cầu...' : isOnline ? 'Chưa có yêu cầu mới' : 'Tài xế đang OFFLINE'}</Text>
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
                <Text style={styles.priceText}>{fareText}</Text>
                <Text style={styles.priceSub}>{fareSubText}</Text>
              </View>
            </View>

            <View style={styles.chipRow}>
              <View style={styles.chip}>
                <Text style={styles.chipText}>Tiêu chuẩn</Text>
              </View>
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  {activeRequest.pickupLabel || `${formatCoordinate(activeRequest.pickupLat, 3)},${formatCoordinate(activeRequest.pickupLng, 3)}`}
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
                  {activeRequest.pickupLabel || `${formatCoordinate(activeRequest.pickupLat, 5)},${formatCoordinate(activeRequest.pickupLng, 5)}`}
                </Text>
                <Text style={styles.label}>Điểm đến</Text>
                <Text style={styles.value}>
                  {activeRequest.dropoffLabel || `${formatCoordinate(activeRequest.dropoffLat, 5)},${formatCoordinate(activeRequest.dropoffLng, 5)}`}
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
                disabled={isAccepting || isRejecting}
              >
                <Text style={styles.secondaryText}>Từ chối</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primary, (isAccepting || isRejecting) && styles.disabledButton]}
                onPress={handleAccept}
                disabled={isAccepting || isRejecting}
              >
                <Text style={styles.primaryText}>{isAccepting ? 'Đang nhận...' : 'Nhận chuyến'}</Text>
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
    backgroundColor: palette.background
  },
  container: {
    padding: 20,
    paddingBottom: 32,
    gap: 16
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.text
  },
  timerPill: {
    backgroundColor: palette.redSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999
  },
  timerText: {
    color: palette.redDark,
    fontWeight: '700',
    fontSize: 12
  },
  mapPreview: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
    minHeight: 280,
    borderRadius: 20,
    justifyContent: 'flex-end',
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
  mapText: {
    textAlign: 'center',
    color: palette.muted,
    fontSize: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'center',
    paddingHorizontal: 10
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
  card: {
    backgroundColor: palette.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border
  },
  emptyText: {
    color: palette.muted,
    textAlign: 'center'
  },
  emptySub: {
    color: palette.muted,
    textAlign: 'center',
    marginTop: 6,
    fontSize: 12
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12
  },
  eyebrow: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: palette.muted
  },
  requestTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.text,
    marginTop: 4
  },
  pricePill: {
    backgroundColor: palette.redSoft,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center'
  },
  priceText: {
    color: palette.redDark,
    fontWeight: '700',
    fontSize: 14
  },
  priceSub: {
    color: palette.muted,
    fontSize: 10
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border
  },
  chipText: {
    color: palette.text,
    fontSize: 12
  },
  timeline: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12
  },
  timelineLine: {
    width: 12,
    alignItems: 'center'
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.red
  },
  timelineBar: {
    width: 2,
    flex: 1,
    backgroundColor: palette.border,
    marginVertical: 4
  },
  timelineDotOutline: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: palette.red,
    backgroundColor: '#fff'
  },
  timelineContent: {
    flex: 1,
    gap: 6
  },
  label: {
    fontSize: 12,
    color: palette.muted
  },
  value: {
    color: palette.text,
    fontWeight: '600'
  },
  noteBox: {
    backgroundColor: palette.redSoft,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12
  },
  noteLabel: {
    fontSize: 12,
    color: palette.muted
  },
  noteText: {
    color: palette.text,
    marginTop: 6
  },
  actions: {
    flexDirection: 'row',
    gap: 12
  },
  disabledButton: {
    opacity: 0.6
  },
  primary: {
    flex: 1,
    backgroundColor: palette.red,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700'
  },
  secondary: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#fff'
  },
  secondaryText: {
    color: palette.redDark,
    fontWeight: '700'
  }
});
