import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import ScreenContainer from '../../components/layout/ScreenContainer'
import MapPlaceholder from '../../components/map/MapPlaceholder'
import BottomSheet from '../../components/sheets/BottomSheet'
import PrimaryButton from '../../components/common/PrimaryButton'
import { colors, spacing, typography } from '../../styles/theme'
import useGeoLocation from '../../hooks/useGeoLocation'

export default function HomeMapPickupScreen({ navigation }) {
  const { coords, error } = useGeoLocation()
  const pickupText = coords
    ? `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`
    : error
    ? 'Không có quyền định vị'
    : 'Đang lấy vị trí...'

  return (
    <ScreenContainer>
      <MapPlaceholder height="70%" />
      <BottomSheet>
        <Text style={styles.label}>Điểm đón</Text>
        <Text style={styles.value}>{pickupText}</Text>
        <PrimaryButton
          title="Chọn điểm đến"
          onPress={() =>
            navigation.navigate('Destination', {
              pickup: coords ? { lat: coords.latitude, lng: coords.longitude } : null
            })
          }
          style={{ marginTop: spacing.lg }}
        />
      </BottomSheet>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  label: { color: colors.muted, ...typography.caption },
  value: { color: colors.text, ...typography.body, marginTop: 4 }
})
