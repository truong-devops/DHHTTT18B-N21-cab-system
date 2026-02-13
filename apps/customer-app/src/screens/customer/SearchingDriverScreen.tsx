import React, { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { MainStackParamList } from '../../navigation/MainStack'
import { colors, spacing, typography } from '../../theme/tokens'
import { OutlineButton } from '../../components/common/OutlineButton'
import { useCustomerStore } from '../../store/customerStore'
import { useToast } from '../../hooks/useToast'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'

const SearchingDriverScreen = () => {
  const route = useRoute<RouteProp<MainStackParamList, 'SearchingDriver'>>()
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const { startRide } = useCustomerStore()
  const { push } = useToast()
  const [seconds, setSeconds] = useState(6)

  useEffect(() => {
    const intervalId = setInterval(() => {
      setSeconds((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    startRide(route.params.pickup, route.params.destination)
      .then(() => {
        const navTimer = setTimeout(() => navigation.replace('RideTracking'), 1600)
        return () => clearTimeout(navTimer)
      })
      .catch((err: any) => {
        push(err?.message || 'No driver found', 'danger')
        navigation.goBack()
      })

    return () => clearInterval(intervalId)
  }, [navigation, push, route.params.destination, route.params.pickup, startRide])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Searching Driver</Text>
      <Text style={styles.subtitle}>Matching in realtime... {seconds}s</Text>
      <ActivityIndicator size="large" color={colors.brand600} />
      <OutlineButton title="Cancel" onPress={() => navigation.goBack()} />
      {/* TODO: Subscribe to matching events through WebSocket or SSE instead of timer */}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg
  },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.muted }
})

export default SearchingDriverScreen
