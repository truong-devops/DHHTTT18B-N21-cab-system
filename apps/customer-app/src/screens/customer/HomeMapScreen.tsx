import React, { useMemo } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/MainStack';
import { CustomerLiveMap } from '../../components/map/CustomerLiveMap';
import { Card } from '../../components/common/Card';
import { PrimaryButton } from '../../components/common/PrimaryButton';
import { colors, spacing, typography } from '../../theme/tokens';
import { destinationPoints } from '../../mock/data';
import { useCustomerStore } from '../../store/customerStore';
import { customerApi } from '../../services/customerApi';
import { useRealtimeStream } from '../../hooks/useRealtimeStream';

const { height: screenH } = Dimensions.get('window');
const MAP_HEIGHT = Math.max(200, Math.round(screenH / 3));

const HomeMapScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { destination, user } = useCustomerStore();
  const { nearbyDrivers } = useRealtimeStream();

  const destinationCoordinate = useMemo(() => {
    const found = destinationPoints.find((point) => point.label === destination);
    if (!found) return null;
    return { latitude: found.lat, longitude: found.lng, label: found.label };
  }, [destination]);

  const quickActions = [
    { id: 'a1', label: 'Dat xe', emoji: 'CAR', onPress: () => navigation.navigate('Destination') },
    { id: 'a2', label: 'Lich su', emoji: 'HIS', onPress: () => navigation.navigate('Tabs', { screen: 'History' }) },
    { id: 'a3', label: 'Vi', emoji: 'WLT', onPress: () => navigation.navigate('Tabs', { screen: 'Wallet' }) },
    { id: 'a4', label: 'Uu dai', emoji: 'PRM', onPress: () => navigation.navigate('Tabs', { screen: 'Promo' }) },
    { id: 'a6', label: 'Tat ca', emoji: 'ALL', onPress: () => navigation.navigate('Tabs', { screen: 'Profile' }) }
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xl }}>
      <View style={styles.mapWrap}>
        <CustomerLiveMap
          label="Ban do diem don"
          destination={destinationCoordinate}
          showRoute={Boolean(destinationCoordinate)}
          onLocationChange={(coords) => customerApi.setLivePickupLocation(coords.latitude, coords.longitude)}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.greeting}>Chao {user?.name || 'ban'}!</Text>
        <Text style={styles.meta}>Co {nearbyDrivers} tai xe hoat dong gan ban</Text>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>LOC</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Ban muon di toi dau?"
            placeholderTextColor={colors.muted}
            onFocus={() => navigation.navigate('Destination')}
          />
          <PrimaryButton title="Dat ho" onPress={() => navigation.navigate('Destination')} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dich vu nhanh</Text>
        <View style={styles.grid}>
          {quickActions.map((item) => (
            <Card key={item.id} style={styles.actionCard} onPress={item.onPress}>
              <Text style={styles.actionEmoji}>{item.emoji}</Text>
              <Text style={styles.actionLabel}>{item.label}</Text>
            </Card>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quan ly chi tieu</Text>
        <Card>
          <Text style={styles.h2}>Chi tieu cua ban</Text>
          <Text style={styles.meta}>Theo doi va thong ke chi tieu chuyen di</Text>
        </Card>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Kham pha da dich vu</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
          <Card style={styles.bannerCard}>
            <Text style={styles.bannerTitle}>Mo vi nhan qua</Text>
            <Text style={styles.bannerSub}>Uu dai cho khach moi</Text>
          </Card>
          <Card style={styles.bannerCard}>
            <Text style={styles.bannerTitle}>Giam gia gio thap diem</Text>
            <Text style={styles.bannerSub}>Ap dung cho xe may va taxi</Text>
          </Card>
        </ScrollView>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  mapWrap: { height: MAP_HEIGHT },
  greeting: { ...typography.h2, color: colors.text },
  meta: { ...typography.body, color: colors.muted },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface2,
    borderRadius: spacing.lg,
    padding: spacing.sm
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, color: colors.text, ...typography.body },
  section: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.sm },
  sectionTitle: { ...typography.h2, color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  actionCard: { width: '30%', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  actionEmoji: { fontSize: 20 },
  actionLabel: { ...typography.body, color: colors.text, textAlign: 'center' },
  h2: { ...typography.h2, color: colors.text },
  bannerCard: { width: 240, padding: spacing.lg, gap: spacing.xs },
  bannerTitle: { ...typography.h2, color: colors.text },
  bannerSub: { ...typography.body, color: colors.muted }
});

export default HomeMapScreen;
