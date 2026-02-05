import React from 'react'
import { StyleSheet, View } from 'react-native'
import { MapView } from '../map/MapView'

type Props = {
  topSlot?: React.ReactNode
  bottomSlot?: React.ReactNode
  floatingSlot?: React.ReactNode
}

export const MapScreenShell: React.FC<Props> = ({ topSlot, bottomSlot, floatingSlot }) => {
  return (
    <View style={styles.container}>
      <MapView />
      {topSlot ? <View style={styles.topSlot}>{topSlot}</View> : null}
      {floatingSlot ? <View style={styles.floatingSlot}>{floatingSlot}</View> : null}
      {bottomSlot ? <View style={styles.bottomSlot}>{bottomSlot}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topSlot: { position: 'absolute', top: 12, left: 12, right: 12 },
  floatingSlot: { position: 'absolute', top: 120, left: 12, right: 12 },
  bottomSlot: { position: 'absolute', left: 12, right: 12, bottom: 12 }
})
