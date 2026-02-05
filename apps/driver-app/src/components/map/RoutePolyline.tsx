import React from 'react'
import { StyleSheet, View } from 'react-native'
import { colors } from '../../theme/tokens'

export const RoutePolyline = () => <View style={styles.line} />

const styles = StyleSheet.create({
  line: {
    height: 4,
    width: '60%',
    borderRadius: 2,
    backgroundColor: colors.brand600,
    marginTop: 12
  }
})
