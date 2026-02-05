import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors, spacing, typography } from '../../theme/tokens'
import { formatCurrency } from '../../utils/format'

export const EarningsWidget: React.FC<{ amount: number; label?: string }> = ({
  amount,
  label = 'Hôm nay'
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.amount}>{formatCurrency(amount)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    borderRadius: 8
  },
  label: { ...typography.caption, color: colors.muted },
  amount: { ...typography.h2, color: colors.text }
})
