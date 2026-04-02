import React, { useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { MainStackParamList } from '../../navigation/MainStack'
import { LiveRouteMap } from '../../components/map/LiveRouteMap'
import { DriverInfoCard } from '../../components/customer/DriverInfoCard'
import { PrimaryButton } from '../../components/common/PrimaryButton'
import { colors, spacing, typography } from '../../theme/tokens'
import { destinationPoints } from '../../mock/data'
import { useCustomerStore } from '../../store/customerStore'
import { customerApi } from '../../services/customerApi'
import { useRealtimeStream } from '../../hooks/useRealtimeStream'

const RideTrackingScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const { activeRide, decreaseEta } = useCustomerStore()
  const { latestEvent } = useRealtimeStream()
  const [eta, setEta] = useState(activeRide?.etaMinutes || 5)

  const destinationCoordinate = useMemo(() => {
    if (!activeRide) return null
    const found = destinationPoints.find((point) => point.label === activeRide.destination)
    if (!found) return null
    return { ...found }
  }, [activeRide])

  useEffect(() => {
    if (!activeRide) return
    setEta(activeRide.etaMinutes)
    const id = setInterval(() => {
      decreaseEta()
      setEta((prev) => Math.max(prev - 1, 1))
    }, 3000)
    return () => clearInterval(id)
  }, [activeRide, decreaseEta])

  useEffect(() => {
    if (latestEvent?.type === 'driver_location' && latestEvent.etaMinutes) {
      setEta(latestEvent.etaMinutes)
    }
  }, [latestEvent])

  if (!activeRide?.driver) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Không tìm thấy trạng thái chuyến đi</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapArea}>
        <LiveRouteMap
          destination={destinationCoordinate}
          etaMinutes={eta}
          onLocationChange={(coords) => customerApi.setLivePickupLocation(coords.latitude, coords.longitude)}
        />
      </View>
      <DriverInfoCard driver={activeRide.driver} etaMinutes={eta} />
      <PrimaryButton title="Hoàn tất chuyến đi" onPress={() => navigation.replace('Payment')} />
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
