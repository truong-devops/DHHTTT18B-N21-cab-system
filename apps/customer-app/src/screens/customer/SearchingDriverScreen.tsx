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

type MapCoordinate = {
  latitude: number;
  longitude: number;
  label?: string;
};

const SearchingDriverScreen = () => {
  const route = useRoute<RouteProp<MainStackParamList, 'SearchingDriver'>>();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { startRide, activeRide, assignDriverToActiveRide, refreshActiveRide } = useCustomerStore();
  const { push } = useToast();
  const { latestEvent, nearbyDrivers } = useRealtimeStream();
  const [status, setStatus] = useState<'searching' | 'found'>('searching');
  const [seconds, setSeconds] = useState(12);
  const ripple = useRef(new Animated.Value(0)).current;
  const hasStartedRef = useRef(false);
  const hasNavigatedRef = useRef(false);

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
        push('Driver accepted your ride', 'success');
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
      push(error?.message || 'Unable to search for driver', 'danger');
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

  const statusTitle = status === 'searching' ? 'Searching for driver' : 'Driver found';
  const statusDetail =
    status === 'searching' ? `${nearbyDrivers} drivers nearby · ${seconds}s elapsed` : 'Driver is heading to pickup';

  return (
    <View style={styles.container}>
      <CustomerLiveMap
        label="Matching on map"
        destination={destinationCoordinate}
        onLocationChange={(coords) => {
          customerApi.setLivePickupLocation(coords.latitude, coords.longitude);
        }}
      />

      <View pointerEvents="none" style={styles.centerOverlay}>
        <View style={styles.radarWrap}>
          <Animated.View
            style={[
              styles.radar,
              {
                transform: [{ scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.2] }) }],
                opacity: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] })
              }
            ]}
          />
          <View style={styles.dot} />
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.title}>{statusTitle}</Text>
        <Text style={styles.subtitle}>{statusDetail}</Text>
        <OutlineButton title="Cancel" onPress={() => navigation.goBack()} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg
  },
  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center'
  },
  radarWrap: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center'
  },
  radar: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.brand100
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.brand700
  },
  panel: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.97)',
    padding: spacing.lg,
    gap: spacing.sm
  },
  title: {
    ...typography.h2,
    color: colors.text
  },
  subtitle: {
    ...typography.body,
    color: colors.muted
  }
});

export default SearchingDriverScreen;
