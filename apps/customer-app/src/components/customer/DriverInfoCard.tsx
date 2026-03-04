import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { DriverInfo } from '../../mock/data'
import { colors, spacing, typography } from '../../theme/tokens'

type Props = {
  driver: DriverInfo
  etaMinutes: number
}

export const DriverInfoCard: React.FC<Props> = ({ driver, etaMinutes }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Đã tìm thấy tài xế</Text>
      <Text style={styles.line}>{driver.name} | {driver.vehicle}</Text>
      <Text style={styles.line}>Biển số {driver.plate} | Đánh giá {driver.rating}</Text>
      <Text style={styles.eta}>Thời gian đến dự kiến: {etaMinutes} phút</Text>
      {/* TODO: Integrate call/chat actions with Communication Service */}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    gap: spacing.xs
  },
  title: { ...typography.h2, color: colors.text },
  line: { ...typography.body, color: colors.muted },
  eta: { ...typography.body, color: colors.brand700, fontWeight: '600' }
})
