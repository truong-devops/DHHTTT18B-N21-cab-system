import React from 'react'
import { StyleSheet, View } from 'react-native'
import { colors } from '../../theme/tokens'

export const PickupMarker = () => <View style={styles.marker} />

const styles = StyleSheet.create({
  marker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: '#fff'
  }
})
