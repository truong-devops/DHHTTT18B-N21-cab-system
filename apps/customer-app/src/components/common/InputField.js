import React from 'react'
import { View, Text, TextInput, StyleSheet } from 'react-native'
import { colors, radius, spacing, typography } from '../../styles/theme'

export default function InputField({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType }) {
  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { color: colors.text, marginBottom: 6, ...typography.caption },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    borderRadius: radius.sm,
    color: colors.text,
    backgroundColor: '#fff'
  }
})
