import React from 'react'
import { StyleSheet, View } from 'react-native'
import { colors, radius, spacing } from '../../theme/tokens'

export const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <View style={styles.card}>{children}</View>
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.md
  }
})
