import React, { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { InputField } from '../../components/common/InputField'
import { PrimaryButton } from '../../components/common/PrimaryButton'
import { colors, spacing, typography } from '../../theme/tokens'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { AuthStackParamList } from '../../navigation/AuthStack'
import { useToast } from '../../hooks/useToast'

const LoginScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>()
  const [identifier, setIdentifier] = useState('')
  const { push } = useToast()

  const handleContinue = () => {
    if (!identifier.trim()) {
      push('Vui lòng nhập email hoặc số điện thoại', 'danger')
      return
    }
    navigation.navigate('Otp', { identifier })
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Đăng nhập tài xế</Text>
      <Text style={styles.subtitle}>Dùng tài khoản đã đăng ký</Text>
      <InputField
        label="Email hoặc SĐT"
        value={identifier}
        onChangeText={setIdentifier}
        placeholder="email@domain.com hoặc 090xxxxxxx"
      />
      <PrimaryButton title="Tiếp tục" onPress={handleContinue} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl },
  title: { ...typography.title, marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.muted, marginBottom: spacing.xl }
})

export default LoginScreen
