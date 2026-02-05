import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Card } from '../common/Card'
import { PrimaryButton } from '../common/PrimaryButton'
import { OutlineButton } from '../common/OutlineButton'
import { colors, spacing, typography } from '../../theme/tokens'
import { formatCurrency, formatDistance } from '../../utils/format'

type Props = {
  pickup: string
  dropoff: string
  distanceKm: number
  etaMinutes: number
  price: number
  onAccept?: () => void
  onReject?: () => void
}

export const IncomingRideCard: React.FC<Props> = ({
  pickup,
  dropoff,
  distanceKm,
  etaMinutes,
  price,
  onAccept,
  onReject
}) => {
  return (
    <Card>
      <Text style={styles.title}>Yêu cầu chuyến mới</Text>
      <Text style={styles.label}>Điểm đón</Text>
      <Text style={styles.value}>{pickup}</Text>
      <Text style={styles.label}>Điểm trả</Text>
      <Text style={styles.value}>{dropoff}</Text>
      <View style={styles.row}>
        <Text style={styles.meta}>{formatDistance(distanceKm)}</Text>
        <Text style={styles.meta}>{etaMinutes} phút</Text>
        <Text style={styles.meta}>{formatCurrency(price)}</Text>
      </View>
      <View style={styles.actions}>
        <PrimaryButton title="Nhận chuyến" onPress={onAccept} style={{ flex: 1 }} />
        <OutlineButton title="Từ chối" onPress={onReject} style={{ flex: 1 }} />
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  title: { ...typography.h2, marginBottom: spacing.sm },
  label: { ...typography.caption, color: colors.muted, marginTop: spacing.sm },
  value: { ...typography.body, color: colors.text },
  row: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  meta: { ...typography.caption, color: colors.text },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }
})
