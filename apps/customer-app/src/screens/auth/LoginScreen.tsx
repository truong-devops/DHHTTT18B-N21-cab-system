import React, { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { InputField } from '../../components/common/InputField'
import { PrimaryButton } from '../../components/common/PrimaryButton'
import { colors, spacing, typography } from '../../theme/tokens'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { AuthStackParamList } from '../../navigation/AuthStack'
import { customerApi } from '../../services/customerApi'
import { useToast } from '../../hooks/useToast'

const LoginScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>()
  const [identifier, setIdentifier] = useState('')
  const [loading, setLoading] = useState(false)
  const { push } = useToast()

  const handleContinue = async () => {
    const normalizedIdentifier = identifier.trim()
    if (!normalizedIdentifier) {
      push('Vui lòng nhập số điện thoại hoặc email', 'danger')
      return
    }

    try {
      setLoading(true)
      const result = await customerApi.requestOtp(normalizedIdentifier)
      if (!result.ok) throw new Error('Không thể gửi OTP')
      navigation.navigate('Otp', { identifier: normalizedIdentifier })
    } catch (err: any) {
      push(err?.message || 'Gửi OTP thất bại', 'danger')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Đăng nhập khách hàng</Text>
      <Text style={styles.subtitle}>Nhập số điện thoại hoặc email để tiếp tục (OTP/Mật khẩu ở bước sau)</Text>
      <InputField
        label="Số điện thoại hoặc Email"
        value={identifier}
        onChangeText={setIdentifier}
        placeholder="090xxxxxxx hoặc user@email.com"
      />
      <PrimaryButton title={loading ? 'Đang gửi OTP...' : 'Tiếp tục'} onPress={handleContinue} disabled={loading} />
      {/* TODO: Add social login buttons when Auth Service supports OAuth providers */}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, gap: spacing.lg },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.muted }
})

export default LoginScreen
