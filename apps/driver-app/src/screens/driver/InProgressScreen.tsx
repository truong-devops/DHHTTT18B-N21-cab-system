import React from 'react'
import { StyleSheet, Text } from 'react-native'
import { MapScreenShell } from '../../components/common/MapScreenShell'
import { TripActionPanel } from '../../components/ride/TripActionPanel'
import { Card } from '../../components/common/Card'
import { colors, spacing, typography } from '../../theme/tokens'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { MainStackParamList } from '../../navigation/MainStack'
import { useRideRealtime } from '../../hooks/useRideRealtime'
import { rideApi } from '../../services/rideApi'
import { useToast } from '../../hooks/useToast'

const InProgressScreen = () => {
  const navigation = useNavigation()
  const route = useRoute<RouteProp<MainStackParamList, 'InProgress'>>()
  const rideId = route.params?.rideId
  const realtime = useRideRealtime(rideId)
  const { push } = useToast()

  const handleComplete = async () => {
    try {
      if (rideId) {
        await rideApi.updateStatus(rideId, 'COMPLETED')
      }
      navigation.navigate('Completed' as never, { rideId } as never)
    } catch (err: any) {
      push(err?.message || 'Không thể kết thúc chuyến', 'danger')
    }
  }

  return (
    <MapScreenShell
      floatingSlot={
        <Card style={styles.floating}>
          <Text style={styles.floatingTitle}>ETA đến điểm trả</Text>
          <Text style={styles.floatingValue}>
            {realtime?.etaMinutes ? `${realtime.etaMinutes} phút` : 'Đang cập nhật'}
          </Text>
        </Card>
      }
      bottomSlot={
        <TripActionPanel
          title="Đang chở khách"
          subtitle={realtime?.price ? `Giá tạm tính: ${realtime.price}đ` : 'Giá tạm tính: --'}
          primaryLabel="Kết thúc chuyến"
          onPrimary={handleComplete}
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

export default InProgressScreen
