import React, { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { Card } from '../../components/common/Card'
import { Chip } from '../../components/common/Chip'
import { Banner } from '../../components/common/Banner'
import { colors, spacing, typography } from '../../theme/tokens'
import { rideApi } from '../../services/rideApi'
import { formatCurrency } from '../../utils/format'
import { useNavigation } from '@react-navigation/native'

const HistoryScreen = () => {
  const [items, setItems] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const navigation = useNavigation()

  useEffect(() => {
    const load = async () => {
      try {
        const data: any = await rideApi.history()
        setItems(Array.isArray(data) ? data : data.data || [])
        setError(null)
      } catch (err: any) {
        setError(err?.message || 'Không thể tải lịch sử')
        setItems([])
      }
    }
    load()
  }, [])

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Lịch sử chuyến</Text>
      {error ? <Banner variant="danger" text={error} /> : null}
      <View style={styles.filterRow}>
        <Chip label="Hôm nay" variant="outline" />
        <Chip label="7 ngày" variant="outline" />
        <Chip label="Tháng" variant="outline" />
      </View>
      {items.map((trip) => (
        <Card key={trip.id} style={styles.card}>
          <Text style={styles.itemTitle}>{trip.pickup || 'Điểm đón'}</Text>
          <Text style={styles.itemSubtitle}>{trip.dropoff || 'Điểm trả'}</Text>
          <View style={styles.itemRow}>
            <Text style={styles.itemSubtitle}>{trip.time || trip.createdAt || ''}</Text>
            <Text style={styles.amount}>{formatCurrency(trip.amount || trip.price || 0)}</Text>
          </View>
          <Text
            style={styles.link}
            onPress={() => navigation.navigate('TripDetail' as never, { tripId: trip.id } as never)}
          >
            Xem chi tiết
          </Text>
        </Card>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl },
  title: { ...typography.title, marginBottom: spacing.lg },
  filterRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  card: { marginBottom: spacing.md },
  itemTitle: { ...typography.h2 },
  itemSubtitle: { ...typography.caption, color: colors.muted },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  amount: { ...typography.body, fontWeight: '600' },
  link: { ...typography.caption, color: colors.brand600, marginTop: spacing.sm }
})

export default HistoryScreen
