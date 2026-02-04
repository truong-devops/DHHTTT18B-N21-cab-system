import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors, typography } from '../../styles/theme'

export default function MapPlaceholder({ height = '100%' }) {
  return (
    <View style={[styles.box, { height }]}>
      <Text style={styles.text}>Map Placeholder</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    width: '100%',
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  text: { color: colors.muted, ...typography.body }
})
