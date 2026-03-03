import React, { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { MainStackParamList } from '../../navigation/MainStack'
import { MapPlaceholder } from '../../components/map/MapPlaceholder'
import { DriverInfoCard } from '../../components/customer/DriverInfoCard'
import { PrimaryButton } from '../../components/common/PrimaryButton'
import { colors, spacing, typography } from '../../theme/tokens'
import { useCustomerStore } from '../../store/customerStore'

const RideTrackingScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const { activeRide, decreaseEta } = useCustomerStore()

  useEffect(() => {
    if (!activeRide) return
    const id = setInterval(() => {
      decreaseEta()
    }, 3000)
    return () => clearInterval(id)
  }, [activeRide, decreaseEta])

  if (!activeRide?.driver) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Ride state missing</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapArea}>
        <MapPlaceholder label="C7 Ride Tracking map (driver + route)" />
      </View>
      <DriverInfoCard driver={activeRide.driver} etaMinutes={activeRide.etaMinutes} />
      <PrimaryButton title="Complete Ride" onPress={() => navigation.replace('Payment')} />
      {/* TODO: Replace simulated ETA countdown with realtime ETA stream from ETA Service */}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, gap: spacing.md },
  mapArea: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  emptyText: { ...typography.body, color: colors.muted }
})

export default RideTrackingScreen

