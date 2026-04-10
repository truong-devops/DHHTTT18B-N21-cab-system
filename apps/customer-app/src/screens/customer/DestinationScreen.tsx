import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SearchInput } from '../../components/common/SearchInput';
import { spacing, typography } from '../../theme/tokens';
import { destinations, destinationPoints, pickupPoint } from '../../mock/data';
import { useCustomerStore } from '../../store/customerStore';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/MainStack';
import { PlaceList } from '../../components/customer/PlaceList';
import { listRecentDestinations, pushRecentDestination } from '../../lib/recent-destinations';
import { customerApi } from '../../services/customerApi';
import { listRecentDestinationsFromApi, pushRecentDestinationToApi, searchPlaces, type PlaceSuggestion } from '../../services/placeApi';
import { StateView } from '../../components/common/StateView';
import { SkeletonBlock } from '../../components/common/SkeletonBlock';
import { useScreenMetrics } from '../../hooks/useScreenMetrics';
import { useAppPalette } from '../../theme/palette';

const SEARCH_DEBOUNCE_MS = 300;

const DestinationScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { setDestination } = useCustomerStore();
  const metrics = useScreenMetrics();
  const colors = useAppPalette();

  const [query, setQuery] = useState('');
  const [recentLabels, setRecentLabels] = useState<string[]>([]);
  const [backendSuggested, setBackendSuggested] = useState<PlaceSuggestion[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [loadingSuggested, setLoadingSuggested] = useState(false);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [suggestedError, setSuggestedError] = useState<string | null>(null);
  const [suggestedReloadKey, setSuggestedReloadKey] = useState(0);

  const fetchRecent = useCallback(async () => {
    setLoadingRecent(true);
    setRecentError(null);
    try {
      const remote = await listRecentDestinationsFromApi(8);
      if (remote && remote.length) {
        setRecentLabels(remote);
        return;
      }
      const stored = await listRecentDestinations();
      if (stored.length) {
        setRecentLabels(stored);
        return;
      }
      setRecentLabels(destinations.slice(0, 3));
    } catch {
      setRecentError('Không tải được điểm đến gần đây.');
      setRecentLabels(destinations.slice(0, 3));
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  useEffect(() => {
    void fetchRecent();
  }, [fetchRecent]);

  useEffect(() => {
    let disposed = false;
    setLoadingSuggested(true);
    setSuggestedError(null);

    const timer = setTimeout(() => {
      const run = async () => {
        try {
          const pickup = customerApi.getLivePickupLocation();
          const result = await searchPlaces({
            query: query.trim(),
            limit: 8,
            lat: pickup?.latitude,
            lng: pickup?.longitude
          });
          if (disposed) return;
          setBackendSuggested(result || []);
        } catch {
          if (disposed) return;
          setSuggestedError('Không tải được danh sách gợi ý.');
          setBackendSuggested([]);
        } finally {
          if (!disposed) {
            setLoadingSuggested(false);
          }
        }
      };
      void run();
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [query, suggestedReloadKey]);

  const localSuggestedPlaces = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const source = keyword
      ? destinationPoints.filter((item) => item.label.toLowerCase().includes(keyword))
      : destinationPoints.slice(0, Math.min(6, destinationPoints.length));
    return source.map((item) => ({
      id: `suggested-${item.label}`,
      label: item.label,
      subtitle: 'Gợi ý',
      icon: 'pin.fill' as const
    }));
  }, [query]);

  const suggestedPlaces = useMemo(() => {
    if (!backendSuggested.length) return localSuggestedPlaces;
    return backendSuggested.map((item) => ({
      id: `suggested-api-${item.id}`,
      label: item.label,
      subtitle: item.subtitle || 'Gợi ý',
      icon: 'pin.fill' as const
    }));
  }, [backendSuggested, localSuggestedPlaces]);

  const recentPlaces = useMemo(
    () =>
      recentLabels.map((label) => ({
        id: `recent-${label}`,
        label,
        subtitle: 'Gần đây',
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
          // Giữ luồng UI kể cả khi local storage lỗi.
        });
      void pushRecentDestinationToApi(value);
    },
    [navigation, setDestination]
  );

  const renderSuggestedContent = () => {
    if (loadingSuggested) {
      return (
        <View style={styles.skeletonList}>
          <SkeletonBlock height={18} />
          <SkeletonBlock height={18} width="82%" />
          <SkeletonBlock height={18} width="76%" />
        </View>
      );
    }

    if (suggestedError) {
      return (
        <StateView
          type="error"
          title="Không thể tải gợi ý"
          message={suggestedError}
          actionLabel="Thử lại"
          onAction={() => setSuggestedReloadKey((prev) => prev + 1)}
        />
      );
    }

    return <PlaceList data={suggestedPlaces} onSelect={handleSelect} emptyText="Không tìm thấy địa điểm gợi ý." />;
  };

  const renderRecentContent = () => {
    if (loadingRecent) {
      return (
        <View style={styles.skeletonList}>
          <SkeletonBlock height={18} />
          <SkeletonBlock height={18} width="72%" />
        </View>
      );
    }

    if (recentError) {
      return <StateView type="error" title="Không thể tải gần đây" message={recentError} actionLabel="Thử lại" onAction={() => void fetchRecent()} />;
    }

    return <PlaceList data={recentPlaces} onSelect={handleSelect} emptyText="Chưa có điểm đến gần đây." />;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingHorizontal: metrics.horizontalPadding }]}>
      <View style={[styles.contentWrap, { maxWidth: metrics.contentMaxWidth }]}>
        <Text style={[styles.title, { color: colors.text }]}>Chọn điểm đến</Text>
        <SearchInput value={query} onChangeText={setQuery} placeholder="Tìm điểm đến" />

        <ScrollView style={styles.sections} contentContainerStyle={styles.sectionsContent}>
          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Địa điểm gợi ý</Text>
            {renderSuggestedContent()}
          </View>

          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Điểm đến gần đây</Text>
            {renderRecentContent()}
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: spacing.xl, gap: spacing.md },
  contentWrap: { width: '100%', alignSelf: 'center', gap: spacing.md, flex: 1 },
  title: { ...typography.title },
  sections: { flex: 1 },
  sectionsContent: { gap: spacing.lg, paddingBottom: spacing.xl },
  sectionBlock: { gap: spacing.sm },
  sectionTitle: { ...typography.h3 },
  skeletonList: { gap: spacing.sm, paddingVertical: spacing.sm }
});

export default DestinationScreen;
