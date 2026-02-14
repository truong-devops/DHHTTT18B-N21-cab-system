import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { MainStackParamList } from '../../navigation/MainStack'
import { MapPlaceholder } from '../../components/map/MapPlaceholder'
import { Card } from '../../components/common/Card'
import { PrimaryButton } from '../../components/common/PrimaryButton'
import { colors, spacing, typography } from '../../theme/tokens'
import { nearbyDrivers } from '../../mock/data'

const HomeMapScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()

  return (
    <View style={styles.container}>
      <View style={styles.mapWrap}>
        <MapPlaceholder label="C3 Home Map & Pickup - live map will be integrated later" />
      </View>
      <Card>
        <Text style={styles.title}>Pickup: Current Location</Text>
        <Text style={styles.meta}>{nearbyDrivers} drivers nearby</Text>
        <PrimaryButton title="Set Destination" onPress={() => navigation.navigate('Destination')} />
      </Card>
      {/* TODO: Integrate WebSocket nearby-driver updates from Ride Service */}
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
