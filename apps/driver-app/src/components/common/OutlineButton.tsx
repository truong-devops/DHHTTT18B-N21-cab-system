import React from 'react'
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native'
import { colors, radius, spacing, typography } from '../../theme/tokens'

type Props = {
  title: string
  onPress?: () => void
  disabled?: boolean
  style?: ViewStyle
}

export const OutlineButton: React.FC<Props> = ({ title, onPress, disabled, style }) => {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderRadius: radius.button,
    paddingVertical: spacing.lg,
    borderWidth: 1,
    borderColor: colors.brand600,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pressed: { backgroundColor: colors.surface2 },
  disabled: { opacity: 0.6 },
  text: {
    color: colors.brand600,
    fontSize: typography.body.fontSize + 2,
    fontWeight: '700'
  }
})
