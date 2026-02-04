import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import ScreenContainer from '../../components/layout/ScreenContainer'
import PrimaryButton from '../../components/common/PrimaryButton'
import { colors, spacing, typography } from '../../styles/theme'

export default function OnboardingScreen({ navigation }) {
  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Đặt xe - Theo dõi - Thanh toán</Text>
        <Text style={styles.subtitle}>Trải nghiệm đặt xe nhanh và an toàn.</Text>
      </View>
      <PrimaryButton title="Bắt đầu" onPress={() => navigation.replace('Login')} />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, justifyContent: 'space-between' },
  content: { marginTop: 40 },
  title: { color: colors.text, ...typography.title },
  subtitle: { color: colors.muted, ...typography.body, marginTop: 8 }
})
