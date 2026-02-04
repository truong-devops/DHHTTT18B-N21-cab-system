import React from 'react'
import { Text, StyleSheet } from 'react-native'
import ScreenContainer from '../../components/layout/ScreenContainer'
import { colors, spacing, typography } from '../../styles/theme'

export default function TripDetailScreen() {
  return (
    <ScreenContainer style={styles.container}>
      <Text style={styles.title}>Chi tiết chuyến đi</Text>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
  title: { color: colors.text, ...typography.title }
})
