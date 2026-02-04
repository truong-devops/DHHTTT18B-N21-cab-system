import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors, radius, spacing, typography } from '../../styles/theme'

export default function DriverInfoCard({ name = 'Tài xế', plate = '51A-00000', rating = '4.9' }) {
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.meta}>Biển số: {plate}</Text>
      <Text style={styles.meta}>Đánh giá: {rating}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md
  },
  name: { color: colors.text, ...typography.h2 },
  meta: { color: colors.muted, ...typography.caption, marginTop: 4 }
})
