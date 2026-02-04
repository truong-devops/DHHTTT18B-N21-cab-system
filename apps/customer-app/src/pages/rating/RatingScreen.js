import React from 'react'
import { Text, StyleSheet } from 'react-native'
import ScreenContainer from '../../components/layout/ScreenContainer'
import PrimaryButton from '../../components/common/PrimaryButton'
import { colors, spacing, typography } from '../../styles/theme'

export default function RatingScreen({ navigation }) {
  return (
    <ScreenContainer style={styles.container}>
      <Text style={styles.title}>Đánh giá chuyến đi</Text>
      <PrimaryButton title="Gửi đánh giá" onPress={() => navigation.navigate('HomeMap')} />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
  title: { color: colors.text, ...typography.title, marginBottom: spacing.lg }
})
