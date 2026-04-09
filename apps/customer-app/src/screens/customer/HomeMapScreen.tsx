import React, { useCallback, useMemo, useRef, useState } from 'react';
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
  const [pickupAddress, setPickupAddress] = useState('Dang xac dinh pickup address...');
  const geocodeRef = useRef<{ at: number; coords: Coordinate } | null>(null);

  const shortcuts = useMemo(() => {
    const home = destinationPoints[0];
    const work = destinationPoints[1] || destinationPoints[0];
    return [
      home ? { id: 'home', label: 'Home', destination: home.label } : null,
      work ? { id: 'work', label: 'Work', destination: work.label } : null
    ].filter((item): item is { id: string; label: string; destination: string } => Boolean(item));
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
    <View style={styles.container}>
      <CustomerLiveMap label="Map & Pickup" onLocationChange={handleLocationChange} showCenterPickupPin />

      <BottomSheet collapsedHeight={300}>
        <Text style={styles.sheetTitle}>Pickup</Text>
        <Text style={styles.addressLabel}>Pickup address (auto-detect)</Text>
        <Text style={styles.addressValue} numberOfLines={2}>
          {pickupAddress}
        </Text>

        <Text style={styles.nearby}>Driver nearby: {nearbyDrivers}</Text>

        <LocationSearch value={destination} placeholder="Set destination" onPress={openDestination} />

        <View style={styles.shortcutRow}>
          {shortcuts.map((item) => (
            <Pressable key={item.id} style={styles.shortcutChip} onPress={() => handleShortcut(item.destination)}>
              <Text style={styles.shortcutTitle}>{item.label}</Text>
              <Text style={styles.shortcutSubtitle} numberOfLines={1}>
                {item.destination}
              </Text>
            </Pressable>
          ))}
        </View>

        <PrimaryButton title="Set Destination" onPress={openDestination} />
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000'
  },
  sheetTitle: {
    ...typography.h2,
    color: colors.text
  },
  addressLabel: {
    ...typography.caption,
    color: colors.muted
  },
  addressValue: {
    ...typography.body,
    color: colors.text
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
  shortcutChip: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs
  },
  shortcutTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700'
  },
  shortcutSubtitle: {
    ...typography.caption,
    color: colors.muted
  }
});

export default HomeMapScreen;
