import React, { useState } from 'react'
import { Text, StyleSheet } from 'react-native'
import ScreenContainer from '../../components/layout/ScreenContainer'
import OtpInput from '../../components/common/OtpInput'
import PrimaryButton from '../../components/common/PrimaryButton'
import { colors, spacing, typography } from '../../styles/theme'
import useAuth from '../../hooks/useAuth'
import { setAuthToken } from '../../services/api'

export default function OtpScreen() {
  const [code, setCode] = useState('')
  const { login } = useAuth()

  const handleVerify = () => {
    const token = 'mock-token'
    setAuthToken(token)
    login(token, { id: 'u1' })
  }

  return (
    <ScreenContainer style={styles.container}>
      <Text style={styles.title}>Nhập OTP</Text>
      <OtpInput value={code} onChangeText={setCode} />
      <PrimaryButton title="Xác nhận" onPress={handleVerify} style={{ marginTop: spacing.lg }} />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
  title: { color: colors.text, ...typography.title, marginBottom: spacing.lg }
})
