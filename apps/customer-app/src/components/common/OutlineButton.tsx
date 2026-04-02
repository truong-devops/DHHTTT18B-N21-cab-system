import React from 'react'
import { Pressable, StyleSheet, Text, ViewStyle, TextStyle } from 'react-native'
import { colors, radius, spacing, typography } from '../../theme/tokens'

type Props = {
  title: string
  onPress?: () => void
  disabled?: boolean
  style?: ViewStyle
  textStyle?: TextStyle
}

export const OutlineButton: React.FC<Props> = ({ title, onPress, disabled, style, textStyle }) => (
  <Pressable onPress={onPress} disabled={disabled} style={[styles.btn, disabled ? styles.disabled : null, style]}>
    <Text style={[styles.text, disabled ? styles.textDisabled : null, textStyle]}>{title}</Text>
  </Pressable>
)

const styles = StyleSheet.create({
  btn: {
    height: 44,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg
  },
  disabled: { opacity: 0.6 },
  text: { ...typography.body, color: colors.text },
  textDisabled: { color: colors.muted }
})
