import React from 'react'
import { Text, StyleSheet } from 'react-native'
import ScreenContainer from '../../components/layout/ScreenContainer'
import { colors, spacing, typography } from '../../styles/theme'

export default function SettingsScreen() {
  return (
    <ScreenContainer style={styles.container}>
      <Text style={styles.title}>Cài đặt</Text>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
  title: { color: colors.text, ...typography.title }
})
