import React from 'react'
import { View, StyleSheet } from 'react-native'
import { colors, radius, spacing } from '../../styles/theme'

export default function BottomSheet({ children }) {
  return <View style={styles.sheet}>{children}</View>
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border
  }
})
