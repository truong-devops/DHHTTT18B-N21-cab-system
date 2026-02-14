import React from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import { colors, radius, spacing, typography } from '../../theme/tokens'

type Props = {
  title: string
  onPress?: () => void
}

export const OutlineButton: React.FC<Props> = ({ title, onPress }) => {
  return (
    <Pressable onPress={onPress} style={styles.btn}>
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  )
}

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
  text: {
    ...typography.body,
    color: colors.text
  }
})
