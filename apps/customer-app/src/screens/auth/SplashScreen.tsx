import React, { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { AuthStackParamList } from '../../navigation/AuthStack'
import { colors, spacing, typography } from '../../theme/tokens'

const SplashScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>()

  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('Login')
    }, 1100)
    return () => clearTimeout(timer)
  }, [navigation])

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>CAB CUSTOMER</Text>
      <Text style={styles.subtitle}>Book | Track | Pay</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg
  },
  logo: {
    ...typography.title,
    color: colors.brand700
  },
  subtitle: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.sm
  }
})

export default SplashScreen
