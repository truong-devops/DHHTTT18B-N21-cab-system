import React from 'react'
import { View, StyleSheet, Text } from 'react-native'
import ScreenContainer from '../../components/layout/ScreenContainer'
import MapPlaceholder from '../../components/map/MapPlaceholder'
import DriverInfoCard from '../../components/ride/DriverInfoCard'
import StatusChip from '../../components/ride/StatusChip'
import { spacing, colors, typography } from '../../styles/theme'
import useRideRealtime from '../../hooks/useRideRealtime'

export default function RideTrackingScreen({ route }) {
  const rideId = route?.params?.rideId
  const { data } = useRideRealtime(rideId, !!rideId)

  const statusLabel = data?.status ? `Trạng thái: ${data.status}` : 'Đang cập nhật...'

  return (
    <ScreenContainer>
      <MapPlaceholder height="70%" />
      <View style={styles.bottom}>
        <StatusChip label={statusLabel} />
        <View style={{ height: spacing.md }} />
        <Text style={styles.rideId}>Ride: {rideId || 'N/A'}</Text>
        <DriverInfoCard />
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  bottom: { padding: spacing.lg },
  rideId: { color: colors.muted, ...typography.caption, marginBottom: spacing.sm }
})
