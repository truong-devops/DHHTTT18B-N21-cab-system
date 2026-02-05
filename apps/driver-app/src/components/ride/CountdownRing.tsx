import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors, typography } from '../../theme/tokens'

type Props = {
  seconds: number
}

export const CountdownRing: React.FC<Props> = ({ seconds }) => {
  return (
    <View style={styles.ring}>
      <Text style={styles.text}>{seconds}s</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  ring: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 4,
    borderColor: colors.brand600,
    alignItems: 'center',
    justifyContent: 'center'
  },
  text: {
    ...typography.h2,
    color: colors.brand600
  }
})
