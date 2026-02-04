import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors, radius, spacing, typography } from '../../styles/theme'

export default function StatusChip({ label }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  text: { color: colors.text, ...typography.caption }
})
