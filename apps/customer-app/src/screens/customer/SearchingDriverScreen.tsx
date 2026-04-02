import React, { useEffect, useRef, useState } from 'react'
import { Animated, Easing, StyleSheet, Text, View } from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { MainStackParamList } from '../../navigation/MainStack'
import { colors, spacing, typography } from '../../theme/tokens'
import { OutlineButton } from '../../components/common/OutlineButton'
import { useCustomerStore } from '../../store/customerStore'
import { useToast } from '../../hooks/useToast'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useRealtimeStream } from '../../hooks/useRealtimeStream'

const SearchingDriverScreen = () => {
  const route = useRoute<RouteProp<MainStackParamList, 'SearchingDriver'>>()
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const { startRide } = useCustomerStore()
  const { push } = useToast()
  const [status, setStatus] = useState<'searching' | 'found'>('searching')
  const [seconds, setSeconds] = useState(12)
  const ripple = useRef(new Animated.Value(0)).current
  const { latestEvent } = useRealtimeStream()

  useEffect(() => {
    const intervalId = setInterval(() => setSeconds((prev) => (prev > 0 ? prev - 1 : 0)), 1000)
    return () => clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (latestEvent?.type === 'match_status' && latestEvent.status === 'found') {
      setStatus('found')
      const navTimer = setTimeout(() => navigation.replace('RideTracking'), 1200)
      return () => clearTimeout(navTimer)
    }
    return undefined
  }, [latestEvent, navigation])

  useEffect(() => {
    startRide(route.params.pickup, route.params.destination)
      .then(() => {
        // fallback: auto move to tracking after small delay
        const navTimer = setTimeout(() => navigation.replace('RideTracking'), 2000)
        return () => clearTimeout(navTimer)
      })
      .catch((err: any) => {
        push(err?.message || 'Không tìm thấy tài xế', 'danger')
        navigation.goBack()
      })
  }, [navigation, push, route.params.destination, route.params.pickup, startRide])

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(ripple, {
        toValue: 1,
        duration: 1400,
        easing: Easing.ease,
        useNativeDriver: true
      })
    )
    loop.start()
    return () => loop.stop()
  }, [ripple])

  return (
    <View style={styles.container}>
      <View style={styles.radarWrap}>
        <Animated.View
          style={[
            styles.radar,
            {
              transform: [{ scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.2] }) }],
              opacity: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] })
            }
          ]}
        />
        <View style={styles.dot} />
      </View>
      <Text style={styles.title}>{status === 'searching' ? 'Đang tìm tài xế' : 'Đã tìm thấy tài xế'}</Text>
      <Text style={styles.subtitle}>
        Trạng thái thời gian thực... {status === 'searching' ? `${seconds}s` : 'chuẩn bị điều hướng'}
      </Text>
      <OutlineButton title="Hủy" onPress={() => navigation.goBack()} />
      {/* TODO: Subscribe to real Kafka/SSE matching events when backend ready */}
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
  radarWrap: {
    width: 220,
    height: 220,
    borderRadius: 120,
    alignItems: 'center',
    justifyContent: 'center'
  },
  radar: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 120,
    backgroundColor: colors.brand100
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 10,
    backgroundColor: colors.brand700
  },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.muted }
})

export default SearchingDriverScreen
