import React from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import { colors, radius, spacing, typography } from '../../theme/tokens'

type Props = {
  title: string
  onPress?: () => void
  disabled?: boolean
}

export const PrimaryButton: React.FC<Props> = ({ title, onPress, disabled }) => {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.btn, disabled ? styles.disabled : null]}>
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    height: 44,
    borderRadius: radius.button,
    backgroundColor: colors.brand600,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg
  },
  disabled: {
    opacity: 0.5
  },
  text: {
    ...typography.body,
    color: '#FFF',
    fontWeight: '600'
  }
})
