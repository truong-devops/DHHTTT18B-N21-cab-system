import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Chip } from '../common/Chip'

export const StatusChips = () => {
  return (
    <View style={styles.row}>
      <Chip label="GPS OK" variant="success" />
      <Chip label="4G" variant="outline" />
      <Chip label="85%" variant="outline" />
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 }
})
