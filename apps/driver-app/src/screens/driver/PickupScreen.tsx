import React, { useEffect } from 'react'
import { StyleSheet, Text } from 'react-native'
import { MapScreenShell } from '../../components/common/MapScreenShell'
import { TripActionPanel } from '../../components/ride/TripActionPanel'
import { Card } from '../../components/common/Card'
import { colors, spacing, typography } from '../../theme/tokens'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { MainStackParamList } from '../../navigation/MainStack'
import { rideApi } from '../../services/rideApi'
import { useRideTracking } from '../../hooks/useRideTracking'
import { useToast } from '../../hooks/useToast'

const PickupScreen = () => {
  const navigation = useNavigation()
  const route = useRoute<RouteProp<MainStackParamList, 'Pickup'>>()
  const rideId = route.params?.rideId
  const ride = useRideTracking(rideId)
  const { push } = useToast()

  useEffect(() => {
    if (!rideId) return
    rideApi.updateStatus(rideId, 'ARRIVING').catch((err) => {
      push(err?.message || 'Không thể cập nhật trạng thái', 'danger')
    })
  }, [rideId])

  const handleArrived = async () => {
    try {
      if (rideId) {
        await rideApi.updateStatus(rideId, 'IN_PROGRESS')
      }
      navigation.navigate('InProgress' as never, { rideId } as never)
    } catch (err: any) {
      push(err?.message || 'Không thể bắt đầu chuyến', 'danger')
    }
  }

  return (
    <MapScreenShell
      floatingSlot={
        <Card style={styles.floating}>
          <Text style={styles.floatingTitle}>ETA đến điểm đón</Text>
          <Text style={styles.floatingValue}>{ride?.etaMinutes ? `${ride.etaMinutes} phút` : 'Đang cập nhật'}</Text>
        </Card>
      }
      bottomSlot={
        <TripActionPanel
          title="Đang tới điểm đón"
          subtitle={ride?.pickup ? `Pickup: ${ride.pickup}` : 'Pickup: (chưa có dữ liệu)'}
          primaryLabel="Đã đến điểm đón"
          secondaryLabel="Gọi khách"
          onPrimary={handleArrived}
        />
      }
    />
  )
}

const styles = StyleSheet.create({
  floating: { padding: spacing.md },
  floatingTitle: { ...typography.caption, color: colors.muted },
  floatingValue: { ...typography.h2, color: colors.text }
})

export default PickupScreen
