import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/MainStack';
import { CustomerLiveMap } from '../../components/map/CustomerLiveMap';
import { BottomSheet } from '../../components/common/BottomSheet';
import { PrimaryButton } from '../../components/common/PrimaryButton';
import { LocationSearch } from '../../components/customer/LocationSearch';
import { colors, spacing, typography } from '../../theme/tokens';
import { destinationPoints, pickupPoint } from '../../mock/data';
import { useCustomerStore } from '../../store/customerStore';
import { customerApi } from '../../services/customerApi';
import { useRealtimeStream } from '../../hooks/useRealtimeStream';
import { listSavedLocations, upsertSavedLocation } from '../../lib/settings-storage';
import { useAppPalette } from '../../theme/palette';
import { useScreenMetrics } from '../../hooks/useScreenMetrics';

type Coordinate = {
  latitude: number;
  longitude: number;
};

const GEOCODE_INTERVAL_MS = 10000;
const GEOCODE_DISTANCE_M = 80;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceMeters(a: Coordinate, b: Coordinate) {
  const earthRadius = 6371000;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const inner = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  const c = 2 * Math.atan2(Math.sqrt(inner), Math.sqrt(1 - inner));
  return earthRadius * c;
}

function formatCoordinate(coords: Coordinate) {
  return `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
}

const HomeMapScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { destination, setDestination } = useCustomerStore();
  const { nearbyDrivers } = useRealtimeStream();
  const palette = useAppPalette();
  const metrics = useScreenMetrics();

  const [pickupAddress, setPickupAddress] = useState('Đang xác định địa chỉ điểm đón...');
  const geocodeRef = useRef<{ at: number; coords: Coordinate } | null>(null);
  const [savedHomeWork, setSavedHomeWork] = useState<Array<{ id: string; label: string; destination: string }>>([]);

  const shortcuts = useMemo(() => {
    if (savedHomeWork.length) {
      return savedHomeWork;
    }
    const home = destinationPoints[0];
    const work = destinationPoints[1] || destinationPoints[0];
    return [
      home ? { id: 'home', label: 'Nhà', destination: home.label } : null,
      work ? { id: 'work', label: 'Cơ quan', destination: work.label } : null
    ].filter((item): item is { id: string; label: string; destination: string } => Boolean(item));
  }, [savedHomeWork]);

  useEffect(() => {
    let mounted = true;

    const setupDefaultSavedLocations = async () => {
      const current = await listSavedLocations();
      if (current.length === 0) {
        const home = destinationPoints[0];
        const work = destinationPoints[1] || destinationPoints[0];
        if (home) {
          await upsertSavedLocation({ id: 'saved-home', label: 'Nhà', address: home.label });
        }
        if (work) {
          await upsertSavedLocation({ id: 'saved-work', label: 'Cơ quan', address: work.label });
        }
      }
      const updated = await listSavedLocations();
      if (!mounted) return;
      const preferred = updated
        .filter((item) => {
          const normalized = item.label.trim().toLowerCase();
          return ['nhà', 'co quan', 'cơ quan', 'home', 'work'].includes(normalized);
        })
        .slice(0, 2)
        .map((item) => ({
          id: item.id,
          label: item.label,
          destination: item.address
        }));
      setSavedHomeWork(preferred);
    };

    void setupDefaultSavedLocations();

    return () => {
      mounted = false;
    };
  }, []);

  const openDestination = useCallback(() => {
    navigation.navigate('Destination');
  }, [navigation]);

  const handleShortcut = useCallback(
    (destinationLabel: string) => {
      setDestination(destinationLabel);
      navigation.navigate('RideOptions', { pickup: pickupPoint.label, destination: destinationLabel });
    },
    [navigation, setDestination]
  );

  const resolvePickupAddress = useCallback(async (coords: Coordinate) => {
    const now = Date.now();
    const last = geocodeRef.current;
    if (last) {
      const withinInterval = now - last.at < GEOCODE_INTERVAL_MS;
      const withinDistance = distanceMeters(last.coords, coords) < GEOCODE_DISTANCE_M;
      if (withinInterval && withinDistance) {
        return;
      }
    }

    geocodeRef.current = {
      at: now,
      coords
    };

    try {
      const places = await Location.reverseGeocodeAsync({
        latitude: coords.latitude,
        longitude: coords.longitude
      });
      if (!places.length) {
        setPickupAddress(formatCoordinate(coords));
        return;
      }

      const first = places[0];
      const parts = [first.name, first.street, first.district, first.subregion, first.city].filter(Boolean);
      setPickupAddress(parts.length ? parts.join(', ') : formatCoordinate(coords));
    } catch {
      setPickupAddress(formatCoordinate(coords));
    }
  }, []);

  const handleLocationChange = useCallback(
    (coords: Coordinate) => {
      customerApi.setLivePickupLocation(coords.latitude, coords.longitude);
      void resolvePickupAddress(coords);
    },
    [resolvePickupAddress]
  );

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}> 
      <CustomerLiveMap label="Bản đồ & Điểm đón" onLocationChange={handleLocationChange} showCenterPickupPin />

      <BottomSheet collapsedHeight={300}>
        <Text style={[styles.sheetTitle, { color: palette.text }]}>Điểm đón</Text>
        <Text style={[styles.addressLabel, { color: palette.muted }]}>Địa chỉ điểm đón (tự động nhận diện)</Text>
        <Text style={[styles.addressValue, { color: palette.text }]} numberOfLines={2}>
          {pickupAddress}
        </Text>

        <Text style={styles.nearby}>Tài xế gần bạn: {nearbyDrivers}</Text>

        <LocationSearch value={destination} placeholder="Nhập điểm đến" onPress={openDestination} />

        <View style={[styles.shortcutRow, metrics.isCompact ? styles.shortcutRowCompact : null]}>
          {shortcuts.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.shortcutChip, { borderColor: palette.border, backgroundColor: palette.surface2 }]}
              onPress={() => handleShortcut(item.destination)}
              accessibilityRole="button"
              accessibilityLabel={`Chọn nhanh ${item.label}`}
            >
              <Text style={[styles.shortcutTitle, { color: palette.text }]}>{item.label}</Text>
              <Text style={[styles.shortcutSubtitle, { color: palette.muted }]} numberOfLines={1}>
                {item.destination}
              </Text>
            </Pressable>
          ))}
        </View>

        <PrimaryButton title="Đặt điểm đến" onPress={openDestination} />
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  sheetTitle: {
    ...typography.h2
  },
  addressLabel: {
    ...typography.caption
  },
  addressValue: {
    ...typography.body
  },
  nearby: {
    ...typography.body,
    color: colors.brand700,
    fontWeight: '600'
  },
  shortcutRow: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  shortcutRowCompact: {
    flexDirection: 'column'
  },
  shortcutChip: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs
  },
  shortcutTitle: {
    ...typography.body,
    fontWeight: '700'
  },
  shortcutSubtitle: {
    ...typography.caption
  }
});

export default HomeMapScreen;
