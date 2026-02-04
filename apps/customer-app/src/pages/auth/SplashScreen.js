import React, { useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import ScreenContainer from '../../components/layout/ScreenContainer'
import { colors, typography } from '../../styles/theme'

export default function SplashScreen({ navigation }) {
  useEffect(() => {
    const t = setTimeout(() => navigation.replace('Onboarding'), 800)
    return () => clearTimeout(t)
  }, [navigation])

  return (
    <ScreenContainer style={styles.center}>
      <Text style={styles.logo}>CAB Booking</Text>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  logo: { color: colors.brand600, ...typography.title }
})
