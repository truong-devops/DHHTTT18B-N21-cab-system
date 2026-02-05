import { StyleSheet } from 'react-native'
import { colors, radius, shadow, spacing, typography } from './tokens'

export const textStyles = StyleSheet.create({
  title: { ...typography.title, color: colors.text },
  h2: { ...typography.h2, color: colors.text },
  body: { ...typography.body, color: colors.text },
  caption: { ...typography.caption, color: colors.muted }
})

export const commonStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.lg
  },
  cardShadow: {
    ...shadow.ios,
    ...shadow.android
  },
  divider: {
    height: 1,
    backgroundColor: colors.border
  }
})
