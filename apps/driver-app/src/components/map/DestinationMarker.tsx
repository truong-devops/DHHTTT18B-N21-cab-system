import React from 'react'
import { StyleSheet, View } from 'react-native'
import { colors } from '../../theme/tokens'

export const DestinationMarker = () => <View style={styles.marker} />

const styles = StyleSheet.create({
  marker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: '#fff'
  }
})
