import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors, radius, spacing, typography } from '../../theme/tokens'

type Variant = 'default' | 'primary' | 'success' | 'danger' | 'outline'

type Props = {
  label: string
  variant?: Variant
}

const variantStyles: Record<Variant, { bg: string; text: string; border?: string }> = {
  default: { bg: colors.surface2, text: colors.text },
  primary: { bg: colors.brand600, text: '#fff' },
  success: { bg: colors.success, text: '#fff' },
  danger: { bg: colors.danger, text: '#fff' },
  outline: { bg: colors.surface, text: colors.text, border: colors.border }
}

export const Chip: React.FC<Props> = ({ label, variant = 'default' }) => {
  const variantStyle = variantStyles[variant]
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: variantStyle.bg, borderColor: variantStyle.border || 'transparent' }
      ]}
    >
      <Text style={[styles.text, { color: variantStyle.text }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  text: {
    ...typography.caption
  }
})
