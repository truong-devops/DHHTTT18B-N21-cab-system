import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors, radius, spacing, typography } from '../../styles/theme'

export default function TripItem({ title, subtitle, amount }) {
  return (
    <View style={styles.item}>
      <View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.amount}>{amount}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  item: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  title: { color: colors.text, ...typography.h2 },
  subtitle: { color: colors.muted, ...typography.caption, marginTop: 4 },
  amount: { color: colors.brand600, ...typography.h2 }
})
