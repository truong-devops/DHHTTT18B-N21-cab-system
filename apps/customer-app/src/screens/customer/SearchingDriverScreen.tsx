import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/MainStack';
import { CustomerLiveMap } from '../../components/map/CustomerLiveMap';
import { OutlineButton } from '../../components/common/OutlineButton';
import { useCustomerStore } from '../../store/customerStore';
import { useToast } from '../../hooks/useToast';
import { useRealtimeStream } from '../../hooks/useRealtimeStream';
import { customerApi } from '../../services/customerApi';
import { destinationPoints } from '../../mock/data';
import { colors, spacing, typography } from '../../theme/tokens';
import { useAppPalette } from '../../theme/palette';
import { useScreenMetrics } from '../../hooks/useScreenMetrics';

type MapCoordinate = {
  latitude: number;
  longitude: number;
  label?: string;
};

const SearchingDriverScreen = () => {
  const route = useRoute<RouteProp<MainStackParamList, 'SearchingDriver'>>();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { startRide, activeRide, assignDriverToActiveRide, refreshActiveRide, cancelActiveRide } = useCustomerStore();
  const { push } = useToast();
  const { latestEvent, nearbyDrivers } = useRealtimeStream();
  const palette = useAppPalette();
  const metrics = useScreenMetrics();

  const [status, setStatus] = useState<'searching' | 'found'>('searching');
  const [seconds, setSeconds] = useState(12);
  const [canceling, setCanceling] = useState(false);
  const ripple = useRef(new Animated.Value(0)).current;
  const panelAnim = useRef(new Animated.Value(0)).current;
  const activeRideRef = useRef(activeRide);
  const hasStartedRef = useRef(false);
  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    activeRideRef.current = activeRide;
  }, [activeRide]);

  const fallbackDestination = useMemo(() => {
    const matched = destinationPoints.find((item) => item.label === route.params.destination);
    if (!matched) return null;
    return {
      latitude: matched.lat,
      longitude: matched.lng,
      label: matched.label
    } as MapCoordinate;
  }, [route.params.destination]);

  const destinationCoordinate = useMemo(() => {
    if (activeRide?.dropoffLat && activeRide?.dropoffLng) {
      return {
        latitude: activeRide.dropoffLat,
        longitude: activeRide.dropoffLng,
        label: activeRide.destination
      } as MapCoordinate;
    }
    return fallbackDestination;
  }, [activeRide?.destination, activeRide?.dropoffLat, activeRide?.dropoffLng, fallbackDestination]);

  const goToTracking = useCallback(
    (showToast = true) => {
      if (hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;
      setStatus('found');
      if (showToast) {
        push('Tài xế đã nhận chuyến của bạn', 'success');
      }
      navigation.replace('RideTracking');
    },
    [navigation, push]
  );

  useEffect(() => {
    const intervalId = setInterval(() => {
      setSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (latestEvent?.type !== 'match_status') return undefined;

    if (latestEvent.status === 'found') {
      setStatus('found');
      if (latestEvent.driverId) {
        assignDriverToActiveRide(latestEvent.driverId);
      }
      const navTimer = setTimeout(() => goToTracking(), 900);
      return () => clearTimeout(navTimer);
    }

    if (latestEvent.status === 'searching' && !hasNavigatedRef.current) {
      setStatus('searching');
    }

    return undefined;
  }, [assignDriverToActiveRide, goToTracking, latestEvent]);

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    startRide(route.params.pickup, route.params.destination).catch((error: any) => {
      push(error?.message || 'Không thể tìm tài xế', 'danger');
      navigation.goBack();
    });
  }, [navigation, push, route.params.destination, route.params.pickup, startRide]);

  useEffect(() => {
    if (activeRide?.driverId || activeRide?.driver) {
      setStatus('found');
      goToTracking();
    }
  }, [activeRide?.driver, activeRide?.driverId, goToTracking]);

  useEffect(() => {
    if (!activeRide?.id || activeRide?.driverId || activeRide?.driver) return undefined;

    let disposed = false;
    const poll = async () => {
      const updated = await refreshActiveRide();
      if (disposed || !updated) return;
      if (updated.driverId || updated.driver) {
        setStatus('found');
        goToTracking();
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
  }, [activeRide?.driver, activeRide?.driverId, activeRide?.id, goToTracking, refreshActiveRide]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(ripple, {
        toValue: 1,
        duration: 1400,
        easing: Easing.ease,
        useNativeDriver: true
      })
    );
    loop.start();
    return () => loop.stop();
  }, [ripple]);

  useEffect(() => {
    Animated.timing(panelAnim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [panelAnim]);

  const statusTitle = status === 'searching' ? 'Đang tìm tài xế' : 'Đã tìm thấy tài xế';
  const statusDetail =
    status === 'searching' ? `${nearbyDrivers} tài xế gần bạn · ${seconds} giây đã trôi qua` : 'Tài xế đang di chuyển đến điểm đón';

  const handleCancel = useCallback(async () => {
    if (canceling) return;
    try {
      setCanceling(true);
      const waitUntil = Date.now() + 4000;
      while (!activeRideRef.current?.id && Date.now() < waitUntil) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      await cancelActiveRide();
      push('Đã hủy yêu cầu đặt xe', 'info');
      navigation.goBack();
    } catch (error: any) {
      push(error?.message || 'Không thể hủy chuyến đi. Vui lòng thử lại.', 'danger');
    } finally {
      setCanceling(false);
    }
  }, [cancelActiveRide, canceling, navigation, push]);

  const radarSize = metrics.isCompact ? 164 : 200;

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}> 
      <CustomerLiveMap
        label="Đang ghép tài xế"
        destination={destinationCoordinate}
        onLocationChange={(coords) => {
          customerApi.setLivePickupLocation(coords.latitude, coords.longitude);
        }}
      />

      <View pointerEvents="none" style={styles.centerOverlay}>
        <View style={[styles.radarWrap, { width: radarSize, height: radarSize, borderRadius: radarSize / 2 }]}> 
          <Animated.View
            style={[
              styles.radar,
              {
                width: radarSize,
                height: radarSize,
                borderRadius: radarSize / 2,
                backgroundColor: colors.brand100,
                transform: [{ scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.2] }) }],
                opacity: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] })
              }
            ]}
          />
          <View style={styles.dot} />
        </View>
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
        <Text style={[styles.title, { color: palette.text }]}>{statusTitle}</Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>{statusDetail}</Text>
        <OutlineButton title={canceling ? 'Đang hủy...' : 'Hủy'} onPress={handleCancel} disabled={canceling} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center'
  },
  radarWrap: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  radar: {
    position: 'absolute'
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.brand700
  },
  panel: {
    position: 'absolute',
    bottom: spacing.xl,
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm
  },
  title: {
    ...typography.h2
  },
  subtitle: {
    ...typography.body
  }
});

export default SearchingDriverScreen;
