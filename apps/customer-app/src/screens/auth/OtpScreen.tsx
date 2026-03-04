import React, { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { InputField } from '../../components/common/InputField'
import { PrimaryButton } from '../../components/common/PrimaryButton'
import { colors, spacing, typography } from '../../theme/tokens'
import { useCustomerStore } from '../../store/customerStore'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { AuthStackParamList } from '../../navigation/AuthStack'
import { useToast } from '../../hooks/useToast'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'

const OtpScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>()
  const route = useRoute<RouteProp<AuthStackParamList, 'Otp'>>()
  const [identifier, setIdentifier] = useState(route.params?.identifier?.trim() || '')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useCustomerStore()
  const { push } = useToast()

  const handleVerify = async () => {
    const normalizedIdentifier = identifier.trim()
    if (!normalizedIdentifier) {
      push('Vui lòng nhập số điện thoại/email', 'danger')
      return
    }

    const credential = otp.trim()
    if (!credential) {
      push('Vui lòng nhập OTP hoặc mật khẩu', 'danger')
      return
    }

    try {
      setLoading(true)
      await login(normalizedIdentifier, credential)
      push('Đăng nhập thành công', 'success')
    } catch (err: any) {
      push(err?.message || 'Xác thực OTP thất bại', 'danger')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Xác thực OTP</Text>
      <Text style={styles.subtitle}>Nhập số điện thoại/email và OTP hoặc mật khẩu tài khoản</Text>
      <InputField
        label="Số điện thoại hoặc Email"
        value={identifier}
        onChangeText={setIdentifier}
        placeholder="090xxxxxxx hoặc user@email.com"
      />
      <InputField label="OTP / Mật khẩu" value={otp} onChangeText={setOtp} placeholder="123456" />
      <PrimaryButton title={loading ? 'Đang xác thực...' : 'Xác nhận'} onPress={handleVerify} disabled={loading} />
      <PrimaryButton title="Quay lại đăng nhập" onPress={() => navigation.replace('Login')} disabled={loading} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, gap: spacing.lg },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.muted }
})

export default OtpScreen
