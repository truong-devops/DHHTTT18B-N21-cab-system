import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors, spacing, typography } from '../../theme/tokens'
import { Chip } from '../common/Chip'

export const DriverStatusBar: React.FC<{ status: string }> = ({ status }) => {
  return (
    <View style={styles.row}>
      <Chip label={status} variant={status === 'ONLINE' ? 'success' : 'outline'} />
      <Text style={styles.text}>Kết nối ổn định</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  text: { ...typography.caption, color: colors.muted }
})
