import React, { useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { MainStackParamList } from '../../navigation/MainStack'
import { LiveRouteMap } from '../../components/map/LiveRouteMap'
import { DriverInfoCard } from '../../components/customer/DriverInfoCard'
import { PrimaryButton } from '../../components/common/PrimaryButton'
import { OutlineButton } from '../../components/common/OutlineButton'
import { colors, spacing, typography } from '../../theme/tokens'
import { useCustomerStore } from '../../store/customerStore'
import { customerApi } from '../../services/customerApi'
import { useRealtimeStream } from '../../hooks/useRealtimeStream'

const RideTrackingScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const { activeRide, decreaseEta, refreshActiveRide } = useCustomerStore()
  const { latestEvent } = useRealtimeStream()
  const [eta, setEta] = useState(activeRide?.etaMinutes || 5)
  const [driverInfoTimeout, setDriverInfoTimeout] = useState(false)

  const destinationCoordinate = useMemo(() => {
    if (!activeRide) return null
    return {
      label: activeRide.destination,
      lat: activeRide.dropoffLat,
      lng: activeRide.dropoffLng
    }
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

  useEffect(() => {
    if (!activeRide?.id || activeRide.driver) return

    let disposed = false
    const poll = async () => {
      const updated = await refreshActiveRide()
      if (disposed || !updated) return
      if (updated.driver && updated.etaMinutes) {
        setEta(updated.etaMinutes)
      }
    }

    void poll()
    const intervalId = setInterval(() => {
      void poll()
    }, 4000)

    return () => {
      disposed = true
      clearInterval(intervalId)
    }
  }, [activeRide?.driver, activeRide?.id, refreshActiveRide])

  useEffect(() => {
    if (!activeRide?.driverId || activeRide.driver) {
      setDriverInfoTimeout(false)
      return
    }
    const timeoutId = setTimeout(() => {
      setDriverInfoTimeout(true)
    }, 15000)
    return () => clearTimeout(timeoutId)
  }, [activeRide?.driver, activeRide?.driverId])

  if (!activeRide) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Khong tim thay trang thai chuyen di</Text>
      </View>
    )
  }

  if (!activeRide.driverId) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Dang tim tai xe phu hop...</Text>
      </View>
    )
  }

  if (!activeRide.driver) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          {driverInfoTimeout ? 'Khong tai duoc thong tin tai xe. Vui long thu lai.' : 'Dang tai thong tin tai xe tu he thong...'}
        </Text>
        {driverInfoTimeout ? (
          <OutlineButton
            title="Thu lai"
            onPress={() => {
              setDriverInfoTimeout(false)
              void refreshActiveRide()
            }}
          />
        ) : null}
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
      <PrimaryButton title="Hoan tat chuyen di" onPress={() => navigation.replace('Payment')} />
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
