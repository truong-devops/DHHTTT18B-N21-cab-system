import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors, radius, spacing, typography } from '../../styles/theme'

export default function FareSummaryCard({ total = '0 VND' }) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Tổng cước</Text>
      <Text style={styles.value}>{total}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surface2
  },
  label: { color: colors.muted, ...typography.caption },
  value: { color: colors.text, ...typography.h2, marginTop: 4 }
})
