import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Card } from '../../components/common/Card'
import { PrimaryButton } from '../../components/common/PrimaryButton'
import { OutlineButton } from '../../components/common/OutlineButton'
import { colors, spacing, typography } from '../../theme/tokens'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { MainStackParamList } from '../../navigation/MainStack'
import { formatCurrency } from '../../utils/format'
import { useRideTracking } from '../../hooks/useRideTracking'

const CompletedScreen = () => {
  const navigation = useNavigation()
  const route = useRoute<RouteProp<MainStackParamList, 'Completed'>>()
  const rideId = route.params?.rideId
  const ride = useRideTracking(rideId)
  const amount = ride?.price || ride?.fare || 0

  return (
    <View style={styles.container}>
      <Card>
        <Text style={styles.title}>Chuyến đi hoàn tất</Text>
        <Text style={styles.amount}>{amount ? formatCurrency(amount) : '---'}</Text>
        <Text style={styles.subtitle}>Thanh toán: Tiền mặt</Text>
      </Card>
      <View style={styles.actions}>
        <PrimaryButton title="Về màn hình chính" onPress={() => navigation.navigate('Tabs' as never)} />
        <OutlineButton title="Xem thu nhập" onPress={() => navigation.navigate('Tabs' as never)} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, backgroundColor: colors.bg },
  title: { ...typography.h2, marginBottom: spacing.md },
  amount: { ...typography.title, marginBottom: spacing.md },
  subtitle: { ...typography.body, color: colors.muted },
  actions: { marginTop: spacing.xl, gap: spacing.md }
})

export default CompletedScreen
