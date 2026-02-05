import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors, radius, spacing, typography } from '../../theme/tokens'

type Props = {
  message: string
  variant?: 'info' | 'danger' | 'success'
}

const variantMap = {
  info: { bg: colors.info, text: '#fff' },
  danger: { bg: colors.danger, text: '#fff' },
  success: { bg: colors.success, text: '#fff' }
}

export const Banner: React.FC<Props> = ({ message, variant = 'info' }) => {
  const style = variantMap[variant]
  return (
    <View style={[styles.base, { backgroundColor: style.bg }]}> 
      <Text style={[styles.text, { color: style.text }]}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    padding: spacing.md,
    borderRadius: radius.card,
    marginBottom: spacing.md
  },
  text: {
    ...typography.body,
    fontWeight: '600'
  }
})
