import React, { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors, spacing, typography } from '../../theme/tokens'
import { PrimaryButton } from '../../components/common/PrimaryButton'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { AuthStackParamList } from '../../navigation/AuthStack'

const SplashScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>()

  useEffect(() => {
    const id = setTimeout(() => navigation.replace('Login'), 800)
    return () => clearTimeout(id)
  }, [navigation])

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>CAB Driver</Text>
      <PrimaryButton title="Bắt đầu" onPress={() => navigation.replace('Login')} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.bg },
  logo: { ...typography.title, fontSize: 28, marginBottom: spacing.xl }
})

export default SplashScreen
