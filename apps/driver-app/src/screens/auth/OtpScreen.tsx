import React, { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { InputField } from '../../components/common/InputField'
import { PrimaryButton } from '../../components/common/PrimaryButton'
import { colors, spacing, typography } from '../../theme/tokens'
import { useRoute } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { AuthStackParamList } from '../../navigation/AuthStack'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../hooks/useAuth'

const OtpScreen = () => {
  const route = useRoute<RouteProp<AuthStackParamList, 'Otp'>>()
  const [password, setPassword] = useState('')
  const { push } = useToast()
  const { loginWithPassword } = useAuth()

  const handleVerify = async () => {
    try {
      await loginWithPassword(route.params.identifier, password)
    } catch (err: any) {
      push(err.message || 'Đăng nhập thất bại', 'danger')
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nhập mật khẩu</Text>
      <Text style={styles.subtitle}>Tài khoản: {route.params.identifier}</Text>
      <InputField
        label="Mật khẩu"
        value={password}
        onChangeText={setPassword}
        placeholder="••••••"
        secureTextEntry
      />
      <PrimaryButton title="Đăng nhập" onPress={handleVerify} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl },
  title: { ...typography.title, marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.muted, marginBottom: spacing.xl }
})

export default OtpScreen
