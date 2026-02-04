import React from 'react'
import { Text, StyleSheet, ScrollView } from 'react-native'
import ScreenContainer from '../../components/layout/ScreenContainer'
import TripItem from '../../components/trips/TripItem'
import { colors, spacing, typography } from '../../styles/theme'

export default function RideHistoryScreen({ navigation }) {
  return (
    <ScreenContainer style={styles.container}>
      <Text style={styles.title}>Lịch sử chuyến đi</Text>
      <ScrollView>
        <TripItem title="Quận 1 -> Quận 3" subtitle="Hôm nay" amount="32.000 VND" />
        <TripItem title="Quận 5 -> Quận 7" subtitle="Hôm qua" amount="45.000 VND" />
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
  title: { color: colors.text, ...typography.title, marginBottom: spacing.lg }
})
