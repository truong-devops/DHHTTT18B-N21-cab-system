import React from 'react'
import { StyleSheet, TextInput } from 'react-native'
import { colors, spacing, typography } from '../../theme/tokens'

type Props = {
  value: string
  placeholder?: string
  onChangeText: (text: string) => void
  minHeight?: number
}

export const TextArea: React.FC<Props> = ({ value, placeholder, onChangeText, minHeight = 120 }) => {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      style={[styles.input, { minHeight }]}
      multiline
      textAlignVertical="top"
    />
  )
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    ...typography.body,
    color: colors.text
  }
})
