import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useRoutePolyline } from '../../hooks/useRoutePolyline';
import { colors, spacing, typography } from '../../theme/tokens';
import { IconSymbol } from '../ui/icon-symbol';

const DEFAULT_DELTA = {
  latitudeDelta: 0.012,
  longitudeDelta: 0.012
};

type Coordinate = {
  latitude: number;
  longitude: number;
  label?: string;
};

type Props = {
  label?: string;
  destination?: Coordinate | null;
  driverLocation?: Coordinate | null;
  showRoute?: boolean;
  onLocationChange?: (coords: Coordinate) => void;
  showCenterPickupPin?: boolean;
};

export const CustomerLiveMap: React.FC<Props> = ({
  label = 'Ban do truc tiep',
  destination,
  driverLocation,
  showRoute = false,
  onLocationChange,
  showCenterPickupPin = false
}) => {
  const mapRef = useRef<MapView | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const [permission, setPermission] = useState<'checking' | 'granted' | 'denied'>('checking');
  const [userCoordinate, setUserCoordinate] = useState<Coordinate | null>(null);
  const [zoomDelta, setZoomDelta] = useState({
    latitudeDelta: DEFAULT_DELTA.latitudeDelta,
    longitudeDelta: DEFAULT_DELTA.longitudeDelta
  });
  const [locationError, setLocationError] = useState<string | null>(null);
  const routeOrigin = showRoute ? driverLocation || userCoordinate : null;
  const routeDestination = showRoute ? destination || null : null;
  const {
    coords: routeCoords,
    isLoading: isRouteLoading,
    error: routeError
  } = useRoutePolyline({
    origin: routeOrigin,
    destination: routeDestination,
    profile: 'car'
  });

  const polylineCoordinates = useMemo(() => {
    if (!showRoute || !destination || !userCoordinate) return [];
    return routeCoords;
  }, [destination, routeCoords, showRoute, userCoordinate]);

  useEffect(() => {
    let mounted = true;

    const start = async () => {
      try {
        const existing = await Location.getForegroundPermissionsAsync();
        let status = existing.status;
        if (status !== 'granted') {
          const requested = await Location.requestForegroundPermissionsAsync();
          status = requested.status;
        }

        if (!mounted) return;
        if (status !== 'granted') {
          setPermission('denied');
          setLocationError('Can cap quyen vi tri de hien thi ban do.');
          return;
        }

        setPermission('granted');
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        });
        if (!mounted) return;

        const initial = {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude
        };
        setUserCoordinate(initial);
        onLocationChange?.(initial);

        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 5000,
            distanceInterval: 20
          },
          (next) => {
            if (!mounted) return;
            const value = {
              latitude: next.coords.latitude,
              longitude: next.coords.longitude
            };
            setUserCoordinate(value);
            onLocationChange?.(value);
          }
        );
        locationSubRef.current = sub;
      } catch (error: any) {
        if (!mounted) return;
        setPermission('denied');
        setLocationError(error?.message || 'Khong the lay vi tri hien tai cua ban.');
      }
    };

    void start();

    return () => {
      mounted = false;
      if (locationSubRef.current) {
        locationSubRef.current.remove();
        locationSubRef.current = null;
      }
    };
  }, [onLocationChange]);

  useEffect(() => {
    if (!mapRef.current || !userCoordinate) return;
    if (polylineCoordinates.length >= 2) return;
    mapRef.current.animateToRegion(
      {
        latitude: userCoordinate.latitude,
        longitude: userCoordinate.longitude,
        latitudeDelta: zoomDelta.latitudeDelta,
        longitudeDelta: zoomDelta.longitudeDelta
      },
      350
    );
  }, [polylineCoordinates, userCoordinate, zoomDelta]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (polylineCoordinates.length < 2) return;
    mapRef.current.fitToCoordinates(polylineCoordinates, {
      edgePadding: { top: 100, bottom: 120, left: 60, right: 60 },
      animated: true
    });
  }, [polylineCoordinates]);

  const handleZoom = (factor: number) => {
    setZoomDelta((prev) => {
      const nextLat = Math.min(0.08, Math.max(0.0015, prev.latitudeDelta * factor));
      const nextLng = Math.min(0.08, Math.max(0.0015, prev.longitudeDelta * factor));
      return { latitudeDelta: nextLat, longitudeDelta: nextLng };
    });
  };

  if (permission === 'denied') {
    return (
      <View style={styles.blocked}>
        <Text style={styles.blockedTitle}>Khong the truy cap vi tri</Text>
        <Text style={styles.blockedText}>{locationError || 'Vui long bat quyen vi tri trong cai dat thiet bi.'}</Text>
      </View>
    );
  }

  if (permission !== 'granted' || !userCoordinate) {
    return (
      <View style={styles.blocked}>
        <ActivityIndicator size="small" color={colors.brand700} />
        <Text style={styles.blockedText}>Dang lay vi tri GPS...</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <MapView
        ref={(ref: MapView | null) => {
          mapRef.current = ref;
        }}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: userCoordinate.latitude,
          longitude: userCoordinate.longitude,
          latitudeDelta: zoomDelta.latitudeDelta,
          longitudeDelta: zoomDelta.longitudeDelta
        }}
        showsUserLocation
        followsUserLocation
        loadingEnabled
      >
        {userCoordinate ? <Marker coordinate={userCoordinate} title="Vi tri cua ban" /> : null}
        {driverLocation ? <Marker coordinate={driverLocation} title={driverLocation.label || 'Tai xe'} pinColor="#2563EB" /> : null}
        {destination ? <Marker coordinate={destination} title={destination.label || 'Diem den'} pinColor="#F97316" /> : null}
        {polylineCoordinates.length >= 2 ? <Polyline coordinates={polylineCoordinates} strokeWidth={4} strokeColor="#F97316" /> : null}
      </MapView>

      <View style={styles.badge}>
        <Text style={styles.badgeText}>{label}</Text>
      </View>

      <View style={styles.zoomControls}>
        <TouchableOpacity style={styles.zoomButton} onPress={() => handleZoom(0.75)}>
          <Text style={styles.zoomText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.zoomButton} onPress={() => handleZoom(1.25)}>
          <Text style={styles.zoomText}>-</Text>
        </TouchableOpacity>
      </View>

      {showCenterPickupPin ? (
        <View pointerEvents="none" style={styles.pickupPinWrap}>
          <View style={styles.pickupPin}>
            <IconSymbol name="pin.fill" size={18} color={colors.brand700} />
          </View>
          <View style={styles.pickupPinDot} />
        </View>
      ) : null}

      {showRoute && isRouteLoading ? (
        <View style={styles.routeStatus}>
          <ActivityIndicator size="small" color={colors.brand700} />
          <Text style={styles.routeStatusText}>Dang tai lo trinh OSRM...</Text>
        </View>
      ) : null}
      {showRoute && !isRouteLoading && routeError ? (
        <View style={styles.routeStatus}>
          <Text style={styles.routeStatusText}>Khong lay duoc lo trinh OSRM: {routeError}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#E8EEF2'
  },
  badge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  badgeText: {
    ...typography.caption,
    color: colors.brand700,
    fontWeight: '600'
  },
  zoomControls: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    gap: spacing.xs
  },
  zoomButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)'
  },
  zoomText: {
    fontSize: 20,
    color: colors.brand700,
    fontWeight: '700'
  },
  pickupPinWrap: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -14,
    marginTop: -34,
    alignItems: 'center'
  },
  pickupPin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.brand100
  },
  pickupPinDot: {
    marginTop: 2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand700
  },
  blocked: {
    flex: 1,
    backgroundColor: '#EEF1F4',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg
  },
  blockedTitle: {
    ...typography.h2,
    color: colors.text
  },
  blockedText: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.xs,
    textAlign: 'center'
  },
  routeStatus: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    bottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  routeStatusText: {
    ...typography.caption,
    color: colors.brand700
  }
});
