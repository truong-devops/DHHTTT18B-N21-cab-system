import React, { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { InputField } from '../../components/common/InputField'
import { PrimaryButton } from '../../components/common/PrimaryButton'
import { colors, spacing, typography } from '../../theme/tokens'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { AuthStackParamList } from '../../navigation/AuthStack'
import { customerMockApi } from '../../services/mockApi'
import { useToast } from '../../hooks/useToast'

const LoginScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>()
  const [identifier, setIdentifier] = useState('')
  const [loading, setLoading] = useState(false)
  const { push } = useToast()

  const handleContinue = async () => {
    if (!identifier.trim()) {
      push('Please enter phone or email', 'danger')
      return
    }

    try {
      setLoading(true)
      const result = await customerMockApi.requestOtp(identifier)
      if (!result.ok) throw new Error('Cannot request OTP')
      navigation.navigate('Otp', { identifier })
    } catch (err: any) {
      push(err?.message || 'Request OTP failed', 'danger')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Customer Login</Text>
      <Text style={styles.subtitle}>Use your phone or email to continue</Text>
      <InputField
        label="Phone or Email"
        value={identifier}
        onChangeText={setIdentifier}
        placeholder="090xxxxxxx or user@email.com"
      />
      <PrimaryButton title={loading ? 'Sending OTP...' : 'Continue'} onPress={handleContinue} disabled={loading} />
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
