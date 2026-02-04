import React, { useEffect } from 'react'
import { Text, StyleSheet } from 'react-native'
import ScreenContainer from '../../components/layout/ScreenContainer'
import SecondaryButton from '../../components/common/SecondaryButton'
import { colors, spacing, typography } from '../../styles/theme'

export default function SearchingDriverScreen({ navigation, route }) {
  const rideId = route?.params?.rideId

  useEffect(() => {
    if (!rideId) return
    const t = setTimeout(() => {
      navigation.replace('Tracking', { rideId })
    }, 1200)
    return () => clearTimeout(t)
  }, [rideId, navigation])

  return (
    <ScreenContainer style={styles.container}>
      <Text style={styles.title}>Đang tìm tài xế...</Text>
      <SecondaryButton title="Hủy" onPress={() => navigation.navigate('HomeMap')} style={{ marginTop: spacing.lg }} />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, ...typography.title }
})
