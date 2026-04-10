import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SearchInput } from '../../components/common/SearchInput';
import { colors, spacing, typography } from '../../theme/tokens';
import { destinations, destinationPoints, pickupPoint } from '../../mock/data';
import { useCustomerStore } from '../../store/customerStore';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/MainStack';
import { PlaceList } from '../../components/customer/PlaceList';
import { listRecentDestinations, pushRecentDestination } from '../../lib/recent-destinations';
import { customerApi } from '../../services/customerApi';
import { listRecentDestinationsFromApi, pushRecentDestinationToApi, searchPlaces, type PlaceSuggestion } from '../../services/placeApi';

const SEARCH_DEBOUNCE_MS = 300;

const DestinationScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { setDestination } = useCustomerStore();
  const [query, setQuery] = useState('');
  const [recentLabels, setRecentLabels] = useState<string[]>([]);
  const [backendSuggested, setBackendSuggested] = useState<PlaceSuggestion[]>([]);

  useEffect(() => {
    let mounted = true;
    listRecentDestinationsFromApi(8)
      .then(async (remote) => {
        if (!mounted) return;
        if (remote && remote.length) {
          setRecentLabels(remote);
          return;
        }
        const stored = await listRecentDestinations();
        if (!mounted) return;
        if (stored.length) {
          setRecentLabels(stored);
          return;
        }
        setRecentLabels(destinations.slice(0, 3));
      })
      .catch(() => {
        if (!mounted) return;
        setRecentLabels(destinations.slice(0, 3));
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    const timer = setTimeout(() => {
      const run = async () => {
        const pickup = customerApi.getLivePickupLocation();
        const result = await searchPlaces({
          query: query.trim(),
          limit: 8,
          lat: pickup?.latitude,
          lng: pickup?.longitude
        });
        if (disposed) return;
        setBackendSuggested(result || []);
      };
      void run();
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [query]);

  const localSuggestedPlaces = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const source = keyword
      ? destinationPoints.filter((item) => item.label.toLowerCase().includes(keyword))
      : destinationPoints.slice(0, Math.min(6, destinationPoints.length));
    return source.map((item) => ({
      id: `suggested-${item.label}`,
      label: item.label,
      subtitle: 'Suggested',
      icon: 'pin.fill' as const
    }));
  }, [query]);

  const suggestedPlaces = useMemo(() => {
    if (!backendSuggested.length) return localSuggestedPlaces;
    return backendSuggested.map((item) => ({
      id: `suggested-api-${item.id}`,
      label: item.label,
      subtitle: item.subtitle || 'Suggested',
      icon: 'pin.fill' as const
    }));
  }, [backendSuggested, localSuggestedPlaces]);

  const recentPlaces = useMemo(
    () =>
      recentLabels.map((label) => ({
        id: `recent-${label}`,
        label,
        subtitle: 'Recent',
        icon: 'clock.fill' as const
      })),
    [recentLabels]
  );

  const handleSelect = useCallback(
    (value: string) => {
      setDestination(value);
      navigation.navigate('RideOptions', { pickup: pickupPoint.label, destination: value });
      pushRecentDestination(value)
        .then((next) => {
          setRecentLabels(next);
        })
        .catch(() => {
          // Keep UI flow even when local storage update fails.
        });
      void pushRecentDestinationToApi(value);
    },
    [navigation, setDestination]
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Destination Selection</Text>
      <SearchInput value={query} onChangeText={setQuery} placeholder="Search destination" />

      <ScrollView style={styles.sections} contentContainerStyle={styles.sectionsContent}>
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Suggested places</Text>
          <PlaceList data={suggestedPlaces} onSelect={handleSelect} emptyText="No suggested places found." />
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Recent destinations</Text>
          <PlaceList data={recentPlaces} onSelect={handleSelect} emptyText="No recent destinations yet." />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, gap: spacing.md },
  title: { ...typography.title, color: colors.text },
  sections: { flex: 1 },
  sectionsContent: { gap: spacing.lg, paddingBottom: spacing.xl },
  sectionBlock: { gap: spacing.sm },
  sectionTitle: { ...typography.h3, color: colors.text }
});

export default DestinationScreen;
