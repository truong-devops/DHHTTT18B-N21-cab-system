import React, { useMemo } from 'react'
import { Dimensions, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { MainStackParamList } from '../../navigation/MainStack'
import { CustomerLiveMap } from '../../components/map/CustomerLiveMap'
import { Card } from '../../components/common/Card'
import { PrimaryButton } from '../../components/common/PrimaryButton'
import { colors, spacing, typography } from '../../theme/tokens'
import { destinationPoints } from '../../mock/data'
import { useCustomerStore } from '../../store/customerStore'
import { customerApi } from '../../services/customerApi'
import { useRealtimeStream } from '../../hooks/useRealtimeStream'

const { height: screenH } = Dimensions.get('window')
const MAP_HEIGHT = Math.max(200, Math.round(screenH / 3))

const HomeMapScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const { destination, user } = useCustomerStore()
  const { nearbyDrivers } = useRealtimeStream()

  const destinationCoordinate = useMemo(() => {
    const found = destinationPoints.find((point) => point.label === destination)
    if (!found) return null
    return { latitude: found.lat, longitude: found.lng }
  }, [destination])

  const quickActions = [
    { id: 'a1', label: 'Đặt xe', emoji: '🚗', onPress: () => navigation.navigate('Destination') },
    { id: 'a2', label: 'Lịch sử', emoji: '🕓', onPress: () => navigation.navigate('History') },
    { id: 'a3', label: 'Ví', emoji: '💳', onPress: () => navigation.navigate('Profile') },
    { id: 'a4', label: 'Ưu đãi', emoji: '🎁', onPress: () => navigation.navigate('Profile') },
    { id: 'a5', label: 'Hỗ trợ', emoji: '🛟', onPress: () => {} },
    { id: 'a6', label: 'Tất cả', emoji: '➕', onPress: () => navigation.navigate('Profile') }
  ]

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xl }}>
      <View style={styles.mapWrap}>
        <CustomerLiveMap
          label="Bản đồ điểm đón"
          destination={destinationCoordinate}
          showRoute={Boolean(destinationCoordinate)}
          onLocationChange={(coords) => customerApi.setLivePickupLocation(coords.latitude, coords.longitude)}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.greeting}>Chào {user?.name || 'bạn'}! 👋</Text>
        <Text style={styles.meta}>Có {nearbyDrivers} tài xế hoạt động gần bạn</Text>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>📍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Bạn muốn đi tới đâu?"
            placeholderTextColor={colors.muted}
            onFocus={() => navigation.navigate('Destination')}
          />
          <PrimaryButton title="Đặt hộ" onPress={() => navigation.navigate('Destination')} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dịch vụ nhanh</Text>
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
        <Text style={styles.sectionTitle}>Quản lý chi tiêu</Text>
        <Card>
          <Text style={styles.h2}>Chi tiêu của bạn</Text>
          <Text style={styles.meta}>Theo dõi và thống kê chi tiêu chuyến đi</Text>
        </Card>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Khám phá đa dịch vụ</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
          <Card style={styles.bannerCard}>
            <Text style={styles.bannerTitle}>Mở ví nhận quà</Text>
            <Text style={styles.bannerSub}>Ưu đãi cho khách mới</Text>
          </Card>
          <Card style={styles.bannerCard}>
            <Text style={styles.bannerTitle}>Giảm giá giờ thấp điểm</Text>
            <Text style={styles.bannerSub}>Áp dụng cho xe máy & taxi</Text>
          </Card>
        </ScrollView>
      </View>
    </ScrollView>
  )
}

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
})

export default HomeMapScreen
