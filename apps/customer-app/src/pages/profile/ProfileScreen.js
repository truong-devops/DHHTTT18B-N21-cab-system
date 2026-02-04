import React from 'react'
import { Text, StyleSheet } from 'react-native'
import ScreenContainer from '../../components/layout/ScreenContainer'
import PrimaryButton from '../../components/common/PrimaryButton'
import { colors, spacing, typography } from '../../styles/theme'
import useAuth from '../../hooks/useAuth'

export default function ProfileScreen() {
  const { logout } = useAuth()
  return (
    <ScreenContainer style={styles.container}>
      <Text style={styles.title}>Hồ sơ</Text>
      <PrimaryButton title="Đăng xuất" onPress={logout} />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
  title: { color: colors.text, ...typography.title, marginBottom: spacing.lg }
})
