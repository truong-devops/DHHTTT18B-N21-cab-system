import React, { useRef } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Card } from '../../components/common/Card'
import { PrimaryButton } from '../../components/common/PrimaryButton'
import { colors, spacing, typography } from '../../theme/tokens'
import { useAuthStore } from '../../store/authStore'
import { useNavigation } from '@react-navigation/native'

const ProfileScreen = () => {
  const { logout, user } = useAuthStore()
  const navigation = useNavigation()
  const tapCount = useRef(0)
  const tapTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleDebugTap = () => {
    tapCount.current += 1
    if (tapTimeout.current) clearTimeout(tapTimeout.current)
    tapTimeout.current = setTimeout(() => {
      tapCount.current = 0
    }, 1500)
    if (tapCount.current >= 5) {
      tapCount.current = 0
      navigation.navigate('ApiTester' as never)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tài khoản</Text>
      <Card style={styles.card}>
        <Text style={styles.label}>Tên</Text>
        <Text style={styles.value}>{user?.name || 'Driver'}</Text>
        <Text style={styles.label}>SĐT</Text>
        <Text style={styles.value}>{user?.phone || user?.email || '---'}</Text>
      </Card>
      <PrimaryButton title="Đăng xuất" onPress={() => void logout()} />
      <Pressable onPress={handleDebugTap} style={styles.debug}
        accessibilityLabel="Debug Menu"
      >
        <Text style={styles.debugText}>Version 1.0.0 (tap 5x)</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl },
  title: { ...typography.title, marginBottom: spacing.lg },
  card: { marginBottom: spacing.lg },
  label: { ...typography.caption, color: colors.muted },
  value: { ...typography.body, marginBottom: spacing.md },
  debug: { marginTop: spacing.lg, alignItems: 'center' },
  debugText: { ...typography.caption, color: colors.muted }
})

export default ProfileScreen
