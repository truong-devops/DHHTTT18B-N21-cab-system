import React from 'react'
import { Pressable, Text, StyleSheet } from 'react-native'
import { colors, radius, spacing, typography } from '../../styles/theme'

export default function PrimaryButton({ title, onPress, disabled, style }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        pressed && { backgroundColor: colors.brand700 },
        disabled && { opacity: 0.6 },
        style
      ]}
    >
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.brand600,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center'
  },
  text: {
    color: '#fff',
    ...typography.h2
  }
})
