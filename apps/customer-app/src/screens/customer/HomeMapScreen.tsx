import React, { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { MainStackParamList } from '../../navigation/MainStack'
import { CustomerLiveMap } from '../../components/map/CustomerLiveMap'
import { Card } from '../../components/common/Card'
import { PrimaryButton } from '../../components/common/PrimaryButton'
import { colors, spacing, typography } from '../../theme/tokens'
import { destinationPoints, nearbyDrivers } from '../../mock/data'
import { useCustomerStore } from '../../store/customerStore'
import { customerApi } from '../../services/customerApi'

const HomeMapScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const { destination } = useCustomerStore()

  const destinationCoordinate = useMemo(() => {
    const found = destinationPoints.find((point) => point.label === destination)
    if (!found) return null
    return { latitude: found.lat, longitude: found.lng }
  }, [destination])

  return (
    <View style={styles.container}>
      <View style={styles.mapWrap}>
        <CustomerLiveMap
          label="Bản đồ điểm đón trực tiếp"
          destination={destinationCoordinate}
          showRoute={Boolean(destinationCoordinate)}
          onLocationChange={(coords) => {
            customerApi.setLivePickupLocation(coords.latitude, coords.longitude)
          }}
        />
      </View>
      <Card>
        <Text style={styles.title}>Điểm đón: Vị trí hiện tại</Text>
        <Text style={styles.meta}>Có {nearbyDrivers} tài xế ở gần bạn</Text>
        <PrimaryButton title="Chọn điểm đến" onPress={() => navigation.navigate('Destination')} />
      </Card>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, gap: spacing.md },
  mapWrap: { flex: 1 },
  title: { ...typography.h2, color: colors.text },
  meta: { ...typography.body, color: colors.muted }
})

export default HomeMapScreen
