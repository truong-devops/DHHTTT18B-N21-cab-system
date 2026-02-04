import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors, radius, spacing, typography } from '../../styles/theme'

export default function Toast({ message, variant = 'info' }) {
  const bg = variant === 'danger' ? colors.danger : variant === 'success' ? colors.success : colors.info
  return (
    <View style={[styles.container, { backgroundColor: bg }]}
    >
      <Text style={styles.text}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm
  },
  text: { color: '#fff', ...typography.body }
})
