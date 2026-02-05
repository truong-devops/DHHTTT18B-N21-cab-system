import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors, radius, spacing, typography } from '../../theme/tokens'
import type { ToastItem } from '../../hooks/useToast'

type Props = {
  items: ToastItem[]
}

export const Toast: React.FC<Props> = ({ items }) => {
  return (
    <View style={styles.container} pointerEvents="none">
      {items.map((item) => (
        <View key={item.id} style={[styles.toast, variantStyle(item.variant)]}>
          <Text style={styles.text}>{item.message}</Text>
        </View>
      ))}
    </View>
  )
}

const variantStyle = (variant: ToastItem['variant']) => {
  if (variant === 'success') return { backgroundColor: colors.success }
  if (variant === 'danger') return { backgroundColor: colors.danger }
  return { backgroundColor: colors.info }
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.lg,
    right: spacing.lg
  },
  toast: {
    padding: spacing.md,
    borderRadius: radius.card,
    marginTop: spacing.sm
  },
  text: {
    ...typography.body,
    color: '#fff',
    fontWeight: '600'
  }
})
