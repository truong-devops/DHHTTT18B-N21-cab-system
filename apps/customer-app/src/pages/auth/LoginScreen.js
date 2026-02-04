import React, { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import ScreenContainer from '../../components/layout/ScreenContainer'
import InputField from '../../components/common/InputField'
import PrimaryButton from '../../components/common/PrimaryButton'
import { colors, spacing, typography } from '../../styles/theme'
import { login as loginApi } from '../../services/authApi'
import useAuth from '../../hooks/useAuth'
import { setAuthToken } from '../../services/api'
import { useToast } from '../../hooks/useToast'

export default function LoginScreen({ navigation }) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const { login, setLoading } = useAuth()
  const { show } = useToast()

  const handleLogin = async () => {
    try {
      setLoading(true)
      const res = await loginApi({ identifier, password })
      const token = res.tokens?.accessToken || res.accessToken
      setAuthToken(token)
      login(token, res.data)
    } catch (e) {
      show(e.message || 'Đăng nhập thất bại', 'danger')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScreenContainer style={styles.container}>
      <Text style={styles.title}>Đăng nhập</Text>
      <InputField
        label="Số điện thoại / Email"
        value={identifier}
        onChangeText={setIdentifier}
        placeholder="Nhập số điện thoại hoặc email"
      />
      <InputField
        label="Mật khẩu"
        value={password}
        onChangeText={setPassword}
        placeholder="Nhập mật khẩu"
        secureTextEntry
      />
      <PrimaryButton title="Đăng nhập" onPress={handleLogin} />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
  title: { color: colors.text, ...typography.title, marginBottom: spacing.lg }
})
