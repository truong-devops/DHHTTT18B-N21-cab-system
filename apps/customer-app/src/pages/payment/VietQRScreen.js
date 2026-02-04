import React from 'react'
import { Text, StyleSheet } from 'react-native'
import ScreenContainer from '../../components/layout/ScreenContainer'
import PrimaryButton from '../../components/common/PrimaryButton'
import { colors, spacing, typography } from '../../styles/theme'

export default function VietQRScreen({ navigation }) {
  return (
    <ScreenContainer style={styles.container}>
      <Text style={styles.title}>Quét mã VietQR</Text>
      <Text style={styles.subtitle}>QR sẽ hiển thị tại đây</Text>
      <PrimaryButton title="Tôi đã thanh toán" onPress={() => navigation.navigate('Rating')} style={{ marginTop: spacing.lg }} />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, alignItems: 'center' },
  title: { color: colors.text, ...typography.title },
  subtitle: { color: colors.muted, ...typography.body, marginTop: spacing.md }
})
