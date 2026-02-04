import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors, radius, spacing, typography } from '../../styles/theme'

export default function RideOptionCard({ title, price, eta }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.meta}>{eta} phút</Text>
      <Text style={styles.price}>{price}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginRight: spacing.md
  },
  title: { color: colors.text, ...typography.h2 },
  meta: { color: colors.muted, ...typography.caption, marginTop: 4 },
  price: { color: colors.brand600, ...typography.h2, marginTop: 8 }
})
