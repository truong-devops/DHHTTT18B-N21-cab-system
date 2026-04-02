import React from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
import { colors, spacing, typography } from '../../theme/tokens'

type Props = {
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
}

export const SearchInput: React.FC<Props> = ({ value, onChangeText, placeholder }) => {
  return (
    <View style={styles.container}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || 'Tìm kiếm'}
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border
  },
  input: { ...typography.body, color: colors.text }
})
