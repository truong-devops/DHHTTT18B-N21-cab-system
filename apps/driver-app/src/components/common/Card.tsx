import React from 'react'
import { StyleSheet, View, ViewStyle } from 'react-native'
import { colors, radius, shadow, spacing } from '../../theme/tokens'

type Props = {
  children: React.ReactNode
  style?: ViewStyle
}

export const Card: React.FC<Props> = ({ children, style }) => {
  return <View style={[styles.card, style]}>{children}</View>
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.lg,
    ...shadow.ios,
    ...shadow.android
  }
})
