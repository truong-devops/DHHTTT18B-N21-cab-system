import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors, typography } from '../../theme/tokens'

export const MapView: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  return (
    <View style={styles.map}>
      <Text style={styles.label}>Map Placeholder</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
    backgroundColor: '#F2F2F2',
    alignItems: 'center',
    justifyContent: 'center'
  },
  label: {
    ...typography.body,
    color: colors.muted
  }
})
