import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/MainStack';
import { LiveRouteMap } from '../../components/map/LiveRouteMap';
import { DriverInfoCard } from '../../components/customer/DriverInfoCard';
import { OutlineButton } from '../../components/common/OutlineButton';
import { spacing, typography } from '../../theme/tokens';
import { useCustomerStore } from '../../store/customerStore';
import { customerApi } from '../../services/customerApi';
import { useRealtimeStream } from '../../hooks/useRealtimeStream';
import { useToast } from '../../hooks/useToast';
import { useAppPalette } from '../../theme/palette';
import { useScreenMetrics } from '../../hooks/useScreenMetrics';
import { StateView } from '../../components/common/StateView';

function rideStatusLabel(status: string | null | undefined) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'requested') return 'Đã yêu cầu';
  if (normalized === 'assigned') return 'Đã ghép tài xế';
  if (normalized === 'arriving') return 'Tài xế đang tới điểm đón';
  if (normalized === 'in_progress') return 'Đang di chuyển';
  if (normalized === 'completed') return 'Hoàn thành';
  if (normalized === 'cancelled') return 'Đã hủy';
  return 'Không xác định';
}

const RideTrackingScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { activeRide, decreaseEta, refreshActiveRide } = useCustomerStore();
  const { latestEvent } = useRealtimeStream();
  const { push } = useToast();
  const palette = useAppPalette();
  const metrics = useScreenMetrics();

  const [eta, setEta] = useState(activeRide?.etaMinutes || 5);
  const [driverInfoTimeout, setDriverInfoTimeout] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{ label: string; lat: number; lng: number } | null>(null);
  const hasHandledTerminalStatusRef = useRef(false);
  const panelAnim = useRef(new Animated.Value(0)).current;

  const destinationCoordinate = useMemo(() => {
    if (!activeRide) return null;
    return {
      label: activeRide.destination,
      lat: activeRide.dropoffLat,
      lng: activeRide.dropoffLng
    };
  }, [activeRide]);

  useEffect(() => {
    if (!activeRide) return;
    setEta(activeRide.etaMinutes);
    const id = setInterval(() => {
      decreaseEta();
      setEta((prev) => Math.max(prev - 1, 1));
    }, 3000);
    return () => clearInterval(id);
  }, [activeRide, decreaseEta]);

  useEffect(() => {
    if (latestEvent?.type !== 'driver_location') return;
    if (latestEvent.etaMinutes) {
      setEta(latestEvent.etaMinutes);
    }
    if (Number.isFinite(latestEvent.lat) && Number.isFinite(latestEvent.lng)) {
      setDriverLocation({
        label: activeRide?.driver?.name ? `Tài xế ${activeRide.driver.name}` : 'Tài xế',
        lat: latestEvent.lat,
        lng: latestEvent.lng
      });
    }
  }, [activeRide?.driver?.name, latestEvent]);

  useEffect(() => {
    setDriverLocation(null);
  }, [activeRide?.id]);

  useEffect(() => {
    if (!activeRide?.id) return;

    let disposed = false;
    const poll = async () => {
      const updated = await refreshActiveRide();
      if (disposed || !updated) return;
      if (updated.etaMinutes) {
        setEta(updated.etaMinutes);
      }
    };

    void poll();
    const intervalId = setInterval(() => {
      void poll();
    }, 4000);

    return () => {
      disposed = true;
      clearInterval(intervalId);
    };
  }, [activeRide?.id, refreshActiveRide]);

  useEffect(() => {
    hasHandledTerminalStatusRef.current = false;
  }, [activeRide?.id]);

  useEffect(() => {
    const status = String(activeRide?.status || '').toLowerCase();
    if (!status || hasHandledTerminalStatusRef.current) return;

    if (status === 'completed') {
      hasHandledTerminalStatusRef.current = true;
      push('Chuyến đi đã hoàn tất. Chuyển sang thanh toán.', 'info');
      navigation.replace('Payment');
      return;
    }

    if (status === 'cancelled') {
      hasHandledTerminalStatusRef.current = true;
      push('Chuyến đi đã bị hủy.', 'danger');
      navigation.popToTop();
    }
  }, [activeRide?.status, navigation, push]);

  useEffect(() => {
    if (!activeRide?.driverId || activeRide.driver) {
      setDriverInfoTimeout(false);
      return;
    }
    const timeoutId = setTimeout(() => {
      setDriverInfoTimeout(true);
    }, 15000);
    return () => clearTimeout(timeoutId);
  }, [activeRide?.driver, activeRide?.driverId]);

  useEffect(() => {
    Animated.timing(panelAnim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [panelAnim]);

  if (!activeRide) {
    return (
      <View style={[styles.emptyWrap, { backgroundColor: palette.bg, paddingHorizontal: metrics.horizontalPadding }]}> 
        <View style={[styles.emptyContent, { maxWidth: metrics.contentMaxWidth }]}>
          <StateView type="empty" title="Không tìm thấy chuyến đi" message="Vui lòng quay lại trang chủ để đặt chuyến mới." />
        </View>
      </View>
    );
  }

  if (!activeRide.driverId) {
    return (
      <View style={[styles.emptyWrap, { backgroundColor: palette.bg, paddingHorizontal: metrics.horizontalPadding }]}> 
        <View style={[styles.emptyContent, { maxWidth: metrics.contentMaxWidth }]}>
          <StateView type="loading" title="Đang tìm tài xế phù hợp" message="Hệ thống đang ghép tài xế gần bạn nhất." />
        </View>
      </View>
    );
  }

  if (!activeRide.driver) {
    return (
      <View style={[styles.emptyWrap, { backgroundColor: palette.bg, paddingHorizontal: metrics.horizontalPadding }]}> 
        <View style={[styles.emptyContent, { maxWidth: metrics.contentMaxWidth }]}>
          <StateView
            type={driverInfoTimeout ? 'error' : 'loading'}
            title={driverInfoTimeout ? 'Không tải được tài xế' : 'Đang tải thông tin tài xế'}
            message={driverInfoTimeout ? 'Vui lòng thử lại để đồng bộ dữ liệu chuyến đi.' : 'Vui lòng chờ trong giây lát.'}
            actionLabel={driverInfoTimeout ? 'Thử lại' : undefined}
            onAction={driverInfoTimeout ? () => {
              setDriverInfoTimeout(false);
              void refreshActiveRide();
            } : undefined}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}> 
      <View style={styles.mapArea}>
        <LiveRouteMap
          destination={destinationCoordinate}
          driverLocation={driverLocation}
          etaMinutes={eta}
          onLocationChange={(coords) => customerApi.setLivePickupLocation(coords.latitude, coords.longitude)}
        />
      </View>

      <Animated.View
        style={[
          styles.panel,
          {
            left: metrics.horizontalPadding,
            right: metrics.horizontalPadding,
            borderColor: palette.border,
            backgroundColor: palette.surface,
            opacity: panelAnim,
            transform: [
              {
                translateY: panelAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] })
              }
            ]
          }
        ]}
      >
        <DriverInfoCard driver={activeRide.driver} etaMinutes={eta} />
        <Text style={[styles.syncText, { color: palette.muted }]}>Trạng thái chuyến đi: {rideStatusLabel(activeRide.status)}</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapArea: { flex: 1 },
  panel: {
    position: 'absolute',
    bottom: spacing.xl,
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.sm,
    gap: spacing.sm
  },
  syncText: { ...typography.caption, textAlign: 'center' },
  emptyWrap: { flex: 1, justifyContent: 'center' },
  emptyContent: { width: '100%', alignSelf: 'center' }
});

export default RideTrackingScreen;
