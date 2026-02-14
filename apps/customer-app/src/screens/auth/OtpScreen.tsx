import React, { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { InputField } from '../../components/common/InputField'
import { PrimaryButton } from '../../components/common/PrimaryButton'
import { colors, spacing, typography } from '../../theme/tokens'
import { useCustomerStore } from '../../store/customerStore'
import { useRoute } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { AuthStackParamList } from '../../navigation/AuthStack'
import { useToast } from '../../hooks/useToast'

const OtpScreen = () => {
  const route = useRoute<RouteProp<AuthStackParamList, 'Otp'>>()
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useCustomerStore()
  const { push } = useToast()

  const handleVerify = async () => {
    try {
      setLoading(true)
      await login(route.params.identifier, otp)
      push('Login success', 'success')
    } catch (err: any) {
      push(err?.message || 'OTP verification failed', 'danger')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>OTP Verification</Text>
      <Text style={styles.subtitle}>Enter code sent to {route.params.identifier}</Text>
      <InputField label="OTP Code" value={otp} onChangeText={setOtp} placeholder="123456" />
      <PrimaryButton title={loading ? 'Verifying...' : 'Verify'} onPress={handleVerify} disabled={loading} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, gap: spacing.lg },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.muted }
})

export default OtpScreen
