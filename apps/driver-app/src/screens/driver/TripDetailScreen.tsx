import React, { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { RouteProp, useRoute } from '@react-navigation/native'
import { Card } from '../../components/common/Card'
import { Banner } from '../../components/common/Banner'
import { colors, spacing, typography } from '../../theme/tokens'
import { formatCurrency } from '../../utils/format'
import type { MainStackParamList } from '../../navigation/MainStack'
import { rideApi } from '../../services/rideApi'

const TripDetailScreen = () => {
  const route = useRoute<RouteProp<MainStackParamList, 'TripDetail'>>()
  const [trip, setTrip] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res: any = await rideApi.getRide(route.params.tripId)
        setTrip(res?.data || res)
        setError(null)
      } catch (err: any) {
        setError(err?.message || 'Không thể tải chi tiết chuyến')
      }
    }
    load()
  }, [route.params.tripId])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chi tiết chuyến</Text>
      {error ? <Banner variant="danger" text={error} /> : null}
      <Card style={styles.card}>
        <Text style={styles.label}>Trip ID</Text>
        <Text style={styles.value}>{route.params.tripId}</Text>
        <Text style={styles.label}>Tổng tiền</Text>
        <Text style={styles.value}>{trip ? formatCurrency(trip.price || trip.amount || 0) : '---'}</Text>
        <Text style={styles.label}>Trạng thái</Text>
        <Text style={styles.value}>{trip?.status || '---'}</Text>
      </Card>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl },
  title: { ...typography.title, marginBottom: spacing.lg },
  card: { gap: spacing.sm },
  label: { ...typography.caption, color: colors.muted },
  value: { ...typography.body }
})

export default TripDetailScreen
