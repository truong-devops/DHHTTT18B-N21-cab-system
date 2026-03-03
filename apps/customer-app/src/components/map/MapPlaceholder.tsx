import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors, spacing, typography } from '../../theme/tokens'

export const MapPlaceholder: React.FC<{ label?: string }> = ({ label = 'Map Placeholder' }) => {
  return (
    <View style={styles.map}>
      <Text style={styles.text}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
    backgroundColor: '#EEF1F4',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  text: {
    ...typography.body,
    color: colors.muted,
    paddingHorizontal: spacing.md,
    textAlign: 'center'
  }
})
