import React from 'react'
import { View, TextInput, StyleSheet } from 'react-native'
import { colors, radius, spacing } from '../../styles/theme'

export default function OtpInput({ value, onChangeText }) {
  return (
    <View style={styles.row}>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={value}
        onChangeText={onChangeText}
        maxLength={6}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    borderRadius: radius.sm,
    width: '100%',
    textAlign: 'center',
    letterSpacing: 6
  }
})
