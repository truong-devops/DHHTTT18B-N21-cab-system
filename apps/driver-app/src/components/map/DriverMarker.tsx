import React from 'react'
import { StyleSheet, View } from 'react-native'
import { colors } from '../../theme/tokens'

export const DriverMarker = () => <View style={styles.marker} />

const styles = StyleSheet.create({
  marker: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.brand600,
    borderWidth: 2,
    borderColor: '#fff'
  }
})
