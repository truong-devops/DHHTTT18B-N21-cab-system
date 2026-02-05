import React from 'react'
import { StyleSheet, View } from 'react-native'
import { colors } from '../../theme/tokens'

export const Divider = () => <View style={styles.divider} />

const styles = StyleSheet.create({
  divider: {
    height: 1,
    backgroundColor: colors.border
  }
})
