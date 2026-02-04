import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { colors, radius, spacing, typography } from '../../styles/theme'

export default function PaymentMethodPicker({ methods, value, onChange }) {
  return (
    <View>
      {methods.map((m) => (
        <Pressable
          key={m.key}
          onPress={() => onChange(m.key)}
          style={[styles.item, value === m.key && styles.active]}
        >
          <Text style={styles.text}>{m.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  item: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm
  },
  active: { borderColor: colors.brand600 },
  text: { color: colors.text, ...typography.body }
})
